"""Торты на заказ, галерея, отзывы, контент страниц, контакты, корзина, заказы.

Все мутации — строго не через GET (ANALYSIS.md, п. 2.1.4) и под rate limiting.
"""

import logging
import uuid
from datetime import UTC, date, datetime
from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Cookie,
    Depends,
    Form,
    HTTPException,
    Query,
    Response,
)
from fastapi import status as http_status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_session
from app.core.rate_limit import limit_cart, limit_forms, limit_orders
from app.models import (
    ConsultationRequest,
    ConsultationSource,
    CustomCake,
    DeliveryMethod,
    Filling,
    GalleryItem,
    Occasion,
    Order,
    PageContent,
    PageKey,
    Product,
    Review,
)
from app.schemas.catalog import OCCASION_LABELS
from app.schemas.common import Page
from app.schemas.shop import (
    CartItemIn,
    CartItemQuantityIn,
    CartOut,
    ConsultationForm,
    CustomCakesPageOut,
    FeedbackCreate,
    GalleryItemOut,
    OrderCreate,
    OrderCreated,
    OrderOut,
    PageContentOut,
    RequestAccepted,
    ReviewOut,
)
from app.services import cart as cart_service
from app.services import notifications, storage, telegram
from app.services import orders as order_service
from app.services.catalog import published_reviews
from app.services.orders import PRIVACY_POLICY_VERSION

logger = logging.getLogger(__name__)

custom_cakes_router = APIRouter(prefix="/custom-cakes", tags=["custom-cakes"])
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


def _request_details(row: ConsultationRequest) -> str | None:
    """Строка «Свадьба · 12.12.2026 · гостей: 45 · есть фото-референс» для уведомления."""
    parts = [
        OCCASION_LABELS[row.occasion] if row.occasion else None,
        f"{row.event_date:%d.%m.%Y}" if row.event_date else None,
        f"гостей: {row.guests_count}" if row.guests_count else None,
        "есть фото-референс" if row.reference_image_key else None,
    ]
    return " · ".join(p for p in parts if p) or None


def _order_when(order: Order) -> str | None:
    """«27.09.2026, 12–15» — дата и интервал получения для уведомления."""
    if order.desired_date is None:
        return None
    when = f"{order.desired_date:%d.%m.%Y}"
    if order.delivery_interval is not None:
        when += f", {order.delivery_interval.value.replace('-', '–')}"
    return when


# --- Торты на заказ ---


@custom_cakes_router.get("", response_model=CustomCakesPageOut)
async def get_custom_cakes_page(session: SessionDep) -> CustomCakesPageOut:
    cakes = (
        await session.scalars(
            select(CustomCake)
            .where(CustomCake.is_active.is_(True))
            .order_by(CustomCake.order, CustomCake.id)
        )
    ).all()
    fillings = (
        await session.scalars(
            select(Filling)
            .where(Filling.is_available.is_(True))
            .order_by(Filling.order, Filling.id)
        )
    ).all()
    page = await session.scalar(
        select(PageContent).where(PageContent.page_key == PageKey.CUSTOM_CAKES)
    )

    return CustomCakesPageOut(
        cakes=list(cakes),
        fillings=list(fillings),
        page=PageContentOut.model_validate(page) if page else None,
    )


async def _create_request(
    session: AsyncSession,
    background: BackgroundTasks,
    *,
    name: str,
    phone: str,
    description: str | None,
    source: ConsultationSource,
    consent_pd: bool,
    occasion: Occasion | None = None,
    event_date: date | None = None,
    guests_count: int | None = None,
    reference_image_key: str | None = None,
) -> ConsultationRequest:
    request_row = ConsultationRequest(
        name=name.strip(),
        phone=phone.strip(),
        description=(description or "").strip() or None,
        occasion=occasion,
        event_date=event_date,
        guests_count=guests_count,
        reference_image_key=reference_image_key,
        consent_pd=consent_pd,
        consent_at=datetime.now(UTC),
        consent_policy_version=PRIVACY_POLICY_VERSION,
        source=source,
    )
    session.add(request_row)
    await session.flush()
    await session.commit()

    details = _request_details(request_row)
    background.add_task(
        notifications.notify_new_request, request_row.id, source.value, phone, details
    )
    background.add_task(
        telegram.notify_new_request, request_row.id, source.value, phone, request_row.name, details
    )
    logger.info("Создана заявка #%s (источник %s)", request_row.id, source.value)
    return request_row


@custom_cakes_router.post(
    "/consultation",
    response_model=RequestAccepted,
    status_code=http_status.HTTP_201_CREATED,
    dependencies=[Depends(limit_forms)],
)
async def create_consultation(
    # media_type явно: файл объявлен внутри модели, и без подсказки FastAPI
    # описал бы в OpenAPI urlencoded-форму — сгенерированный по схеме клиент
    # тогда молча терял бы фото
    data: Annotated[ConsultationForm, Form(media_type="multipart/form-data")],
    session: SessionDep,
    background: BackgroundTasks,
) -> RequestAccepted:
    """Заявка на торт под событие. multipart/form-data: поля формы + необязательное фото.

    Порядок важен: сначала FastAPI валидирует поля (согласие, телефон, даты),
    и только потом файл уходит в хранилище — чтобы заведомо отклонённая заявка
    не оставляла после себя загруженных картинок.
    """
    reference_key = None
    if data.reference is not None and data.reference.filename:
        reference_key = await storage.upload_image(
            data.reference, prefix=storage.PRIVATE_REFERENCES_PREFIX
        )

    row = await _create_request(
        session,
        background,
        name=data.name,
        phone=data.phone,
        description=data.description,
        source=ConsultationSource.CUSTOM_CAKE,
        consent_pd=data.consent_pd,
        occasion=data.occasion,
        event_date=data.event_date,
        guests_count=data.guests_count,
        reference_image_key=reference_key,
    )
    return RequestAccepted(id=row.id)


