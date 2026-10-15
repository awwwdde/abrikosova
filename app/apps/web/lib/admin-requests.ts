/**
 * Фильтры «Заявок на торты» в адресе (011e) — по образцу заказов (`admin-orders.ts`).
 * Без React — тесты в admin-requests.test.ts.
 */

import type { ConsultationStatus } from "./api";

export type RequestTab = "new" | "work" | "closed" | "all";
export type RequestPeriod = "" | "today" | "tomorrow" | "week" | "custom";
export type RequestSource = "" | "custom_cake" | "contact_page";

export const REQUEST_TABS: { value: RequestTab; label: string }[] = [
  { value: "new", label: "Новые" },
  { value: "work", label: "В работе" },
  { value: "closed", label: "Закрытые" },
  { value: "all", label: "Все" },
];

export const EVENT_PERIODS: { value: RequestPeriod; label: string }[] = [
  { value: "", label: "Любая дата события" },
  { value: "today", label: "Сегодня" },
  { value: "tomorrow", label: "Завтра" },
  { value: "week", label: "Неделя" },
  { value: "custom", label: "Свой диапазон" },
];

export const SOURCES: { value: RequestSource; label: string }[] = [
  { value: "", label: "Все источники" },
  { value: "custom_cake", label: "Форма торта" },
  { value: "contact_page", label: "Контакты" },
];

export type RequestQuery = {
  tab: RequestTab;
  occasion: string;
  period: RequestPeriod;
  from: string;
  to: string;
  source: RequestSource;
  page: number;
};

export const DEFAULT_REQUESTS: RequestQuery = {
  tab: "new",
  occasion: "",
  period: "",
  from: "",
  to: "",
  source: "",
  page: 1,
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function parseRequests(params: URLSearchParams): RequestQuery {
  const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T =>
    allowed.includes(value as T) ? (value as T) : fallback;
  const page = Number(params.get("page"));
  return {
    tab: pick(params.get("tab"), ["new", "work", "closed", "all"], "new"),
    occasion: /^[a-z_]{1,30}$/.test(params.get("occasion") ?? "") ? params.get("occasion")! : "",
    period: pick(params.get("period"), ["", "today", "tomorrow", "week", "custom"], ""),
    from: ISO.test(params.get("from") ?? "") ? params.get("from")! : "",
    to: ISO.test(params.get("to") ?? "") ? params.get("to")! : "",
    source: pick(params.get("source"), ["", "custom_cake", "contact_page"], ""),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function requestsQueryString(query: RequestQuery): string {
  const params = new URLSearchParams();
  if (query.tab !== "new") params.set("tab", query.tab);
  if (query.occasion) params.set("occasion", query.occasion);
  if (query.period) params.set("period", query.period);
  if (query.period === "custom") {
    if (query.from) params.set("from", query.from);
    if (query.to) params.set("to", query.to);
  }
  if (query.source) params.set("source", query.source);
  if (query.page > 1) params.set("page", String(query.page));
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function requestsApiParams(query: RequestQuery, pageSize: number): string {
  const params = new URLSearchParams({
    tab: query.tab,
    page: String(query.page),
    page_size: String(pageSize),
  });
  if (query.occasion) params.set("occasion", query.occasion);
  if (query.period && query.period !== "custom") params.set("period", query.period);
  if (query.period === "custom") {
    if (query.from) params.set("date_from", query.from);
    if (query.to) params.set("date_to", query.to);
  }
  if (query.source) params.set("source", query.source);
  return params.toString();
}

/** Кнопки карточки: «Взять в работу» и «Закрыть» — как переходы на бэкенде. */
export function requestActions(
  status: ConsultationStatus,
): { status: ConsultationStatus; label: string; primary: boolean }[] {
  if (status === "new") {
    return [
      { status: "contacted", label: "Взять в работу", primary: true },
      { status: "completed", label: "Закрыть", primary: false },
    ];
  }
  if (status === "contacted") return [{ status: "completed", label: "Закрыть", primary: true }];
  return [];
}

export function tabOfRequest(status: ConsultationStatus): Exclude<RequestTab, "all"> {
  if (status === "new") return "new";
  if (status === "contacted") return "work";
  return "closed";
}
