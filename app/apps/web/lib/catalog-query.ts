/**
 * Состояние каталога в адресе (005b): фильтры, сортировка и страница.
 *
 * `?availability=today&dietary=gluten_free&recipient=kids&sort=price_asc&page=2` —
 * ссылку можно отправить, «Назад» возвращает предыдущий набор, первая отрисовка
 * идёт на сервере по тем же параметрам. Без React — покрыто тестами
 * в catalog-query.test.ts.
 *
 * Мусор в адресе (неизвестное значение, `page=abc`) отбрасывается, а не роняет
 * страницу: такие ссылки приходят из старых закладок и мессенджеров.
 */

import type { Availability, DietaryTag, Occasion, PortionsRange, Recipient } from "./api";

export const SORTS = ["today_first", "price_asc", "price_desc", "new"] as const;
export type Sort = (typeof SORTS)[number];
export const DEFAULT_SORT: Sort = "today_first";

/** Подписи сортировки: «Сначала» серым + значение полужирным (макет). */
export const SORT_LABELS: Record<Sort, string> = {
  today_first: "готовое сегодня",
  price_asc: "дешевле",
  price_desc: "дороже",
  new: "новые",
};

const AVAILABILITY: readonly Availability[] = ["any", "today", "preorder"];
const DIETARY: readonly DietaryTag[] = ["gluten_free", "lactose_free", "low_sugar"];
const RECIPIENTS: readonly Recipient[] = ["her", "him", "kids"];
// Поводы каталога — без «детского»: это «Кому: для детей» (005a)
const OCCASIONS: readonly Occasion[] = ["birthday", "wedding", "corporate", "tea"];
const PORTIONS: readonly PortionsRange[] = ["up_to_4", "4_8", "8_15", "over_15"];

/** Выбор в панели фильтров. Пустые массивы и `any` — «не выбрано». */
export type Filters = {
  availability: Availability;
  dietary: DietaryTag[];
  recipient: Recipient[];
  occasion: Occasion[];
  portions: PortionsRange[];
};

export type CatalogQuery = Filters & { sort: Sort; page: number };

export const EMPTY_FILTERS: Filters = {
  availability: "any",
  dietary: [],
  recipient: [],
  occasion: [],
  portions: [],
};

/** Сколько страниц можно открыть по ссылке: 60 товаров на страницу, больше 20 — явно мусор. */
const MAX_PAGE = 20;

type Raw = Record<string, string | string[] | undefined> | URLSearchParams;

function values(raw: Raw, key: string): string[] {
  if (raw instanceof URLSearchParams) return raw.getAll(key);
  const value = raw[key];
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** Только известные значения, без повторов, в порядке справочника. */
function pick<T extends string>(raw: Raw, key: string, allowed: readonly T[]): T[] {
  const given = new Set(values(raw, key));
  return allowed.filter((value) => given.has(value));
}

export function parseCatalogQuery(raw: Raw): CatalogQuery {
  const availability = values(raw, "availability")[0];
  const sort = values(raw, "sort")[0];
  const page = Number.parseInt(values(raw, "page")[0] ?? "", 10);
  return {
    availability: AVAILABILITY.includes(availability as Availability)
      ? (availability as Availability)
      : "any",
    dietary: pick(raw, "dietary", DIETARY),
    recipient: pick(raw, "recipient", RECIPIENTS),
    occasion: pick(raw, "occasion", OCCASIONS),
    portions: pick(raw, "portions", PORTIONS),
    sort: SORTS.includes(sort as Sort) ? (sort as Sort) : DEFAULT_SORT,
    page: Number.isInteger(page) && page >= 1 ? Math.min(page, MAX_PAGE) : 1,
  };
}

/** Параметры фильтров для API и адреса: значения по умолчанию не пишутся. */
export function filterParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.availability !== "any") params.set("availability", filters.availability);
  for (const value of filters.dietary) params.append("dietary", value);
  for (const value of filters.recipient) params.append("recipient", value);
  for (const value of filters.occasion) params.append("occasion", value);
  for (const value of filters.portions) params.append("portions", value);
  return params;
}

/** Строка адреса «?…» для набора; пустой набор — пустая строка (канонический вид). */
export function catalogSearch(query: Partial<CatalogQuery>): string {
  const params = filterParams({ ...EMPTY_FILTERS, ...query });
  if (query.sort && query.sort !== DEFAULT_SORT) params.set("sort", query.sort);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** Сколько значений выбрано — число на кнопке «Фильтры». */
export function countSelected(filters: Filters): number {
  return (
    (filters.availability === "any" ? 0 : 1) +
    filters.dietary.length +
    filters.recipient.length +
    filters.occasion.length +
    filters.portions.length
  );
}

export function hasFilters(filters: Filters): boolean {
  return countSelected(filters) > 0;
}

/** Есть ли в адресе что-то кроме раздела: такие адреса не индексируются. */
export function hasQueryState(query: CatalogQuery): boolean {
  return hasFilters(query) || query.sort !== DEFAULT_SORT || query.page > 1;
}

export function pickFilters(query: Filters): Filters {
  return {
    availability: query.availability,
    dietary: [...query.dietary],
    recipient: [...query.recipient],
    occasion: [...query.occasion],
    portions: [...query.portions],
  };
}

type ListKey = "dietary" | "recipient" | "occasion" | "portions";

/**
 * Черновик панели: переключить значение в группе-списке. Порядок значений —
 * как в справочнике, чтобы одинаковый выбор давал одинаковый адрес.
 */
export function toggleValue<K extends ListKey>(
  draft: Filters,
  key: K,
  value: Filters[K][number],
): Filters {
  const current = draft[key] as string[];
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
  const order: Record<ListKey, readonly string[]> = {
    dietary: DIETARY,
    recipient: RECIPIENTS,
    occasion: OCCASIONS,
    portions: PORTIONS,
  };
  return { ...draft, [key]: order[key].filter((item) => next.includes(item)) };
}

export function sameFilters(a: Filters, b: Filters): boolean {
  return filterParams(a).toString() === filterParams(b).toString();
}
