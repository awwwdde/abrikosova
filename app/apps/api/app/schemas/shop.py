"""Схемы корзины, заказов, заявок, галереи, отзывов и контента страниц."""

import re
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Any, Literal, Self

from email_validator import EmailNotValidError, validate_email
from fastapi import UploadFile
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.clock import local_today
from app.models.enums import (
    ContactMethod,
    DeliveryInterval,
    DeliveryMethod,
    GalleryOccasion,
    Occasion,
    OrderStatus,
    PageKey,
)
from app.schemas.catalog import FillingOut, ReviewOut
from app.schemas.common import PHONE_PATTERN, ConsentMixin, HoneypotMixin, PersonName, Phone
from app.schemas.pages import (
    AboutContent,
    ContactsContent,
    CustomCakesContent,
    GalleryContent,
    HomeContent,
    LegalContent,
)

__all__ = ["ReviewOut"]  # переэкспорт: схема живёт в catalog, её отдают и /reviews, и карточка

# Надпись на шоколадной табличке: по макету 09.10 (006b) — «До 24 знаков».
# Колонки в БД остаются String(30): уже сохранённые строки не трогаем
INSCRIPTION_MAX_LENGTH = 24

# --- Галерея, отзывы, страницы ---


class LoginPhotoOut(BaseModel):
    """Фото для страницы входа в админку: работа из «Примеров работ» или главное
    фото товара. Только ключ картинки и название — ничего о покупателях."""

    image_key: str
    caption: str
    kind: Literal["work", "product"]
    # Натуральный размер — страница показывает фото не крупнее него (без размытия)
    width: int
    height: int
    # Цвет фона снимка (#RRGGBB): им красится панель вокруг фото
    bg: str = Field(pattern=r"^#[0-9A-F]{6}$")


class GalleryItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    image_key: str
    detail_image_key: str | None
    caption: str
    description: str | None
    occasion: Occasion | None
    tiers: int | None
    weight_grams: int | None
    guests: int | None
    made_in: date | None


class PageContentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    page_key: PageKey
    content: dict[str, Any]
    address: str | None = None
    phone: str | None = None
    work_hours_weekdays: str | None = None
    work_hours_weekend: str | None = None
    delivery_hours: str | None = None
    map_embed_code: str | None = None
    yandex_rating: Decimal | None = None
    yandex_reviews_count: int | None = None
    yandex_maps_url: str | None = None
    telegram_url: str | None = None


class HomePageOut(PageContentOut):
    """`GET /pages/home`: тот же ответ, но `content` описан схемой."""

    content: HomeContent  # type: ignore[assignment]


class ContactsPageOut(PageContentOut):
    """`GET /pages/contacts`: тот же ответ, но `content` описан схемой."""

    content: ContactsContent  # type: ignore[assignment]


class AboutPageOut(PageContentOut):
    content: AboutContent  # type: ignore[assignment]


class CustomCakesContentPageOut(PageContentOut):
    """`GET /pages/custom_cakes`: контент «Тортов на заказ» со схемой — его читает
    мега-меню шапки на каждой странице (014)."""

    content: CustomCakesContent  # type: ignore[assignment]


class GalleryPageOut(PageContentOut):
    """`GET /pages/gallery`: тексты страницы «Работы» (009)."""

    content: GalleryContent  # type: ignore[assignment]


class GalleryFacet(BaseModel):
    """«Таблетка» фильтра «Работ»: повод (или группа поводов) и число работ."""

    value: GalleryOccasion
    label: str
    count: int


class LegalPageOut(PageContentOut):
    """`GET /pages/legal`: даты редакции правовых документов (010b)."""

    content: LegalContent  # type: ignore[assignment]


class CustomCakeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    price_from: Decimal
    image_key: str


class CustomCakesPageOut(BaseModel):
    cakes: list[CustomCakeOut]
    fillings: list[FillingOut]
    page: PageContentOut | None


