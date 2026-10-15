"""Настройки кондитерской (011c). Значения по умолчанию действуют, пока владелец
не сохранил свои: 10 000 ₽ и 30 гостей — решение заказчика от 01.10."""

from typing import Annotated, Self

from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator, model_validator

from app.models.enums import DeliveryInterval

DEFAULT_LARGE_ORDER_TOTAL = 10_000
DEFAULT_LARGE_EVENT_GUESTS = 30
DEFAULT_INSCRIPTION_PRICE = 300
DEFAULT_SLOT_CUTOFF_MINUTES = 60
# Доставка (007a, макет cart-checkout): 500 ₽, бесплатно от 5 000 ₽
DEFAULT_DELIVERY_PRICE = 500
DEFAULT_FREE_DELIVERY_FROM = 5_000
DEFAULT_DELIVERY_NOTE = (
    "Доставляем в пределах МКАД. За МКАД стоимость рассчитаем отдельно при подтверждении"
)
# В кадре доставки нет окна 18–21: курьер вечером не ездит. У самовывоза — все четыре
DEFAULT_DELIVERY_INTERVALS = [
    DeliveryInterval.I_09_12,
    DeliveryInterval.I_12_15,
    DeliveryInterval.I_15_18,
]
# Часы, когда отвечают на заказы: заказ вне их — «свяжемся утром после 9:00»
DEFAULT_WORK_HOURS_START = 9
DEFAULT_WORK_HOURS_END = 21

# Торты на заказ (008a, блок «Цены» макета custom-cakes.png)
DEFAULT_CAKE_PRICE_CLASSIC = 3_200
DEFAULT_CAKE_PRICE_CREAM_DRAWING = 3_800
DEFAULT_CAKE_PRICE_MULTI_TIER = 4_500
DEFAULT_CAKE_MIN_WEIGHT_KG = 2.0
DEFAULT_CAKE_LEAD_DAYS = 5
DEFAULT_CAKE_GRAMS_PER_GUEST = 150


class CakeTierStep(BaseModel):
    """Строка таблицы ярусов калькулятора: «от N кг — столько ярусов»."""

    model_config = ConfigDict(extra="forbid")

    # float, а не Decimal: иначе OpenAPI делит схему настроек на Input/Output.
    # Шаг 0,5 кг в float точен, расчёт переводит его в Decimal
    from_kg: Annotated[float, Field(ge=0, le=200, multiple_of=0.5)]
    tiers: Annotated[StrictInt, Field(ge=1, le=10)]


class CakeExtra(BaseModel):
    """Дополнение к торту в окне заявки: «Свечи — от 200 ₽»."""

    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, Field(min_length=1, max_length=60)]
    price: Annotated[StrictInt, Field(ge=0, le=100_000)]
    # «от 200 ₽» — цена зависит от выбора; без «от» — точная
    price_from: bool = False


# Кадры макета: 20 гостей → 3 кг, 1 ярус; 40 гостей → 6 кг, 3 яруса. Отсюда
# граница «от 6 кг — 3 яруса»; вторая — середина между ними
DEFAULT_CAKE_TIERS = [
    CakeTierStep(from_kg=0, tiers=1),
    CakeTierStep(from_kg=3.5, tiers=2),
    CakeTierStep(from_kg=6, tiers=3),
]
DEFAULT_CAKE_EXTRAS = [
    CakeExtra(name="Свечи", price=200, price_from=True),
    CakeExtra(name="Топпер с надписью", price=600, price_from=True),
    CakeExtra(name="Открытка", price=150),
]


class BakerySettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # StrictInt: «10000.5» или строка — ошибка, а не молчаливое округление
    large_order_total: Annotated[
        StrictInt,
        Field(gt=0, le=10_000_000, description="Крупный заказ — от этой суммы, ₽"),
    ] = DEFAULT_LARGE_ORDER_TOTAL
    large_event_guests: Annotated[
        StrictInt,
        Field(gt=0, le=10_000, description="Крупное событие в заявке — от этого числа гостей"),
    ] = DEFAULT_LARGE_EVENT_GUESTS
    # Цена надписи на шоколадной табличке — одна на весь сайт (005a). Её видят
    # покупатели на странице товара, поэтому настройка читается и публичным API
    inscription_price: Annotated[
        StrictInt,
        Field(ge=0, le=100_000, description="Надпись на шоколадной табличке, ₽"),
    ] = DEFAULT_INSCRIPTION_PRICE
    # Запас окна выдачи (005b): окно на сегодня закрывается за столько минут до
    # начала — кондитерской нужно собрать заказ, курьеру доехать
    slot_cutoff_minutes: Annotated[
        StrictInt,
        Field(ge=0, le=240, description="Закрывать окно выдачи за N минут до начала"),
    ] = DEFAULT_SLOT_CUTOFF_MINUTES
    # Доставка (007a). Стоимость считает одна функция — services/delivery.py
    delivery_price: Annotated[
        StrictInt, Field(ge=0, le=100_000, description="Доставка по Москве, ₽")
    ] = DEFAULT_DELIVERY_PRICE
    free_delivery_from: Annotated[
        StrictInt, Field(ge=0, le=10_000_000, description="Бесплатная доставка от суммы, ₽")
    ] = DEFAULT_FREE_DELIVERY_FROM
    delivery_note: Annotated[
        str, Field(min_length=1, max_length=300, description="Текст под «Доставка» в корзине")
    ] = DEFAULT_DELIVERY_NOTE
    delivery_intervals: Annotated[
        list[DeliveryInterval],
        Field(min_length=1, description="Окна доставки; у самовывоза — все окна"),
    ] = DEFAULT_DELIVERY_INTERVALS
    work_hours_start: Annotated[
        StrictInt, Field(ge=0, le=23, description="Отвечаем на заказы с, ч")
    ] = DEFAULT_WORK_HOURS_START
    work_hours_end: Annotated[
        StrictInt, Field(ge=1, le=24, description="Отвечаем на заказы до, ч")
    ] = DEFAULT_WORK_HOURS_END

    # Торты на заказ (008a): цены за кг по оформлению, минимальный вес, срок,
    # граммы на гостя, ярусы калькулятора, дополнения окна заявки
    cake_price_classic: Annotated[
        StrictInt, Field(gt=0, le=1_000_000, description="Классическое оформление, ₽ за кг")
    ] = DEFAULT_CAKE_PRICE_CLASSIC
    cake_price_cream_drawing: Annotated[
        StrictInt, Field(gt=0, le=1_000_000, description="Рисунок кремом, ₽ за кг")
    ] = DEFAULT_CAKE_PRICE_CREAM_DRAWING
    cake_price_multi_tier: Annotated[
        StrictInt, Field(gt=0, le=1_000_000, description="Многоярусный, ₽ за кг")
    ] = DEFAULT_CAKE_PRICE_MULTI_TIER
    cake_min_weight_kg: Annotated[
        float,
        Field(gt=0, le=100, multiple_of=0.5, description="Минимальный вес торта, кг"),
    ] = DEFAULT_CAKE_MIN_WEIGHT_KG
    cake_lead_days: Annotated[
        StrictInt, Field(ge=1, le=90, description="Торт на заказ — не раньше чем через N дней")
    ] = DEFAULT_CAKE_LEAD_DAYS
    cake_grams_per_guest: Annotated[
        StrictInt, Field(ge=50, le=1000, description="Граммов торта на гостя")
    ] = DEFAULT_CAKE_GRAMS_PER_GUEST
    cake_tiers: Annotated[
        list[CakeTierStep], Field(min_length=1, max_length=10, description="Ярусы по весу")
    ] = DEFAULT_CAKE_TIERS
    cake_extras: Annotated[
        list[CakeExtra], Field(max_length=20, description="Дополнения в окне заявки")
    ] = DEFAULT_CAKE_EXTRAS

    @field_validator("cake_tiers")
    @classmethod
    def _tiers_from_zero(cls, steps: list[CakeTierStep]) -> list[CakeTierStep]:
        # По возрастанию веса, первая строка — с нуля: иначе у лёгкого торта
        # не нашлось бы числа ярусов
        steps = sorted(steps, key=lambda step: step.from_kg)
        if steps[0].from_kg != 0:
            raise ValueError("Первая строка ярусов — от 0 кг")
        if len({step.from_kg for step in steps}) != len(steps):
            raise ValueError("Вес в таблице ярусов не должен повторяться")
        return steps

    @field_validator("delivery_intervals")
    @classmethod
    def _ordered_intervals(cls, values: list[DeliveryInterval]) -> list[DeliveryInterval]:
        # Порядок — как в сетке дня, без повторов: так их и показывает форма
        return [interval for interval in DeliveryInterval if interval in values]

    @model_validator(mode="after")
    def _work_hours(self) -> Self:
        if self.work_hours_start >= self.work_hours_end:
            raise ValueError("Начало рабочего дня должно быть раньше конца")
        return self
