"""Торты на заказ (008a): расчёт веса, ярусов и ориентира цены.

Одна функция на всё — «от X ₽» в карточке дизайна, калькулятор «Сколько нужно
торта» и ориентир в окне заявки. Раньше `price_from` вводили руками, и он
расходился с ценами за кг после их правки в настройках.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_CEILING, Decimal

from app.core.clock import local_today
from app.models.enums import CakeDecoration
from app.schemas.settings import BakerySettings

STEP_KG = Decimal("0.5")


@dataclass(frozen=True)
class Estimate:
    weight_kg: Decimal
    tiers: int
    price_per_kg: int
    price_from: int

    def snapshot(self) -> dict[str, object]:
        """Снапшот для заявки: JSON без Decimal."""
        return {
            "weight_kg": str(self.weight_kg),
            "tiers": self.tiers,
            "price_per_kg": self.price_per_kg,
            "price_from": self.price_from,
        }


def price_per_kg(settings: BakerySettings, decoration: CakeDecoration) -> int:
    return {
        CakeDecoration.CLASSIC: settings.cake_price_classic,
        CakeDecoration.CREAM_DRAWING: settings.cake_price_cream_drawing,
        CakeDecoration.MULTI_TIER: settings.cake_price_multi_tier,
    }[decoration]


def min_weight(settings: BakerySettings) -> Decimal:
    return Decimal(str(settings.cake_min_weight_kg))


def weight_for_guests(settings: BakerySettings, guests: int) -> Decimal:
    """Гости × граммы на гостя, вверх до 0,5 кг, не меньше минимального веса.

    Вверх, а не по правилам округления: торт на 41 гостя должен хватить всем.
    """
    raw = Decimal(guests * settings.cake_grams_per_guest) / 1000
    rounded = (raw / STEP_KG).to_integral_value(rounding=ROUND_CEILING) * STEP_KG
    return max(rounded, min_weight(settings))


def tiers_for_weight(settings: BakerySettings, weight_kg: Decimal) -> int:
    """Последняя строка таблицы «от N кг», до которой дотягивает вес."""
    tiers = settings.cake_tiers[0].tiers
    for step in settings.cake_tiers:
        if weight_kg >= Decimal(str(step.from_kg)):
            tiers = step.tiers
    return tiers


def estimate(
    settings: BakerySettings, guests: int, decoration: CakeDecoration = CakeDecoration.CLASSIC
) -> Estimate:
    weight = weight_for_guests(settings, guests)
    per_kg = price_per_kg(settings, decoration)
    # Цена за кг — целые рубли, вес — шаг 0,5 кг: произведение целое, ceil на всякий
    total = int((weight * per_kg).to_integral_value(rounding=ROUND_CEILING))
    return Estimate(
        weight_kg=weight,
        tiers=tiers_for_weight(settings, weight),
        price_per_kg=per_kg,
        price_from=total,
    )


def earliest_date(settings: BakerySettings) -> date:
    """Ближайшая дата праздника: сегодня по Москве + срок изготовления."""
    return local_today() + timedelta(days=settings.cake_lead_days)
