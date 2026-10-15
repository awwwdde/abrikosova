"""Схемы «Тортов на заказ» (008a): дизайны, страница, калькулятор, заявка."""

from datetime import date
from decimal import Decimal
from typing import Annotated, Self

from email_validator import EmailNotValidError, validate_email
from fastapi import UploadFile
from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.enums import (
    CakeDecoration,
    CakeImageRole,
    ContactMethod,
    DeliveryMethod,
    DietaryTag,
    GalleryOccasion,
    RequestOccasion,
)
from app.schemas.common import ConsentMixin, HoneypotMixin, PersonName, Phone
from app.schemas.pages import CakeStage

DECORATION_LABELS: dict[CakeDecoration, str] = {
    CakeDecoration.CLASSIC: "Классическое оформление",
    CakeDecoration.CREAM_DRAWING: "Рисунок кремом",
    CakeDecoration.MULTI_TIER: "Многоярусный",
}
# Пояснения под ценой в блоке «Цены»
DECORATION_NOTES: dict[CakeDecoration, str] = {
    CakeDecoration.CLASSIC: "Крем, свежие ягоды, шоколадный декор",
    CakeDecoration.CREAM_DRAWING: "Рисунок, надпись, цветы из крема",
    CakeDecoration.MULTI_TIER: "Два яруса и больше, опоры, сборка",
}
# Метка над названием карточки: «СВАДЬБА»
CAKE_OCCASION_LABELS: dict[GalleryOccasion, str] = {
    GalleryOccasion.WEDDING: "Свадьба",
    GalleryOccasion.BIRTHDAY: "День рождения",
    GalleryOccasion.KIDS: "Детский",
    GalleryOccasion.ANNIVERSARY_CORPORATE: "Юбилей и корпоратив",
}
REQUEST_OCCASION_LABELS: dict[RequestOccasion, str] = {
    RequestOccasion.WEDDING: "Свадьба",
    RequestOccasion.BIRTHDAY: "День рождения",
    RequestOccasion.KIDS: "Детский",
    RequestOccasion.ANNIVERSARY_CORPORATE: "Юбилей и корпоратив",
    RequestOccasion.OTHER: "Другое",
}
IMAGE_ROLE_LABELS: dict[CakeImageRole, str] = {
    CakeImageRole.WHOLE: "Целиком",
    CakeImageRole.CUT: "Срез",
    CakeImageRole.DETAIL: "Деталь",
    CakeImageRole.SIDE: "Сбоку",
}

EMAIL_ERROR = "Укажите почту, пришлём на неё копию заявки"


class CustomCakeImageOut(BaseModel):
    storage_key: str
    role: CakeImageRole | None
    role_label: str | None


class CustomCakeCard(BaseModel):
    """Карточка списка: «СВАДЬБА · Белый с пионами · 3 яруса · от 40 гостей · от 27 000 ₽»."""

    id: int
    slug: str
    title: str
    subtitle: str | None
    occasion: GalleryOccasion
    occasion_label: str
    tiers: int
    min_guests: int
    decoration: CakeDecoration
    price_from: int
    # Обложка — первое фото; нет фото — плашка на сайте
    image_key: str | None


class CakeFacet(BaseModel):
    """«Таблетка» фильтра поводов — тот же набор, что у «Работ» (009)."""

    value: GalleryOccasion
    label: str
    count: int


class CustomCakeListOut(BaseModel):
    items: list[CustomCakeCard]
    total: int
    facets: list[CakeFacet]


class EstimateOut(BaseModel):
    """Калькулятор «Сколько нужно торта» и ориентир окна заявки."""

    guests: int
    weight_kg: Decimal
    tiers: int
    decoration: CakeDecoration
    price_per_kg: int
    price_from: int


class CakeSpecs(BaseModel):
    """Таблица на странице дизайна: «Оформление / Минимальный вес / Ярусы / Начинка»."""

    decoration_label: str
    price_per_kg: int
    min_weight_kg: Decimal
    tiers: int
    filling_note: str


class CustomCakeDetailOut(CustomCakeCard):
    description: str
    images: list[CustomCakeImageOut]
    specs: CakeSpecs
    # Ориентир для минимума гостей дизайна: «Вес 6 кг · 3 яруса»
    estimate: EstimateOut
    lead_days: int
    earliest_date: date
    others: list[CustomCakeCard]


