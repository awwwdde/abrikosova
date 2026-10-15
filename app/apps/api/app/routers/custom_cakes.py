"""Торты на заказ (008a): дизайны, страница, калькулятор, заявка с фото-образцами.

Цены «от …», вес и ярусы считает одна функция `services.custom_cakes.estimate`:
карточка, страница дизайна, калькулятор и ориентир заявки не могут разойтись.
"""

import logging
import secrets
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Form, HTTPException, Query
from fastapi import status as http_status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.clock import local_today
from app.core.db import get_session
from app.core.rate_limit import limit_forms
from app.models import (
    ConsultationImage,
    ConsultationRequest,
    ConsultationSource,
    CustomCake,
    DeliveryMethod,
    Filling,
    GalleryItem,
    PageContent,
    PageKey,
    Product,
)
from app.models.enums import CakeDecoration, ContactMethod, GalleryOccasion
from app.models.requests import MAX_REFERENCE_IMAGES
from app.schemas.catalog import DIETARY_LABELS
from app.schemas.custom_cakes import (
    CAKE_OCCASION_LABELS,
    DECORATION_LABELS,
    DECORATION_NOTES,
    IMAGE_ROLE_LABELS,
    REQUEST_OCCASION_LABELS,
    CakeExtraOut,
    CakeFacet,
    CakeFaqItem,
    CakePriceOut,
    CakeSpecs,
    ConsultationAccepted,
    ConsultationForm,
    CustomCakeCard,
    CustomCakeDetailOut,
    CustomCakeImageOut,
    CustomCakeListOut,
    CustomCakesInfoOut,
    EstimateOut,
    FillingCardOut,
    LabeledValue,
    OccasionOption,
    TastingSetOut,
)
from app.schemas.pages import CustomCakesContent
from app.schemas.settings import BakerySettings
from app.services import (
    audit,
    bakery_settings,
    consultation_email,
    notifications,
    storage,
    telegram,
)
from app.services import custom_cakes as cakes
from app.services.order_email import MONTHS, money
from app.services.orders import PRIVACY_POLICY_VERSION, mask_email, mask_phone

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/custom-cakes", tags=["custom-cakes"])
consultations_router = APIRouter(prefix="/consultations", tags=["custom-cakes"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]

# «Начинки» на странице: первые восемь и «Показать все начинки», если есть ещё
FILLINGS_PREVIEW = 8
OTHER_DESIGNS = 4
DEFAULT_FILLING_NOTE = "любая из списка, у ярусов может быть разная"


def _kg(value) -> str:
    """Decimal("6.0") → «6», Decimal("4.5") → «4,5»."""
    text = f"{value.normalize():f}"
    return text.replace(".", ",")


def _card(cake: CustomCake, settings: BakerySettings) -> CustomCakeCard:
    estimate = cakes.estimate(settings, cake.min_guests, cake.decoration)
    return CustomCakeCard(
        id=cake.id,
        slug=cake.slug,
        title=cake.title,
        subtitle=cake.subtitle,
        occasion=cake.occasion,
        occasion_label=CAKE_OCCASION_LABELS[cake.occasion],
        tiers=cake.tiers,
        min_guests=cake.min_guests,
        decoration=cake.decoration,
        price_from=estimate.price_from,
        image_key=cake.images[0].storage_key if cake.images else None,
    )


def _estimate_out(settings: BakerySettings, guests: int, decoration: CakeDecoration) -> EstimateOut:
    result = cakes.estimate(settings, guests, decoration)
    return EstimateOut(
        guests=guests,
        weight_kg=result.weight_kg,
        tiers=result.tiers,
        decoration=decoration,
        price_per_kg=result.price_per_kg,
        price_from=result.price_from,
    )


async def _content(session: AsyncSession) -> CustomCakesContent:
    page = await session.scalar(
        select(PageContent).where(PageContent.page_key == PageKey.CUSTOM_CAKES)
    )
    return CustomCakesContent.model_validate(page.content if page else {})


def _active() -> select:
    return select(CustomCake).where(CustomCake.is_active.is_(True))


@router.get("", response_model=CustomCakeListOut)
async def list_custom_cakes(
    session: SessionDep, occasion: GalleryOccasion | None = None
) -> CustomCakeListOut:
    """Сетка дизайнов. Счётчики «таблеток» — по всем активным дизайнам, а не по
    отфильтрованным: иначе после выбора повода остальные показали бы ноль."""
    settings = await bakery_settings.load(session)
    query = _active().order_by(CustomCake.order, CustomCake.id)
    if occasion is not None:
        query = query.where(CustomCake.occasion == occasion)
    items = (await session.scalars(query)).all()
    counts = dict(
        (
            await session.execute(
                select(CustomCake.occasion, func.count())
                .where(CustomCake.is_active.is_(True))
                .group_by(CustomCake.occasion)
            )
        ).all()
    )
    return CustomCakeListOut(
        items=[_card(cake, settings) for cake in items],
        total=len(items),
        facets=[
            CakeFacet(value=value, label=label, count=counts.get(value, 0))
            for value, label in CAKE_OCCASION_LABELS.items()
        ],
    )


@router.get("/info", response_model=CustomCakesInfoOut)
async def custom_cakes_info(session: SessionDep) -> CustomCakesInfoOut:
    """Всё для страницы, кроме сетки: факты, цены, начинки, сет, шаги, вопросы.
    Тексты — из контента страницы `custom_cakes`, цифры — из настроек."""
    settings = await bakery_settings.load(session)
    content = await _content(session)

    fillings = (
        await session.scalars(
            select(Filling)
            .where(Filling.is_available.is_(True))
            .order_by(Filling.order, Filling.id)
            .limit(FILLINGS_PREVIEW + 1)
        )
    ).all()

    tasting_set = None
    if content.tasting_set_slug:
        product = await session.scalar(
            select(Product)
            .where(Product.slug == content.tasting_set_slug, Product.is_active.is_(True))
            .options(selectinload(Product.variants))
        )
        variants = [v for v in (product.variants if product else []) if v.is_active]
        if product is not None and variants:
            variant = min(variants, key=lambda v: (v.order, v.id))
            tasting_set = TastingSetOut(
                product_id=product.id,
                variant_id=variant.id,
                slug=product.slug,
                name=product.name,
                description=product.card_ingredients or product.subtitle or product.description,
                price=variant.price,
            )

    lead = f"от {settings.cake_lead_days} дней"
    min_price = min(
        settings.cake_price_classic,
        settings.cake_price_cream_drawing,
        settings.cake_price_multi_tier,
    )
    return CustomCakesInfoOut(
        title=content.title,
        subtitle=content.subtitle,
        idea_text=content.consultation_text,
        calculator_text=content.calculator_text,
        calculator_note=content.calculator_note,
        facts=[
            LabeledValue(value=f"от {_kg(cakes.min_weight(settings))} кг", label="минимальный вес"),
            LabeledValue(value=lead, label="до готового торта"),
            LabeledValue(value=f"от {money(min_price)}", label="за килограмм"),
        ],
        prices_intro=content.prices_intro,
        prices=[
            CakePriceOut(
                decoration=decoration,
                label=DECORATION_LABELS[decoration],
                price_per_kg=cakes.price_per_kg(settings, decoration),
                note=DECORATION_NOTES[decoration],
            )
            for decoration in CakeDecoration
        ],
        prices_note=content.prices_note,
        fillings_intro=content.fillings_intro,
        fillings=[_filling(f) for f in fillings[:FILLINGS_PREVIEW]],
        fillings_more=len(fillings) > FILLINGS_PREVIEW,
        tasting_set=tasting_set,
        stages=content.stages,
        order_facts=[
            LabeledValue(label="Минимальный вес", value=f"{_kg(cakes.min_weight(settings))} кг"),
            LabeledValue(
                label="Срок",
                value=lead + (f", {content.lead_days_note}" if content.lead_days_note else ""),
            ),
            *(LabeledValue(label=fact.label, value=fact.value) for fact in content.order_facts),
        ],
        faq=[CakeFaqItem(question=q.question, answer=q.answer) for q in content.faq],
        min_weight_kg=cakes.min_weight(settings),
        lead_days=settings.cake_lead_days,
        grams_per_guest=settings.cake_grams_per_guest,
        earliest_date=cakes.earliest_date(settings),
        extras=[
            CakeExtraOut(name=e.name, price=e.price, price_from=e.price_from)
            for e in settings.cake_extras
        ],
        occasions=[
            OccasionOption(value=value, label=label)
            for value, label in REQUEST_OCCASION_LABELS.items()
        ],
    )


def _filling(filling: Filling) -> FillingCardOut:
    return FillingCardOut(
        id=filling.id,
        name=filling.name,
        short_description=filling.short_description or filling.description,
        description=filling.description,
        image_key=filling.image_key,
        dietary=filling.dietary,
        dietary_labels=[DIETARY_LABELS[tag] for tag in filling.dietary],
    )


@router.get("/fillings", response_model=list[FillingCardOut])
async def list_fillings(session: SessionDep) -> list[FillingCardOut]:
    """Все начинки — для «Показать все начинки» и select в окне заявки."""
    fillings = await session.scalars(
        select(Filling).where(Filling.is_available.is_(True)).order_by(Filling.order, Filling.id)
    )
    return [_filling(f) for f in fillings]


@router.get("/estimate", response_model=EstimateOut)
async def estimate_cake(
    session: SessionDep,
    guests: Annotated[int, Query(ge=1, le=1000)],
    design: Annotated[str | None, Query(max_length=200)] = None,
) -> EstimateOut:
    """Калькулятор: гости → вес, ярусы, «от X ₽». С дизайном — по его оформлению,
    без него («Свой дизайн») — по классическому."""
    settings = await bakery_settings.load(session)
    decoration = CakeDecoration.CLASSIC
    if design:
        cake = await session.scalar(_active().where(CustomCake.slug == design))
        if cake is None:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND, detail="Дизайн не найден"
            )
        decoration = cake.decoration
    return _estimate_out(settings, guests, decoration)


