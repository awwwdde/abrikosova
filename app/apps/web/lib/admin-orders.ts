/**
 * Чистые функции раздела «Заказы» (011d). Без React — покрыты тестами
 * в lib/admin-orders.test.ts.
 */

import type { OrderStatus } from "./api";

export type OrderTab = "all" | "new" | "work" | "ready" | "done";
export type OrderPeriod = "" | "today" | "tomorrow" | "week" | "custom";
export type OrderMethod = "" | "pickup" | "delivery";

export const ORDER_TABS: { value: OrderTab; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "new", label: "Новые" },
  { value: "work", label: "В работе" },
  { value: "ready", label: "Готовы к выдаче" },
  { value: "done", label: "Выданы" },
];

export const PERIODS: { value: OrderPeriod; label: string }[] = [
  { value: "", label: "Любая дата" },
  { value: "today", label: "Сегодня" },
  { value: "tomorrow", label: "Завтра" },
  { value: "week", label: "Неделя" },
  { value: "custom", label: "Свой диапазон" },
];

export const METHODS: { value: OrderMethod; label: string }[] = [
  { value: "", label: "Все способы" },
  { value: "pickup", label: "Самовывоз" },
  { value: "delivery", label: "Доставка" },
];

/**
 * Номер для списка — короткий хвост: «20261001-867DB2» → «867DB2». Дата в номере
 * и так видна в колонке «Получение», а хвост уникален в пределах дня. Полный
 * номер — в карточке и в `title` строки.
 */
export function shortNumber(orderNumber: string): string {
  const tail = orderNumber.split("-").pop();
  return tail && tail.length >= 4 ? tail : orderNumber;
}

/** Этапы в шапке карточки; «Отменён» в них не входит — это не шаг, а выход. */
export const ORDER_STEPS: { status: OrderStatus; label: string }[] = [
  { status: "new", label: "Новый" },
  { status: "confirmed", label: "Подтверждён" },
  { status: "in_progress", label: "Готовится" },
  { status: "ready", label: "Готов" },
  { status: "completed", label: "Выдан" },
];

const NEXT: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  new: { status: "confirmed", label: "Подтвердить" },
  confirmed: { status: "in_progress", label: "Начать готовить" },
  in_progress: { status: "ready", label: "Готов к выдаче" },
  ready: { status: "completed", label: "Выдан" },
};

/** Следующий шаг заказа; null — заказ выдан или отменён, ходов нет. */
export function nextStep(status: OrderStatus): { status: OrderStatus; label: string } | null {
  return NEXT[status] ?? null;
}

export function isFinal(status: OrderStatus): boolean {
  return status === "completed" || status === "cancelled";
}

export function stepIndex(status: OrderStatus): number {
  return ORDER_STEPS.findIndex((step) => step.status === status);
}

/** К какой вкладке относится статус — чтобы оптимистично пересчитать счётчики. */
export function tabOf(status: OrderStatus): Exclude<OrderTab, "all"> {
  if (status === "new") return "new";
  if (status === "confirmed" || status === "in_progress") return "work";
  if (status === "ready") return "ready";
  return "done";
}

export type OrderQuery = {
  tab: OrderTab;
  period: OrderPeriod;
  from: string;
  to: string;
  method: OrderMethod;
  page: number;
};

export const DEFAULT_QUERY: OrderQuery = {
  tab: "all",
  period: "",
  from: "",
  to: "",
  method: "",
  page: 1,
};

/** Состояние фильтров живёт в адресе: ссылку на выборку можно отправить коллеге. */
export function parseQuery(params: URLSearchParams): OrderQuery {
  const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T =>
    allowed.includes(value as T) ? (value as T) : fallback;
  const page = Number(params.get("page"));
  return {
    tab: pick(params.get("tab"), ["all", "new", "work", "ready", "done"], "all"),
    period: pick(params.get("period"), ["", "today", "tomorrow", "week", "custom"], ""),
    from: /^\d{4}-\d{2}-\d{2}$/.test(params.get("from") ?? "") ? params.get("from")! : "",
    to: /^\d{4}-\d{2}-\d{2}$/.test(params.get("to") ?? "") ? params.get("to")! : "",
    method: pick(params.get("method"), ["", "pickup", "delivery"], ""),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** Строка адреса страницы (без значений по умолчанию). */
export function queryString(query: OrderQuery): string {
  const params = new URLSearchParams();
  if (query.tab !== "all") params.set("tab", query.tab);
  if (query.period) params.set("period", query.period);
  if (query.period === "custom") {
    if (query.from) params.set("from", query.from);
    if (query.to) params.set("to", query.to);
  }
  if (query.method) params.set("method", query.method);
  if (query.page > 1) params.set("page", String(query.page));
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** Параметры для API: «свой диапазон» → date_from/date_to, вкладка — без страницы для CSV. */
export function apiParams(query: OrderQuery, pageSize: number, forExport = false): string {
  const params = new URLSearchParams({ tab: query.tab });
  if (query.period && query.period !== "custom") params.set("period", query.period);
  if (query.period === "custom") {
    if (query.from) params.set("date_from", query.from);
    if (query.to) params.set("date_to", query.to);
  }
  if (query.method) params.set("method", query.method);
  if (!forExport) {
    params.set("page", String(query.page));
    params.set("page_size", String(pageSize));
  }
  return params.toString();
}
