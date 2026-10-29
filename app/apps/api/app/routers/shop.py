"""Галерея, отзывы, контент страниц, контакты, корзина, заказы.

Все мутации — строго не через GET (ANALYSIS.md, п. 2.1.4) и под rate limiting.
"""

import asyncio
import logging
import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Cookie,
    Depends,
    Header,
    HTTPException,
    Query,
    Response,
)
from fastapi import status as http_status
from sqlalchemy import func, inspect, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_session
from app.core.rate_limit import limit_cart, limit_forms, limit_orders
from app.core.redis import get_redis
from app.models import (
    Cart,
    Category,
    ConsultationRequest,
    ConsultationSource,
    DeliveryMethod,
    GalleryItem,
    Occasion,
    Order,
    PageContent,
    PageKey,
    Product,
    ProductImage,
    Review,
    ReviewSource,
    SubCategory,
)
from app.models.enums import GalleryOccasion
from app.schemas.catalog import OCCASION_LABELS, ProductListItem
from app.schemas.common import Page
from app.schemas.custom_cakes import GalleryWorkOut
from app.schemas.shop import (
    AboutPageOut,
    CartItemIn,
    CartItemQuantityIn,
    CartOut,
    ContactsPageOut,
    CustomCakesContentPageOut,
    FeedbackCreate,
    GalleryFacet,
    GalleryItemOut,
    GalleryPageOut,
    HomePageOut,
    LegalPageOut,
    LoginPhotoOut,
    OrderConfirmationOut,
    OrderCreate,
    OrderCreated,
    PageContentOut,
    RequestAccepted,
    ReviewOut,
)
from app.services import (
    audit,
    bakery_settings,
    notifications,
    order_email,
    order_token,
    telegram,
)
from app.services import cart as cart_service
from app.services import catalog as catalog_service
from app.services import orders as order_service
from app.services.catalog import published_reviews
from app.services.orders import PRIVACY_POLICY_VERSION
from app.services.photo_meta import photo_meta

logger = logging.getLogger(__name__)