@router.get("/{slug}", response_model=CustomCakeDetailOut)
async def get_custom_cake(slug: str, session: SessionDep) -> CustomCakeDetailOut:
    settings = await bakery_settings.load(session)
    cake = await session.scalar(_active().where(CustomCake.slug == slug))
    if cake is None:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Дизайн не найден")
    content = await _content(session)
    estimate = _estimate_out(settings, cake.min_guests, cake.decoration)
    # «Другие дизайны»: сначала того же повода, потом остальные — по порядку списка
    others = (
        await session.scalars(
            _active()
            .where(CustomCake.id != cake.id)
            .order_by((CustomCake.occasion != cake.occasion), CustomCake.order, CustomCake.id)
            .limit(OTHER_DESIGNS)
        )
    ).all()
    card = _card(cake, settings)
    return CustomCakeDetailOut(
        **card.model_dump(),
        description=cake.description,
        images=[
            CustomCakeImageOut(
                storage_key=image.storage_key,
                role=image.role,
                role_label=IMAGE_ROLE_LABELS[image.role] if image.role else None,
            )
            for image in cake.images
        ],
        specs=CakeSpecs(
            decoration_label=DECORATION_LABELS[cake.decoration],
            price_per_kg=estimate.price_per_kg,
            min_weight_kg=estimate.weight_kg,
            tiers=cake.tiers,
            filling_note=content.design_filling_note or DEFAULT_FILLING_NOTE,
        ),
        estimate=estimate,
        lead_days=settings.cake_lead_days,
        earliest_date=cakes.earliest_date(settings),
        others=[_card(other, settings) for other in others],
    )


