/**
 * Чистые функции главной админки (задание 011b): даты, проценты, подписи.
 * Без React — покрыты тестами в lib/admin-dashboard.test.ts.
 *
 * Даты приходят от бэкенда днями кондитерской («2026-10-01»), а «сейчас» — со
 * смещением её часового пояса («…T12:00:00+03:00»). Поэтому дни форматируем
 * как UTC-даты (без пересчёта в пояс браузера), а время событий сдвигаем на
 * смещение кондитерской: менеджер в другом городе видит то же время, что Елена.
 */

import { pluralRu } from "./format";

const MS_DAY = 24 * 60 * 60 * 1000;

/** «2026-10-01» → Date в полночь UTC (для форматирования без часового пояса). */
export function isoDay(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}

export function addDays(iso: string, days: number): string {
  return new Date(isoDay(iso).getTime() + days * MS_DAY).toISOString().slice(0, 10);
}

function format(iso: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("ru-RU", { ...options, timeZone: "UTC" }).format(isoDay(iso));
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** «1 октября» */
export function dayMonth(iso: string): string {
  return format(iso, { day: "numeric", month: "long" });
}

/** «Чт, 2 октября» */
export function weekdayDayMonth(iso: string): string {
  return `${capitalize(format(iso, { weekday: "short" }))}, ${dayMonth(iso)}`;
}

/** «Четверг, 1 октября» */
export function longDate(iso: string): string {
  return `${capitalize(format(iso, { weekday: "long" }))}, ${dayMonth(iso)}`;
}

/** «Октябрь 2026» */
export function monthTitle(month: string): string {
  return capitalize(format(`${month}-01`, { month: "long", year: "numeric" }).replace(" г.", ""));
}

/** «25 сентября – 1 октября» (одним месяцем — «23–29 сентября»). */
export function periodLabel(start: string, end: string): string {
  if (start.slice(0, 7) === end.slice(0, 7)) {
    return `${format(start, { day: "numeric" })}–${dayMonth(end)}`;
  }
  return `${dayMonth(start)} – ${dayMonth(end)}`;
}

/** Смещение часового пояса из «2026-10-01T12:00:00+03:00», в минутах. */
export function offsetMinutes(isoWithOffset: string): number {
  const match = /([+-])(\d{2}):?(\d{2})$/.exec(isoWithOffset);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

/** Момент времени → «ГГГГ-ММ-ДД» и «ЧЧ:ММ» по часам кондитерской. */
export function localParts(isoMoment: string, offset: number): { day: string; time: string } {
  const shifted = new Date(new Date(isoMoment).getTime() + offset * 60_000).toISOString();
  return { day: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}

/**
 * Когда это было: «10:42» сегодня, «вчера», «28 сентября» раньше.
 * Для заявок — «2 ч назад»: там важно, сколько человек ждёт ответа.
 */
export function whenLabel(
  isoMoment: string,
  nowIso: string,
  style: "clock" | "ago" = "clock",
): string {
  const offset = offsetMinutes(nowIso);
  const event = localParts(isoMoment, offset);
  const today = nowIso.slice(0, 10);
  if (event.day === today) {
    if (style === "clock") return event.time;
    const minutes = Math.max(
      0,
      Math.round((new Date(nowIso).getTime() - new Date(isoMoment).getTime()) / 60_000),
    );
    if (minutes < 1) return "только что";
    if (minutes < 60) return `${minutes} мин назад`;
    return `${Math.floor(minutes / 60)} ч назад`;
  }
  if (event.day === addDays(today, -1)) return "вчера";
  return format(event.day, { day: "numeric", month: "long" });
}

/** Утро, день, вечер, ночь — по часам кондитерской. */
export function greeting(nowIso: string): string {
  const hour = Number(nowIso.slice(11, 13));
  if (hour >= 5 && hour < 12) return "Доброе утро";
  if (hour >= 12 && hour < 18) return "Добрый день";
  if (hour >= 18 && hour < 23) return "Добрый вечер";
  return "Доброй ночи";
}

/** Изменение в процентах к прошлому периоду; null — сравнивать не с чем. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** «09-12» → «09:00–12:00» */
export function intervalLabel(interval: string | null | undefined): string {
  if (!interval) return "Время не выбрано";
  const [from, to] = interval.split("-");
  return `${from}:00–${to}:00`;
}

/** «Мария Смирнова» → «Мария С.» — фамилию на общем экране целиком не показываем. */
export function shortName(full: string): string {
  const [first, second] = full.trim().split(/\s+/);
  if (!first) return full;
  return second ? `${first} ${second.charAt(0).toUpperCase()}.` : first;
}

export function ordersCount(n: number): string {
  return `${n} ${pluralRu(n, ["заказ", "заказа", "заказов"])}`;
}

/**
 * Недели месяца для календаря, с понедельника. Дни соседних месяцев — null
 * в начале и в конце, чтобы сетка всегда была из полных недель.
 */
export function monthGrid(month: string): (string | null)[][] {
  const first = isoDay(`${month}-01`);
  const shift = (first.getUTCDay() + 6) % 7; // понедельник — 0
  const days: (string | null)[] = Array.from({ length: shift }, () => null);
  for (let day = first; day.getUTCMonth() === first.getUTCMonth();) {
    days.push(day.toISOString().slice(0, 10));
    day = new Date(day.getTime() + MS_DAY);
  }
  while (days.length % 7) days.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthIndex] = month.split("-").map(Number) as [number, number];
  const date = new Date(Date.UTC(year, monthIndex - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

export type Share = { name: string; items: number; percent: number };

/**
 * Доли для доната: три крупнейшие категории и «Остальное». Проценты целые
 * и в сумме дают ровно 100 (остаток от округления — самой крупной доле).
 */
export function topShares(items: { name: string; items: number }[], top = 3): Share[] {
  const total = items.reduce((sum, item) => sum + item.items, 0);
  if (total === 0) return [];
  const head = items.slice(0, top);
  const rest = items.slice(top).reduce((sum, item) => sum + item.items, 0);
  const groups = rest > 0 ? [...head, { name: "Остальное", items: rest }] : head;
  const shares = groups.map((group) => ({
    ...group,
    percent: Math.round((group.items / total) * 100),
  }));
  const drift = 100 - shares.reduce((sum, share) => sum + share.percent, 0);
  if (shares[0]) shares[0].percent += drift;
  return shares;
}