# --- Корзина ---


class CartItemIn(BaseModel):
    """Добавление в корзину: вариант (у пирожного он единственный) и надпись.

    Надпись — до 24 символов после обрезки пробелов; пустая строка — без надписи.
    К товару без «можно надпись» надпись не принимается (422).
    """

    model_config = ConfigDict(extra="forbid")

    variant_id: int
    quantity: Annotated[int, Field(ge=1, le=99)] = 1
    inscription_text: Annotated[str | None, Field(default=None, max_length=60)]

    @field_validator("inscription_text")
    @classmethod
    def _inscription(cls, value: str | None) -> str | None:
        # Длина проверяется после обрезки: « С днём рождения » — это 16 символов,
        # а не 18. Сырой ввод ограничен 60, чтобы не принимать мегабайт пробелов
        text = (value or "").strip()
        if len(text) > INSCRIPTION_MAX_LENGTH:
            raise ValueError(f"Надпись — не больше {INSCRIPTION_MAX_LENGTH} символов")
        return text or None


class CartItemQuantityIn(BaseModel):
    """Правка строки корзины: количество и/или надпись (007a, кадр «Правка надписи»).

    Поле, которого нет в запросе, не меняется. `inscription_text: null` или пустая
    строка — снять надпись; правила те же, что при добавлении (24 знака после обрезки).
    """

    model_config = ConfigDict(extra="forbid")

    # 0 и меньше — удаление позиции (02-api-contract.md)
    quantity: Annotated[int | None, Field(default=None, ge=0, le=99)]
    inscription_text: Annotated[str | None, Field(default=None, max_length=60)]

    @field_validator("inscription_text")
    @classmethod
    def _inscription(cls, value: str | None) -> str | None:
        text = (value or "").strip()
        if len(text) > INSCRIPTION_MAX_LENGTH:
            raise ValueError(f"Надпись — не больше {INSCRIPTION_MAX_LENGTH} символов")
        return text or None

    @model_validator(mode="after")
    def _something(self) -> Self:
        if not self.model_fields_set & {"quantity", "inscription_text"}:
            raise ValueError("Укажите количество или надпись")
        return self


class CartItemOut(BaseModel):
    # id строки: по нему меняют количество и удаляют — товар и даже вариант
    # строку уже не определяют (тот же вариант с другой надписью — другая строка)
    id: int
    product_id: int
    variant_id: int
    name: str
    slug: str
    variant_label: str
    # Больше одного активного варианта — подпись варианта стоит показать
    # («Медовик целый, 2 кг»); у пирожного с единственным «100 г» она лишняя
    has_variants: bool
    # Торт (раздел «Торты»): у торта вес в строке пишется всегда — «Три шоколада, 1,4 кг»,
    # как блок «Вес» на странице товара (007b)
    is_cake: bool
    # «Изменить» в корзине — и у строки без надписи, если надпись к товару можно (007b)
    allows_inscription: bool
    # Цена варианта за штуку, без надписи
    price: Decimal
    inscription_text: str | None
    inscription_price: Decimal | None
    quantity: int
    line_total: Decimal
    main_image: str | None
    is_available: bool
    lead_time_days: int


class SlotIntervalOut(BaseModel):
    interval: DeliveryInterval
    available: bool


class SlotDayOut(BaseModel):
    """День в форме «Дата и время»: «Сегодня», «Завтра», «Пт» и окна способа."""

    date: date
    label: str
    available: bool
    intervals: list[SlotIntervalOut]


class CartSlotsOut(BaseModel):
    """7 дней для каждого способа получения: у доставки нет окна 18–21 (007a)."""

    pickup: list[SlotDayOut]
    delivery: list[SlotDayOut]


class EarliestReasonOut(BaseModel):
    """Позиция, которая сдвинула раннюю дату: «Три шоколада, 1,4 кг готовится
    2 дня, поэтому весь заказ можно получить с 9 октября». Текст собирает фронт."""

    name: str
    variant_label: str
    has_variants: bool
    lead_time_days: int


