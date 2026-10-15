"""Окна выдачи: когда заказ можно получить (задание 005a).

Одна логика на три места: «самая ранняя дата» в корзине, проверка даты
и интервала при оформлении заказа и «Можно забрать сегодня · ближайшее окно
15:00–18:00» на странице товара. Если бы карточка считала по-своему, она
обещала бы окно, которое потом не примет оформление.

Правила:

* заказ отдаётся целиком, поэтому решает самая долгая позиция: пирожное
  в наличии и торт «за три дня» в одной корзине — это заказ через три дня;
* окно на сегодня можно выбрать, пока до его начала больше запаса
  `slot_cutoff_minutes` из настроек (по умолчанию 60 минут — собрать заказ
  и доехать): в 13:30 ближайшее — 15:00–18:00, в 14:30 уже 18:00–21:00,
  а вечером окон на сегодня нет, и ближайшее — завтра с 09:00;
* выходных нет: кондитерская работает каждый день (подвал макета:
  «Каждый день с 9:00»). Появятся выходные — их нужно учесть здесь;
* у способов получения свои окна (007a): у доставки нет вечернего 18–21
  (`delivery_intervals` в настройках), у самовывоза — все. Функции принимают
  набор окон способа; по умолчанию — все окна дня.

Время — по часам кондитерской (`core/clock.py`), а не сервера в UTC.
Запас передаётся явно, без значения по умолчанию: ни одно из трёх мест не
должно молча считать по своему запасу вместо настройки владелицы.
"""

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from app.core import clock
from app.models.enums import DeliveryInterval


@dataclass(frozen=True, slots=True)
class Slot:
    date: date
    interval: DeliveryInterval


def interval_start(interval: DeliveryInterval) -> time:
    """«09-12» → 09:00."""
    return time(int(interval.value.split("-")[0]))


def is_open(
    day: date,
    interval: DeliveryInterval,
    now: datetime,
    cutoff_minutes: int,
) -> bool:
    """Окно ещё можно выбрать: до его начала больше `cutoff_minutes` минут.

    Ровно за `cutoff_minutes` окно уже закрыто: запас — это время, которое
    нужно кондитерской, и отдавать его целиком нельзя.
    """
    start = datetime.combine(day, interval_start(interval), tzinfo=now.tzinfo)
    return start - timedelta(minutes=cutoff_minutes) > now


ALL_INTERVALS: tuple[DeliveryInterval, ...] = tuple(DeliveryInterval)


def nearest_slot(
    lead_times: Iterable[int],
    cutoff_minutes: int,
    intervals: Sequence[DeliveryInterval] = ALL_INTERVALS,
) -> Slot:
    """Ближайшее окно, к которому успеют все позиции.

    Сначала день готовности самой долгой позиции; если окна этого дня уже
    начались — следующий день. На следующий день открыты все окна, потому что
    он целиком в будущем. `intervals` — окна способа получения.
    """
    now = clock.local_now()
    ready = now.date() + timedelta(days=max(lead_times, default=0))
    for interval in intervals:
        if is_open(ready, interval, now, cutoff_minutes):
            return Slot(ready, interval)
    return Slot(ready + timedelta(days=1), intervals[0])


def earliest_date(
    lead_times: Iterable[int],
    cutoff_minutes: int,
    intervals: Sequence[DeliveryInterval] = ALL_INTERVALS,
) -> date:
    """Самая ранняя дата получения — день ближайшего окна."""
    return nearest_slot(lead_times, cutoff_minutes, intervals).date


class IntervalNotOfferedError(Exception):
    """Окна нет у этого способа получения: курьер не возит в 18–21."""


def check_slot(
    lead_times: Iterable[int],
    day: date,
    interval: DeliveryInterval | None,
    cutoff_minutes: int,
    intervals: Sequence[DeliveryInterval] = ALL_INTERVALS,
) -> Slot | None:
    """Проверка выбора покупателя. None — подходит, иначе ближайшее окно.

    Дата не раньше ближайшего окна; если выбран интервал в день ближайшего
    окна — он не раньше этого окна. Без интервала проверяется только дата:
    время тогда согласуют по телефону. Окно не из `intervals` —
    IntervalNotOfferedError.
    """
    if interval is not None and interval not in intervals:
        raise IntervalNotOfferedError
    nearest = nearest_slot(list(lead_times), cutoff_minutes, intervals)
    if day < nearest.date:
        return nearest
    if interval is not None and day == nearest.date:
        order = list(DeliveryInterval)
        if order.index(interval) < order.index(nearest.interval):
            return nearest
    return None


WEEKDAYS = ("Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс")


@dataclass(frozen=True, slots=True)
class DayOption:
    date: date
    label: str
    available: bool
    intervals: list[tuple[DeliveryInterval, bool]]


def week(
    lead_times: Iterable[int],
    cutoff_minutes: int,
    intervals: Sequence[DeliveryInterval] = ALL_INTERVALS,
    days: int = 7,
) -> list[DayOption]:
    """Дни для формы «Дата и время» (007a): `days` дней с сегодняшнего, у каждого —
    подпись («Сегодня», «Завтра», «Пт») и окна способа с признаком «можно выбрать».

    Доступность окна — та же `check_slot`, что проверяет заказ: форма не предложит
    того, что не примет оформление. День доступен, если доступно хоть одно окно.
    """
    leads = list(lead_times)
    today = clock.local_today()
    result: list[DayOption] = []
    for offset in range(days):
        day = today + timedelta(days=offset)
        label = "Сегодня" if offset == 0 else "Завтра" if offset == 1 else WEEKDAYS[day.weekday()]
        options = [
            (interval, check_slot(leads, day, interval, cutoff_minutes, intervals) is None)
            for interval in intervals
        ]
        result.append(DayOption(day, label, any(ok for _, ok in options), options))
    return result