content_router = APIRouter(tags=["content"])
contacts_router = APIRouter(prefix="/contacts", tags=["contacts"])
cart_router = APIRouter(prefix="/cart", tags=["cart"])
orders_router = APIRouter(prefix="/orders", tags=["orders"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]
CartCookie = Annotated[str | None, Cookie(alias="cart_id")]


def _set_cart_cookie(response: Response, cart_id: uuid.UUID) -> None:
    """httpOnly-cookie с id корзины.

    httpOnly — чтобы её нельзя было прочитать скриптом при XSS;
    SameSite=Lax — чтобы cookie не уходила при межсайтовых POST (защита от CSRF);
    Secure на проде — чтобы она не ходила по HTTP.
    """
    settings = get_settings()
    response.set_cookie(
        key=settings.cart_cookie_name,
        value=str(cart_id),
        max_age=settings.cart_ttl_days * 24 * 3600,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.cookie_domain,
        path="/",
    )


def _parse_cart_id(raw: str | None) -> uuid.UUID | None:
    if not raw:
        return None
    try:
        return uuid.UUID(raw)
    except ValueError:
        # Мусор в cookie — не ошибка клиента, просто заводим новую корзину
        return None


def _order_when(order: Order) -> str | None:
    """«27.09.2026, 12–15» — дата и интервал получения для уведомления."""
    if order.desired_date is None:
        return None
    when = f"{order.desired_date:%d.%m.%Y}"
    if order.delivery_interval is not None:
        when += f", {order.delivery_interval.value.replace('-', '–')}"
    return when


# --- Форма обратной связи ---


async def _create_request(
    session: AsyncSession,
    background: BackgroundTasks,
    *,
    name: str,
    phone: str,
    description: str | None,
    source: ConsultationSource,
    consent_pd: bool,
) -> ConsultationRequest:
    request_row = ConsultationRequest(
        name=name.strip(),
        phone=phone.strip(),
        description=(description or "").strip() or None,
        consent_pd=consent_pd,
        consent_at=datetime.now(UTC),
        consent_policy_version=PRIVACY_POLICY_VERSION,
        source=source,
    )
    session.add(request_row)
    await session.flush()
    # Лента админки: «новая заявка: свадьба, 14 ноября» — без имени и телефона (011c)
    await audit.record_site(
        session,
        action="site_consultation",
        entity="consultation",
        entity_id=request_row.id,
        details={"source": source.value},
    )
    await session.commit()

    background.add_task(notifications.notify_new_request, request_row.id, source.value, phone)
    background.add_task(
        telegram.notify_new_request, request_row.id, source.value, phone, request_row.name
    )
    logger.info("Создана заявка #%s (источник %s)", request_row.id, source.value)
    return request_row


@contacts_router.post(
    "/feedback",
    response_model=RequestAccepted,
    status_code=http_status.HTTP_201_CREATED,
    dependencies=[Depends(limit_forms)],
)
async def create_feedback(
    data: FeedbackCreate,
    session: SessionDep,
    background: BackgroundTasks,
) -> RequestAccepted:
    row = await _create_request(
        session,
        background,
        name=data.name,
        phone=data.phone,
        description=data.message,
        source=ConsultationSource.CONTACT_PAGE,
        consent_pd=data.consent_pd,
    )
    return RequestAccepted(id=row.id)


# --- Галерея, отзывы, страницы ---


# Фильтр «Работ» (009): значение → поводы работ. Группа «Юбилей и корпоратив» —
# два повода; остальные — один в один
GALLERY_GROUPS: dict[GalleryOccasion, tuple[Occasion, ...]] = {
    GalleryOccasion.WEDDING: (Occasion.WEDDING,),
    GalleryOccasion.BIRTHDAY: (Occasion.BIRTHDAY,),
    GalleryOccasion.KIDS: (Occasion.KIDS,),
    GalleryOccasion.ANNIVERSARY_CORPORATE: (Occasion.ANNIVERSARY, Occasion.CORPORATE),
}
GALLERY_FACET_LABELS: dict[GalleryOccasion, str] = {
    GalleryOccasion.WEDDING: "Свадьба",
    GalleryOccasion.BIRTHDAY: "День рождения",
    GalleryOccasion.KIDS: "Детский",
    GalleryOccasion.ANNIVERSARY_CORPORATE: "Юбилей и корпоратив",
}


@content_router.get("/gallery", response_model=Page[GalleryItemOut])
async def list_gallery(
    session: SessionDep,
    occasion: GalleryOccasion | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=60)] = 12,
) -> Page[GalleryItemOut]:
    """Примеры работ с фильтром по поводу — отдельная страница вместо портфолио
    внутри товарного каталога, как было раньше (PDF «Этап 1», раздел 11).
    `occasion` — значение фильтра: повод или группа «юбилей и корпоратив» (009)."""
    base = select(GalleryItem).where(GalleryItem.is_active.is_(True))
    if occasion is not None:
        base = base.where(GalleryItem.occasion.in_(GALLERY_GROUPS[occasion]))
    total = await session.scalar(select(func.count()).select_from(base.subquery())) or 0
    items = (
        await session.scalars(
            base.order_by(GalleryItem.order, GalleryItem.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    return Page(items=list(items), total=total, page=page, page_size=page_size)


@content_router.get("/gallery/occasions", response_model=list[GalleryFacet])
async def gallery_occasions(session: SessionDep) -> list[GalleryFacet]:
    """«Таблетки» фильтра «Работ» с числом опубликованных работ (009). Пустые
    сайт прячет, как подразделы каталога; порядок — как в макете."""
    rows = (
        await session.execute(
            select(GalleryItem.occasion, func.count())
            .where(GalleryItem.is_active.is_(True), GalleryItem.occasion.is_not(None))
            .group_by(GalleryItem.occasion)
        )
    ).all()
    counts = {occasion: count for occasion, count in rows}
    return [
        GalleryFacet(
            value=value,
            label=GALLERY_FACET_LABELS[value],
            count=sum(counts.get(o, 0) for o in GALLERY_GROUPS[value]),
        )
        for value in GalleryOccasion
    ]


LOGIN_PHOTOS_LIMIT = 30


@content_router.get("/gallery/{item_id}", response_model=GalleryWorkOut)
async def get_gallery_item(item_id: int, session: SessionDep) -> GalleryWorkOut:
    """Работа как образец в окне заявки — «Заказать похожий» (009 → 008a)."""
    item = await session.get(GalleryItem, item_id)
    if item is None or not item.is_active:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Работа не найдена")
    return GalleryWorkOut(
        id=item.id,
        caption=item.caption,
        image_key=item.image_key,
        occasion_label=OCCASION_LABELS[item.occasion] if item.occasion else None,
        tiers=item.tiers,
        guests=item.guests,
    )


@content_router.get("/content/login-photos", response_model=list[LoginPhotoOut])
async def login_photos(session: SessionDep, response: Response) -> list[LoginPhotoOut]:
    """Фото для страницы входа в админку (задание 011a): опубликованные работы
    и главные фото активных товаров в активных разделах, до 30 штук вперемешку.

    Публичный, потому что страница входа открыта до входа. Отдаёт только то, что
    и так видно на сайте, — скрытые товары и снятые с публикации работы не
    попадают. Заглушки без файла (`placeholder/…`) — тоже.
    """
    works = (
        await session.scalars(
            select(GalleryItem)
            .where(
                GalleryItem.is_active.is_(True), ~GalleryItem.image_key.startswith("placeholder/")
            )
            .order_by(GalleryItem.order, GalleryItem.id)
            .limit(LOGIN_PHOTOS_LIMIT)
        )
    ).all()
    products = (
        await session.execute(
            select(Product.name, ProductImage.storage_key)
            .join(ProductImage, ProductImage.product_id == Product.id)
            .join(Category, Category.id == Product.category_id)
            .join(SubCategory, SubCategory.id == Product.subcategory_id)
            .where(
                Product.is_active.is_(True),
                Category.is_active.is_(True),
                SubCategory.is_active.is_(True),
                ProductImage.is_main.is_(True),
                ~ProductImage.storage_key.startswith("placeholder/"),
            )
            .order_by(Product.order, Product.id)
            .limit(LOGIN_PHOTOS_LIMIT)
        )
    ).all()

    work_items = [(w.image_key, w.caption, "work") for w in works]
    product_items = [(key, name, "product") for name, key in products]
    # Вперемешку: работа, товар, работа… — чтобы список не начинался только с тортов
    mixed: list[tuple[str, str, str]] = []
    for index in range(max(len(work_items), len(product_items))):
        mixed.extend(item[index] for item in (work_items, product_items) if index < len(item))

    # Размер и фон нужны, чтобы показать фото без растягивания на панели его цвета.
    # Считаются один раз на файл (кэш в Redis), поэтому параллельный опрос дешёвый.
    # Фото, которое не прочиталось, пропускаем — ответ из-за него не ломается.
    metas = await asyncio.gather(*(photo_meta(key) for key, _, _ in mixed))
    result = [
        LoginPhotoOut(
            image_key=key,
            caption=caption,
            kind=kind,
            width=meta.width,
            height=meta.height,
            bg=meta.bg,
        )
        for (key, caption, kind), meta in zip(mixed, metas, strict=True)
        if meta is not None
    ]
    # Страница меняет фото раз в 10 минут — чаще список обновлять незачем
    response.headers["Cache-Control"] = "public, max-age=600"
    return result[:LOGIN_PHOTOS_LIMIT]


@content_router.get("/reviews", response_model=Page[ReviewOut])
async def list_reviews(
    session: SessionDep,
    product: Annotated[str | None, Query(description="slug товара")] = None,
    source: Annotated[ReviewSource | None, Query(description="откуда отзыв")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=60)] = 12,
) -> Page[ReviewOut]:
    """Только опубликованные отзывы — неопубликованные видны лишь в админке.

    Без `product` — все отзывы, с `product` — отзывы о позиции (продолжение
    блока 06 карточки товара, где первые отзывы приходят сразу).
    `source=yandex` — блок «Что говорят гости» на главной: там только отзывы
    с Яндекс.Карт со ссылкой на оригинал.
    """
    base = published_reviews()
    if source is not None:
        base = base.where(Review.source == source)
    if product is not None:
        base = base.join(Product, Review.product_id == Product.id).where(
            Product.slug == product, Product.is_active.is_(True)
        )
    total = await session.scalar(select(func.count()).select_from(base.subquery())) or 0
    items = (
        await session.scalars(
            base.order_by(Review.created_at.desc(), Review.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    return Page(items=list(items), total=total, page=page, page_size=page_size)


async def _page_or_404(session: AsyncSession, page_key: PageKey) -> PageContent:
    page = await session.scalar(select(PageContent).where(PageContent.page_key == page_key))
    if page is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail="Страница не найдена"
        )
    return page


# Главная и контакты — отдельными маршрутами до общего `/pages/{page_key}`:
# ответ тот же, но у `content` в OpenAPI есть схема, и фронтенд получает типы
# генерацией (порядок регистрации важен — FastAPI берёт первый совпавший путь)
@content_router.get("/pages/home", response_model=HomePageOut)
async def get_home_page(session: SessionDep) -> PageContent:
    return await _page_or_404(session, PageKey.HOME)


@content_router.get("/pages/contacts", response_model=ContactsPageOut)
async def get_contacts_page(session: SessionDep) -> PageContent:
    return await _page_or_404(session, PageKey.CONTACTS)


@content_router.get("/pages/about", response_model=AboutPageOut)
async def get_about_page(session: SessionDep) -> PageContent:
    return await _page_or_404(session, PageKey.ABOUT)


@content_router.get("/pages/custom_cakes", response_model=CustomCakesContentPageOut)
async def get_custom_cakes_content(session: SessionDep) -> PageContent:
    return await _page_or_404(session, PageKey.CUSTOM_CAKES)


@content_router.get("/pages/gallery", response_model=GalleryPageOut)
async def get_gallery_page(session: SessionDep) -> PageContent:
    return await _page_or_404(session, PageKey.GALLERY)


@content_router.get("/pages/legal", response_model=LegalPageOut)
async def get_legal_page(session: SessionDep) -> PageContent:
    return await _page_or_404(session, PageKey.LEGAL)


@content_router.get("/pages/{page_key}", response_model=PageContentOut)
async def get_page_content(page_key: PageKey, session: SessionDep) -> PageContent:
    return await _page_or_404(session, page_key)


# --- Корзина ---


async def _cart_response(session: AsyncSession, response: Response, cart) -> CartOut:
    """Коммит, cookie и свежее представление корзины — общий хвост всех мутаций."""
    if inspect(cart).transient:
        return cart_service.build_cart_view(cart, await bakery_settings.load(session))
    cart.updated_at = datetime.now(UTC)
    await session.commit()
    cart = await cart_service.reload(session, cart)
    _set_cart_cookie(response, cart.id)
    return cart_service.build_cart_view(cart, await bakery_settings.load(session))


@cart_router.get("", response_model=CartOut)
async def get_cart(session: SessionDep, response: Response, cart_id: CartCookie = None) -> CartOut:
    cart = await cart_service.find_cart(session, _parse_cart_id(cart_id))
    return cart_service.build_cart_view(
        cart if cart is not None else Cart(items=[]),
        await bakery_settings.load(session),
    )


@cart_router.get("/upsell", response_model=list[ProductListItem])
async def get_upsell(session: SessionDep, cart_id: CartCookie = None) -> list[ProductListItem]:
    """«К торту часто берут» (007a): до 4 товаров «Предлагать в корзине», в наличии
    сегодня и не из корзины. В корзине нет торта — пустой список, блок не показывается."""
    parsed = _parse_cart_id(cart_id)
    if parsed is None:
        return []
    cart = await cart_service.find_cart(session, parsed)
    if cart is None:
        return []
    product_ids = [item.variant.product_id for item in cart.items]
    return await catalog_service.list_upsell(session, product_ids)


@cart_router.post(
    "/items",
    response_model=CartOut,
    status_code=http_status.HTTP_201_CREATED,
    dependencies=[Depends(limit_cart)],
)
async def add_cart_item(
    data: CartItemIn,
    session: SessionDep,
    response: Response,
    cart_id: CartCookie = None,
) -> CartOut:
    """Добавляет вариант товара (и надпись, если товар её допускает).

    Тот же вариант с той же надписью — растёт количество; другая надпись или
    другой вариант — новая строка. Цена надписи в строке не хранится: корзина
    и заказ берут текущую из настроек.
    """
    try:
        variant = await cart_service.load_sellable_variant(session, data.variant_id)
    except cart_service.VariantNotFoundError:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail="Товар не найден"
        ) from None

    cart = await cart_service.get_or_create_cart(session, _parse_cart_id(cart_id))
    try:
        await cart_service.add_item(session, cart, variant, data.quantity, data.inscription_text)
    except cart_service.InscriptionNotAllowedError:
        raise HTTPException(
            status_code=422, detail="К этому товару надпись на табличке не делаем"
        ) from None
    except cart_service.CartFullError:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail=f"В корзине не может быть больше {cart_service.MAX_CART_LINES} разных позиций",
        ) from None
    return await _cart_response(session, response, cart)


@cart_router.patch("/items/{item_id}", response_model=CartOut, dependencies=[Depends(limit_cart)])
async def update_cart_item(
    item_id: int,
    data: CartItemQuantityIn,
    session: SessionDep,
    response: Response,
    cart_id: CartCookie = None,
) -> CartOut:
    """`item_id` — id строки корзины из `CartOut.items[].id`. Количество и/или
    надпись (007a): новая надпись совпала с другой строкой того же варианта —
    строки сливаются."""
    cart = await cart_service.get_or_create_cart(session, _parse_cart_id(cart_id), create=False)
    if "inscription_text" in data.model_fields_set:
        try:
            await cart_service.set_inscription(session, cart, item_id, data.inscription_text)
        except cart_service.InscriptionNotAllowedError:
            raise HTTPException(
                status_code=422, detail="К этому товару надпись на табличке не делаем"
            ) from None
    if data.quantity is not None and any(item.id == item_id for item in cart.items):
        await cart_service.set_quantity(session, cart, item_id, data.quantity)
    return await _cart_response(session, response, cart)


@cart_router.delete("/items/{item_id}", response_model=CartOut, dependencies=[Depends(limit_cart)])
async def delete_cart_item(
    item_id: int,
    session: SessionDep,
    response: Response,
    cart_id: CartCookie = None,
) -> CartOut:
    cart = await cart_service.get_or_create_cart(session, _parse_cart_id(cart_id), create=False)
    await cart_service.remove_item(session, cart, item_id)
    return await _cart_response(session, response, cart)


@cart_router.delete("", response_model=CartOut, dependencies=[Depends(limit_cart)])
async def clear_cart(
    session: SessionDep, response: Response, cart_id: CartCookie = None
) -> CartOut:
    cart = await cart_service.get_or_create_cart(session, _parse_cart_id(cart_id), create=False)
    await cart_service.clear(session, cart)
    return await _cart_response(session, response, cart)


# --- Заказы ---


# Ключ идемпотентности заказа (007b): двойное нажатие «Отправить заказ» или повтор
# запроса после обрыва сети не создают второй заказ. Ключ живёт 10 минут
IDEMPOTENCY_TTL = 600


@orders_router.post(
    "",
    response_model=OrderCreated,
    status_code=http_status.HTTP_201_CREATED,
    dependencies=[Depends(limit_orders)],
)
async def create_order(
    data: OrderCreate,
    session: SessionDep,
    background: BackgroundTasks,
    cart_id: CartCookie = None,
    idempotency_key: Annotated[
        str | None,
        Header(
            alias="Idempotency-Key",
            max_length=100,
            description="Один ключ на попытку оформления: повтор вернёт тот же заказ",
        ),
    ] = None,
) -> OrderCreated:
    """Сумма пересчитывается на сервере по актуальным ценам — сумме от клиента не доверяем.

    С заголовком `Idempotency-Key` (007b) повтор с тем же ключом и той же корзиной
    возвращает уже созданный заказ, а запрос, пришедший, пока первый ещё идёт, — 409.
    """
    parsed = _parse_cart_id(cart_id)
    if parsed is None:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="Корзина пуста")
    if not idempotency_key:
        return await _place_order(data, session, background, parsed)

    redis = get_redis()
    key = f"order-idem:{parsed}:{idempotency_key}"
    if not await redis.set(key, "pending", nx=True, ex=IDEMPOTENCY_TTL):
        existing = await redis.get(key)
        order = (
            await order_service.get_order_by_number(session, existing)
            if existing and existing != "pending"
            else None
        )
        if order is None:
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail="Заказ уже отправляется, подождите пару секунд",
            )
        confirmation = order_service.build_confirmation(order, await bakery_settings.load(session))
        return OrderCreated(**confirmation.model_dump(), token=order_token.make(order.order_number))
    try:
        created = await _place_order(data, session, background, parsed)
    except BaseException:
        # Заказ не создан — повтор с тем же ключом должен пройти заново
        await redis.delete(key)
        raise
    await redis.set(key, created.order_number, ex=IDEMPOTENCY_TTL)
    return created