# --- Форма обратной связи ---


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


@content_router.get("/gallery", response_model=Page[GalleryItemOut])
async def list_gallery(
    session: SessionDep,
    occasion: Occasion | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=60)] = 12,
) -> Page[GalleryItemOut]:
    """Примеры работ с фильтром по поводу — отдельная страница вместо портфолио
    внутри товарного каталога, как было раньше (PDF «Этап 1», раздел 11)."""
    base = select(GalleryItem).where(GalleryItem.is_active.is_(True))
    if occasion is not None:
        base = base.where(GalleryItem.occasion == occasion)
    total = await session.scalar(select(func.count()).select_from(base.subquery())) or 0
    items = (
        await session.scalars(
            base.order_by(GalleryItem.order, GalleryItem.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    return Page(items=list(items), total=total, page=page, page_size=page_size)


@content_router.get("/reviews", response_model=Page[ReviewOut])
async def list_reviews(
    session: SessionDep,
    product: Annotated[str | None, Query(description="slug товара")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=60)] = 12,
) -> Page[ReviewOut]:
    """Только опубликованные отзывы — неопубликованные видны лишь в админке.

    Без `product` — все отзывы (блок на главной), с `product` — отзывы о позиции
    (продолжение блока 06 карточки товара, где первые отзывы приходят сразу).
    """
    base = published_reviews()
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


@content_router.get("/pages/{page_key}", response_model=PageContentOut)
async def get_page_content(page_key: PageKey, session: SessionDep) -> PageContent:
    page = await session.scalar(select(PageContent).where(PageContent.page_key == page_key))
    if page is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail="Страница не найдена"
        )
    return page


# --- Корзина ---


@cart_router.get("", response_model=CartOut)
async def get_cart(session: SessionDep, response: Response, cart_id: CartCookie = None) -> CartOut:
    cart = await cart_service.get_or_create_cart(session, _parse_cart_id(cart_id))
    await session.commit()
    _set_cart_cookie(response, cart.id)
    return await cart_service.build_cart_view(session, cart)


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
    if not await cart_service.product_exists_and_active(session, data.product_id):
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Товар не найден")

    cart = await cart_service.get_or_create_cart(session, _parse_cart_id(cart_id))
    await cart_service.add_item(session, cart, data.product_id, data.quantity)
    await session.commit()
    await session.refresh(cart, ["items"])

    _set_cart_cookie(response, cart.id)
    return await cart_service.build_cart_view(session, cart)


@cart_router.patch("/items/{product_id}", response_model=CartOut)
async def update_cart_item(
    product_id: int,
    data: CartItemQuantityIn,
    session: SessionDep,
    response: Response,
    cart_id: CartCookie = None,
) -> CartOut:
    cart = await cart_service.get_or_create_cart(session, _parse_cart_id(cart_id))
    await cart_service.set_quantity(session, cart, product_id, data.quantity)
    await session.commit()
    await session.refresh(cart, ["items"])

    _set_cart_cookie(response, cart.id)
    return await cart_service.build_cart_view(session, cart)


@cart_router.delete("/items/{product_id}", response_model=CartOut)
async def delete_cart_item(
    product_id: int,
    session: SessionDep,
    response: Response,
    cart_id: CartCookie = None,
) -> CartOut:
    cart = await cart_service.get_or_create_cart(session, _parse_cart_id(cart_id))
    await cart_service.remove_item(session, cart, product_id)
    await session.commit()
    await session.refresh(cart, ["items"])

    _set_cart_cookie(response, cart.id)
    return await cart_service.build_cart_view(session, cart)


@cart_router.delete("", response_model=CartOut)
async def clear_cart(
    session: SessionDep, response: Response, cart_id: CartCookie = None
) -> CartOut:
    cart = await cart_service.get_or_create_cart(session, _parse_cart_id(cart_id))
    await cart_service.clear(session, cart)
    await session.commit()
    await session.refresh(cart, ["items"])

    _set_cart_cookie(response, cart.id)
    return await cart_service.build_cart_view(session, cart)


# --- Заказы ---


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
) -> OrderCreated:
    """Сумма пересчитывается на сервере по актуальным ценам — сумме от клиента не доверяем."""
    parsed = _parse_cart_id(cart_id)
    if parsed is None:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="Корзина пуста")

    cart = await cart_service.get_or_create_cart(session, parsed)

    try:
        order = await order_service.create_order(session, cart, data)
    except order_service.EmptyCartError:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST, detail="Корзина пуста"
        ) from None
    except order_service.UnavailableProductError as exc:
        raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail=str(exc)) from None
    except order_service.DateTooEarlyError as exc:
        # 422, а не 409: исправить нужно поле формы, а не содержимое корзины
        raise HTTPException(
            status_code=422,
            detail={"message": str(exc), "earliest_date": exc.earliest.isoformat()},
        ) from None

    # Собираем представление до очистки корзины: в нём названия товаров,
    # которые нужны в тексте уведомления
    order_view = await order_service.build_order_view(session, order)

    await cart_service.clear(session, cart)
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
    return OrderCreated(order_number=order.order_number)


@orders_router.get("/{order_number}", response_model=OrderOut)
async def get_order(order_number: str, session: SessionDep) -> OrderOut:
    """Публично по номеру заказа — номер содержит случайную часть, перебором не подобрать."""
    order = await order_service.get_order_by_number(session, order_number)
    if order is None:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Заказ не найден")
    return await order_service.build_order_view(session, order)
