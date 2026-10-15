/**
 * Яндекс.Метрика (задание 012). Счётчик подключает components/analytics.tsx —
 * только на публичной части и только после согласия на cookie.
 *
 * Цели — одним помощником, без персональных данных в параметрах: имя, телефон
 * и состав заказа в Метрику не уходят никогда.
 */

export const METRIKA_ID = process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID ?? "";

/**
 * Вебвизор (запись сессий) — по переменной, выключен по умолчанию. Даже включённый,
 * он не записывает поля ввода: у всех полей публичной части классы NO_RECORD.
 */
export const WEBVISOR = process.env.NEXT_PUBLIC_YANDEX_WEBVISOR === "true";

/**
 * Классы Метрики для полей ввода: `ym-disable-keys` — не записывать нажатия,
 * `ym-hide-content` — скрыть содержимое в записи. Иначе в Вебвизор попали бы
 * имена и телефоны клиентов (152-ФЗ).
 */
export const NO_RECORD = "ym-disable-keys ym-hide-content";

/** Согласие на cookie и Метрику: «1» — согласен, хранится год. */
export const CONSENT_COOKIE = "analytics_consent";

export type MetrikaGoal =
  | "add_to_cart" // Добавил в корзину
  | "order_created" // Оформил заказ
  | "custom_cake_request" // Отправил заявку на торт
  | "consultation_created" // Заявка на торт из окна заявки (008c), без ПДн
  | "phone_click" // Нажал на телефон
  | "telegram_click"; // Перешёл в Telegram

type Ym = (id: number, method: string, ...args: unknown[]) => void;

/**
 * Отправить цель. Без счётчика (нет ID, нет согласия, блокировщик) — тихо ничего.
 * `params` — параметры визита к цели, например вариант товара у `add_to_cart` (006).
 * Без персональных данных: только id, количество и флаги.
 */
export function reachGoal(
  goal: MetrikaGoal,
  params?: Record<string, string | number | boolean>,
): void {
  if (typeof window === "undefined" || !METRIKA_ID) return;
  const ym = (window as unknown as { ym?: Ym }).ym;
  if (params) ym?.(Number(METRIKA_ID), "reachGoal", goal, params);
  else ym?.(Number(METRIKA_ID), "reachGoal", goal);
}

/** Цель по клику на ссылку: телефон и Telegram ловятся одним обработчиком на документе. */
export function goalForHref(href: string | null): MetrikaGoal | null {
  if (!href) return null;
  if (href.startsWith("tel:")) return "phone_click";
  if (/^https?:\/\/(?:t\.me|telegram\.me)\//i.test(href)) return "telegram_click";
  return null;
}

export function hasConsent(cookie: string): boolean {
  return cookie.split(/;\s*/).includes(`${CONSENT_COOKIE}=1`);
}