class LabeledValue(BaseModel):
    """Факт «от 2 кг — минимальный вес» и факты под «Как заказать»."""

    value: str
    label: str


class CakePriceOut(BaseModel):
    decoration: CakeDecoration
    label: str
    price_per_kg: int
    note: str


class FillingCardOut(BaseModel):
    id: int
    name: str
    # Строка под названием: короткое описание, если оно есть, иначе полное
    short_description: str
    description: str
    image_key: str
    dietary: list[DietaryTag]
    dietary_labels: list[str]


class TastingSetOut(BaseModel):
    """Плашка «Дегустационный сет» — обычный товар каталога в скрытом разделе."""

    product_id: int
    variant_id: int
    slug: str
    name: str
    description: str
    price: Decimal


class CakeFaqItem(BaseModel):
    question: str
    answer: str


class CakeExtraOut(BaseModel):
    name: str
    price: int
    price_from: bool


class OccasionOption(BaseModel):
    value: RequestOccasion
    label: str


class CustomCakesInfoOut(BaseModel):
    """`GET /custom-cakes/info`: всё для страницы, кроме сетки дизайнов."""

    title: str | None
    subtitle: str | None
    # Бордовая ячейка «Торт по вашей идее» и тексты калькулятора (008b)
    idea_text: str | None
    calculator_text: str | None
    calculator_note: str | None
    facts: list[LabeledValue]
    prices_intro: str | None
    prices: list[CakePriceOut]
    prices_note: str | None
    fillings_intro: str | None
    fillings: list[FillingCardOut]
    fillings_more: bool
    tasting_set: TastingSetOut | None
    stages: list[CakeStage]
    order_facts: list[LabeledValue]
    faq: list[CakeFaqItem]
    # Для калькулятора и окна заявки
    min_weight_kg: Decimal
    lead_days: int
    grams_per_guest: int
    earliest_date: date
    extras: list[CakeExtraOut]
    occasions: list[OccasionOption]


class GalleryWorkOut(BaseModel):
    """`GET /gallery/{id}` — работа как образец в окне заявки («Заказать похожий»)."""

    id: int
    caption: str
    image_key: str
    occasion_label: str | None
    tiers: int | None
    guests: int | None


# --- Заявка ---


class ConsultationIn(ConsentMixin, HoneypotMixin):
    """Заявка на торт (окно заявки 008a). Приходит multipart: поля + до 5 фото.

    Дата не раньше чем через `cake_lead_days` проверяется в эндпоинте: срок —
    настройка из базы, а схема о базе не знает.
    """

    name: PersonName
    phone: Phone
    email: Annotated[str, Field(max_length=254)]
    contact_method: ContactMethod = ContactMethod.CALL
    occasion: RequestOccasion
    event_date: date
    guests_count: Annotated[int, Field(ge=1, le=1000)]
    # Выбранный дизайн или работа «Заказать похожий»; ни того ни другого — свой дизайн
    design_id: int | None = None
    gallery_item_id: int | None = None
    # Пусто — «Помогите выбрать»
    filling_id: int | None = None
    wishes: Annotated[str | None, Field(default=None, max_length=2000)]
    # Названия дополнений из настроек; цену сервер берёт сам
    extras: Annotated[list[str], Field(default_factory=list, max_length=20)]
    delivery_method: DeliveryMethod = DeliveryMethod.PICKUP

    @field_validator("email")
    @classmethod
    def _email(cls, value: str) -> str:
        try:
            return validate_email(value.strip(), check_deliverability=False).normalized
        except EmailNotValidError:
            raise ValueError(EMAIL_ERROR) from None

    @model_validator(mode="after")
    def _one_sample(self) -> Self:
        if self.design_id is not None and self.gallery_item_id is not None:
            raise ValueError("Выберите дизайн или работу-образец, а не оба сразу")
        return self


class ConsultationForm(ConsultationIn):
    """Та же заявка multipart-формой с файлами. Файлы внутри модели: FastAPI
    разворачивает форму-модель в плоские поля, только когда она — единственный
    параметр тела."""

    references: list[UploadFile] = []


class ConsultationAccepted(BaseModel):
    """«Заявка принята»: номер, «Белый с пионами, свадьба, 24 октября», маски контактов."""

    id: int
    number: str
    title: str
    phone_masked: str
    email_masked: str
    contact_method: ContactMethod
    estimate: EstimateOut