class CartOut(BaseModel):
    items: list[CartItemOut]
    total_items: int
    # Сумма позиций без доставки. total_price — то же самое (было до 007a, оставлено
    # для совместимости); итог с доставкой фронт берёт как subtotal + delivery_price_*
    subtotal: Decimal
    total_price: Decimal
    # Доставка для каждого способа (007a): самовывоз 0, доставка — по сумме позиций
    delivery_price_pickup: Decimal
    delivery_price_delivery: Decimal
    free_delivery_from: Decimal
    # Сколько не хватает до бесплатной доставки: «До бесплатной доставки 3 360 ₽»
    free_delivery_left: Decimal
    delivery_note: str
    # Самая ранняя дата, к которой можно получить весь заказ (самовывоз): сегодня плюс
    # наибольший срок изготовления среди позиций. Бэкенд проверяет её же при создании заказа.
    earliest_date: date
    # Позиция, из-за которой ранняя дата позже сегодняшнего дня; null — сдвига нет
    earliest_reason: EarliestReasonOut | None
    slots: CartSlotsOut
    # «Мы свяжемся в течение 30 минут с 9:00 до 21:00» в «Ваш заказ» (007b) — из настроек
    work_hours_start: int
    work_hours_end: int


# --- Заказы ---


EMAIL_ERROR = "Укажите почту, пришлём на неё копию заказа"
ShortText = Annotated[str | None, Field(default=None, max_length=20)]


class OrderCreate(ConsentMixin, HoneypotMixin):
    customer_name: PersonName
    customer_phone: Phone
    # Почта обязательна для новых заказов (007a): на неё уходит копия заказа.
    # У старых заказов её нет — поэтому обязательность здесь, а не в БД
    customer_email: Annotated[str, Field(max_length=254)]
    # «Как связаться для подтверждения»
    contact_method: ContactMethod = ContactMethod.CALL
    customer_comment: Annotated[str | None, Field(default=None, max_length=2000)]
    delivery_method: DeliveryMethod
    # «Улица и дом»; квартира, подъезд и этаж — отдельно
    delivery_address: Annotated[str | None, Field(default=None, max_length=500)]
    address_apartment: ShortText
    address_entrance: ShortText
    address_floor: ShortText
    courier_comment: Annotated[str | None, Field(default=None, max_length=500)]
    # «Получит другой человек»: тогда имя и телефон получателя обязательны
    other_recipient: bool = False
    recipient_name: Annotated[str | None, Field(default=None, max_length=200)]
    recipient_phone: Annotated[str | None, Field(default=None, max_length=20)]
    # Дата и окно обязательны всегда (007b): кондитеру нужно знать, когда человек
    # придёт или когда везти, даже если всё есть на витрине сегодня
    desired_date: date
    delivery_interval: DeliveryInterval

    @field_validator("customer_email")
    @classmethod
    def _email(cls, value: str) -> str:
        # Проверка формата без DNS: письмо всё равно может не дойти, а форма не должна
        # ждать сеть. Текст ошибки — с макета «Ошибки в форме»
        try:
            return validate_email(value.strip(), check_deliverability=False).normalized
        except EmailNotValidError:
            raise ValueError(EMAIL_ERROR) from None

    @model_validator(mode="after")
    def _recipient(self) -> Self:
        if not self.other_recipient:
            self.recipient_name = None
            self.recipient_phone = None
            return self
        name = (self.recipient_name or "").strip()
        phone = (self.recipient_phone or "").strip()
        if len(name) < 2:
            raise ValueError("Укажите имя получателя")
        if not re.fullmatch(PHONE_PATTERN, phone):
            raise ValueError("Укажите телефон получателя")
        self.recipient_name, self.recipient_phone = name, phone
        return self

    @model_validator(mode="after")
    def _address_required_for_delivery(self) -> Self:
        is_delivery = self.delivery_method is DeliveryMethod.DELIVERY
        if is_delivery and not (self.delivery_address or "").strip():
            raise ValueError("При доставке адрес обязателен")
        return self

    @model_validator(mode="after")
    def _desired_date_not_in_past(self) -> Self:
        if self.desired_date and self.desired_date < local_today():
            raise ValueError("Желаемая дата не может быть в прошлом")
        return self