async def _place_order(
    data: OrderCreate,
    session: AsyncSession,
    background: BackgroundTasks,
    parsed: uuid.UUID,
) -> OrderCreated:
    cart = await cart_service.get_or_create_cart(session, parsed, create=False)
    settings = await bakery_settings.load(session)

    try:
        order = await order_service.create_order(session, cart, data, settings)
    except order_service.EmptyCartError:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST, detail="Корзина пуста"
        ) from None
    except order_service.UnavailableProductError as exc:
        raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail=str(exc)) from None
    except order_service.InscriptionTooLongError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
    except order_service.IntervalNotOfferedError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
    except order_service.DateTooEarlyError as exc:
        # 422, а не 409: исправить нужно поле формы, а не содержимое корзины
        raise HTTPException(
            status_code=422,
            detail={
                "message": str(exc),
                "earliest_date": exc.earliest.isoformat(),
                "nearest_interval": exc.nearest.interval.value,
            },
        ) from None

    # Собираем представление до очистки корзины: в нём названия товаров,
    # которые нужны в тексте уведомления
    order_view = order_service.build_order_view(order)

    await cart_service.clear(session, cart)
    # Лента админки: «новый заказ № 0944 на 1 400 ₽» — номер, сумма и способ получения,
    # без ПДн (011c). Почта, получатель, адрес и комментарии сюда не попадают (007a)
    await audit.record_site(
        session,
        action="site_order",
        entity="order",
        entity_id=order.id,
        details={
            "number": order.order_number,
            "total": str(order.total_price),
            "delivery_method": order.delivery_method.value,
        },
    )
    await session.commit()

    when = _order_when(order)
    background.add_task(
        notifications.notify_new_order,
        order.order_number,
        str(order.total_price),
        order.customer_phone,
        order.delivery_method.value,
        when,
    )
    background.add_task(
        telegram.notify_new_order,
        order.order_number,
        str(order.total_price),
        order.customer_phone,
        "Доставка" if order.delivery_method is DeliveryMethod.DELIVERY else "Самовывоз",
        order.customer_name,
        [(item.name, item.quantity, str(item.line_total)) for item in order_view.items],
        when,
    )

    # Копия заказа покупателю (007a). Контакты кондитерской — из страницы «Контакты»
    # на момент заказа; письмо собирается сейчас, отправляется в фоне
    token = order_token.make(order.order_number)
    confirmation = order_service.build_confirmation(order, settings)
    contacts = await session.scalar(
        select(PageContent).where(PageContent.page_key == PageKey.CONTACTS)
    )
    background.add_task(
        order_email.send_order_copy,
        order_email.build(
            order,
            token=token,
            after_hours=confirmation.after_hours,
            work_start=settings.work_hours_start,
            pickup_address=contacts.address if contacts else None,
            phone=contacts.phone if contacts else None,
            telegram_url=contacts.telegram_url if contacts else None,
            work_hours=contacts.work_hours_weekdays if contacts else None,
        ),
    )
    return OrderCreated(**confirmation.model_dump(), token=token)


@orders_router.get("/{order_number}", response_model=OrderConfirmationOut)
async def get_order(
    order_number: str,
    session: SessionDep,
    t: Annotated[str | None, Query(max_length=200, description="Токен из ссылки")] = None,
) -> OrderConfirmationOut:
    """Страница «Заказ принят» без входа (007a) — только с токеном из ссылки после
    оформления (services/order_token.py). Без токена, с чужим или просроченным — 404,
    как будто заказа нет: номер из даты и 6 знаков перебирается. Телефон и почта — в маске."""
    not_found = HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Заказ не найден")
    if not order_token.is_valid(order_number, t):
        raise not_found
    order = await order_service.get_order_by_number(session, order_number)
    if order is None:
        raise not_found
    return order_service.build_confirmation(order, await bakery_settings.load(session))