# --- Заявка ---


async def _new_number(session: AsyncSession) -> str:
    """«З-20261007-4F2A»: день кондитерской и случайный хвост, как у заказа —
    номер не выдаёт, сколько заявок приходит. Совпадение в пределах дня
    маловероятно, но проверяем: уникальный индекс иначе уронил бы заявку в 409."""
    while True:
        number = f"З-{local_today():%Y%m%d}-{secrets.token_hex(2).upper()}"
        exists = await session.scalar(
            select(ConsultationRequest.id).where(ConsultationRequest.number == number)
        )
        if exists is None:
            return number


def _date_label(value) -> str:
    return f"{value.day} {MONTHS[value.month - 1]}"


@consultations_router.post(
    "",
    response_model=ConsultationAccepted,
    status_code=http_status.HTTP_201_CREATED,
    dependencies=[Depends(limit_forms)],
)
async def create_consultation(
    # media_type явно: файлы объявлены внутри модели, и без подсказки FastAPI
    # описал бы в OpenAPI urlencoded-форму — сгенерированный клиент терял бы фото
    data: Annotated[ConsultationForm, Form(media_type="multipart/form-data")],
    session: SessionDep,
    background: BackgroundTasks,
) -> ConsultationAccepted:
    """Заявка на торт: поля окна заявки + до 5 фото-образцов.

    Порядок: сначала все проверки (поля, дата, дизайн, файлы по содержимому),
    потом файлы уходят в хранилище, потом строка в базу. Отклонённая заявка
    не оставляет в бакете загруженных картинок.
    """
    settings = await bakery_settings.load(session)
    earliest = cakes.earliest_date(settings)
    if data.event_date < earliest:
        raise HTTPException(
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": f"Выберите дату не раньше чем через {settings.cake_lead_days} дней",
                "field": "event_date",
                "earliest_date": earliest.isoformat(),
            },
        )

    design = None
    if data.design_id is not None:
        design = await session.scalar(_active().where(CustomCake.id == data.design_id))
        if design is None:
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Дизайн не найден"
            )
        if data.guests_count < design.min_guests:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": f"Для этого дизайна нужно не меньше {design.min_guests} гостей",
                    "field": "guests_count",
                },
            )
    work = None
    if data.gallery_item_id is not None:
        work = await session.get(GalleryItem, data.gallery_item_id)
        if work is None or not work.is_active:
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Работа не найдена"
            )
    filling = None
    if data.filling_id is not None:
        filling = await session.get(Filling, data.filling_id)
        if filling is None or not filling.is_available:
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Начинка не найдена"
            )

    known = {extra.name: extra for extra in settings.cake_extras}
    unknown = [name for name in data.extras if name not in known]
    if unknown:
        raise HTTPException(
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Нет такого дополнения: {', '.join(unknown)}",
        )
    extras = [
        {"name": name, "price": known[name].price, "from": known[name].price_from}
        for name in dict.fromkeys(data.extras)
    ]

    files = [file for file in data.references if file.filename]
    if len(files) > MAX_REFERENCE_IMAGES:
        raise HTTPException(
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Не больше {MAX_REFERENCE_IMAGES} фото",
        )
    # Все файлы проверяются и конвертируются до первой записи в хранилище
    converted = [await storage.convert_upload(file) for file in files]
    keys: list[str] = []
    try:
        for webp in converted:
            keys.append(await storage.put_webp(webp, prefix=storage.PRIVATE_REFERENCES_PREFIX))

        decoration = design.decoration if design else CakeDecoration.CLASSIC
        estimate = _estimate_out(settings, data.guests_count, decoration)
        row = ConsultationRequest(
            number=await _new_number(session),
            name=data.name.strip(),
            phone=data.phone.strip(),
            email=data.email,
            contact_method=data.contact_method,
            occasion=data.occasion,
            event_date=data.event_date,
            guests_count=data.guests_count,
            design_id=design.id if design else None,
            gallery_item_id=work.id if work else None,
            filling_id=filling.id if filling else None,
            wishes=(data.wishes or "").strip() or None,
            extras=extras,
            delivery_method=data.delivery_method,
            estimate=cakes.estimate(settings, data.guests_count, decoration).snapshot(),
            consent_pd=data.consent_pd,
            consent_at=datetime.now(UTC),
            consent_policy_version=PRIVACY_POLICY_VERSION,
            source=ConsultationSource.CUSTOM_CAKE,
            images=[ConsultationImage(storage_key=key, order=i) for i, key in enumerate(keys)],
        )
        session.add(row)
        await session.flush()
        # Лента админки — без имени, телефона и почты (011c)
        await audit.record_site(
            session,
            action="site_consultation",
            entity="consultation",
            entity_id=row.id,
            details={
                "source": ConsultationSource.CUSTOM_CAKE.value,
                "number": row.number,
                "occasion": data.occasion.value,
                "event_date": data.event_date.isoformat(),
                "guests": data.guests_count,
                "design": design.title if design else None,
                "references": len(keys),
            },
        )
        await session.commit()
    except BaseException:
        # Коммит не состоялся: в БД нет владельца приватных файлов.
        await session.rollback()
        for key in keys:
            await storage.delete_image(key)
        raise

    sample = design.title if design else (work.caption if work else "Свой дизайн")
    occasion = REQUEST_OCCASION_LABELS[data.occasion].lower()
    title = f"{sample}, {occasion}, {_date_label(data.event_date)}"
    details = " · ".join(
        part
        for part in (
            row.number,
            title,
            f"гостей: {data.guests_count}",
            f"ориентир от {money(estimate.price_from)}",
            f"фото-образцов: {len(keys)}" if keys else None,
        )
        if part
    )
    background.add_task(
        notifications.notify_new_request, row.id, row.source.value, row.phone, details
    )
    background.add_task(
        telegram.notify_new_request, row.id, row.source.value, row.phone, row.name, details
    )

    contacts = await session.scalar(
        select(PageContent).where(PageContent.page_key == PageKey.CONTACTS)
    )
    background.add_task(
        consultation_email.send_copy,
        consultation_email.ConsultationEmail(
            to=data.email,
            number=row.number,
            title=title,
            guests=data.guests_count,
            weight=f"{_kg(estimate.weight_kg)} кг",
            estimate=f"от {money(estimate.price_from)}",
            filling=filling.name if filling else "Помогите выбрать",
            extras=[extra["name"] for extra in extras],
            method="Доставка" if data.delivery_method is DeliveryMethod.DELIVERY else "Самовывоз",
            wishes=row.wishes,
            references=len(keys),
            phone=contacts.phone if contacts else None,
            telegram_url=contacts.telegram_url if contacts else None,
            work_hours=contacts.work_hours_weekdays if contacts else None,
            logo_url=consultation_email.logo_url(),
        ),
    )
    logger.info("Создана заявка на торт %s", row.number)
    return ConsultationAccepted(
        id=row.id,
        number=row.number,
        title=title,
        phone_masked=mask_phone(row.phone),
        email_masked=mask_email(data.email) or "",
        contact_method=data.contact_method or ContactMethod.CALL,
        estimate=estimate,
    )