class OrderItemOut(BaseModel):
    product_id: int
    # Снапшоты на момент заказа — не меняются при переименовании товара и варианта
    name: str
    variant_label: str
    quantity: int
    price: Decimal
    inscription_text: str | None
    inscription_price: Decimal | None
    line_total: Decimal


class OrderOut(BaseModel):
    order_number: str
    customer_name: str
    customer_phone: str
    customer_comment: str | None
    delivery_method: DeliveryMethod
    delivery_address: str | None
    desired_date: date | None
    delivery_interval: DeliveryInterval | None
    total_price: Decimal
    status: OrderStatus
    created_at: datetime
    items: list[OrderItemOut]


class OrderConfirmationOut(BaseModel):
    """Страница «Заказ принят» (007a). Открывается по номеру и токену из ссылки,
    без входа, поэтому телефон и почта — в маске: «+7 (916) ***-**-67», «an***@mail.ru».
    Имени покупателя и получателя здесь нет: странице они не нужны."""

    order_number: str
    status: OrderStatus
    created_at: datetime
    contact_method: ContactMethod | None
    phone_masked: str
    email_masked: str | None
    delivery_method: DeliveryMethod
    delivery_address: str | None
    address_apartment: str | None
    address_entrance: str | None
    address_floor: str | None
    desired_date: date | None
    delivery_interval: DeliveryInterval | None
    items: list[OrderItemOut]
    subtotal: Decimal
    delivery_price: Decimal
    total_price: Decimal
    # Заказ пришёл вне часов ответа (по Москве): «свяжемся утром после 9:00»
    after_hours: bool
    work_hours_start: int
    work_hours_end: int


class OrderCreated(OrderConfirmationOut):
    """Ответ оформления: всё для страницы «Заказ принят» и токен её адреса
    `/order/<номер>?t=<token>` (HMAC, 7 дней)."""

    token: str


# --- Заявки ---


class ConsultationCreate(ConsentMixin, HoneypotMixin):
    """Заявка на торт под событие (путь 2 из PDF «Этап 1», раздел 13).

    Приходит как multipart/form-data: вместе с полями может ехать фото-референс.
    Повод, дата и гости необязательны — человек может не знать их на старте,
    но если знает, Елене не придётся переспрашивать.
    """

    name: PersonName
    phone: Phone
    description: Annotated[str | None, Field(default=None, max_length=2000)]
    occasion: Occasion | None = None
    event_date: date | None = None
    guests_count: Annotated[int | None, Field(default=None, ge=1, le=1000)]

    @model_validator(mode="after")
    def _event_date_not_in_past(self) -> Self:
        if self.event_date and self.event_date < local_today():
            raise ValueError("Дата события не может быть в прошлом")
        return self


class ConsultationForm(ConsultationCreate):
    """Та же заявка в виде multipart-формы — с необязательным файлом.

    Файл объявлен внутри модели, а не отдельным параметром эндпоинта:
    FastAPI разворачивает форму-модель в плоские поля только тогда, когда
    она единственный параметр тела запроса.
    """

    reference: UploadFile | None = None


class FeedbackCreate(ConsentMixin, HoneypotMixin):
    name: PersonName
    phone: Phone
    message: Annotated[str | None, Field(default=None, max_length=2000)]


class RequestAccepted(BaseModel):
    id: int
    message: str = "Заявка отправлена, свяжемся с вами в ближайшее время"


CustomCakesPageOut.model_rebuild()
