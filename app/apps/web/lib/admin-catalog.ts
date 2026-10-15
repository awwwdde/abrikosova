/**
 * Фильтры каталога в адресе (011e): `/admin/catalog?category=2&availability=out&page=2`.
 * Без React — тесты в admin-catalog.test.ts.
 */

export type CatalogView = "products" | "sections";
export type StockFilter = "" | "today" | "preorder" | "out";
export type VisibilityFilter = "" | "visible" | "hidden";

export type CatalogQuery = {
  view: CatalogView;
  q: string;
  category: string;
  subcategory: string;
  stock: StockFilter;
  visibility: VisibilityFilter;
  page: number;
};

export const DEFAULT_CATALOG: CatalogQuery = {
  view: "products",
  q: "",
  category: "",
  subcategory: "",
  stock: "",
  visibility: "",
  page: 1,
};

export const STOCK_OPTIONS: { value: StockFilter; label: string }[] = [
  { value: "", label: "Любое наличие" },
  { value: "today", label: "В наличии" },
  { value: "preorder", label: "Под заказ" },
  { value: "out", label: "Нет в наличии" },
];

export const VISIBILITY_OPTIONS: { value: VisibilityFilter; label: string }[] = [
  { value: "", label: "На сайте и скрытые" },
  { value: "visible", label: "На сайте" },
  { value: "hidden", label: "Скрытые" },
];

const id = (value: string | null) => (value && /^\d+$/.test(value) ? value : "");

export function parseCatalog(params: URLSearchParams): CatalogQuery {
  const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T =>
    allowed.includes(value as T) ? (value as T) : fallback;
  const page = Number(params.get("page"));
  const category = id(params.get("category"));
  return {
    view: pick(params.get("view"), ["products", "sections"], "products"),
    q: (params.get("q") ?? "").slice(0, 100),
    category,
    // Подраздел без раздела не имеет смысла: список подразделов зависит от раздела
    subcategory: category ? id(params.get("subcategory")) : "",
    stock: pick(params.get("availability"), ["", "today", "preorder", "out"], ""),
    visibility: pick(params.get("visibility"), ["", "visible", "hidden"], ""),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function catalogQueryString(query: CatalogQuery): string {
  const params = new URLSearchParams();
  if (query.view !== "products") params.set("view", query.view);
  if (query.q) params.set("q", query.q);
  if (query.category) params.set("category", query.category);
  if (query.category && query.subcategory) params.set("subcategory", query.subcategory);
  if (query.stock) params.set("availability", query.stock);
  if (query.visibility) params.set("visibility", query.visibility);
  if (query.page > 1) params.set("page", String(query.page));
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function catalogApiParams(query: CatalogQuery, pageSize: number): string {
  const params = new URLSearchParams({ page: String(query.page), page_size: String(pageSize) });
  if (query.q.trim()) params.set("search", query.q.trim());
  if (query.category) params.set("category_id", query.category);
  if (query.subcategory) params.set("subcategory_id", query.subcategory);
  if (query.stock) params.set("availability", query.stock);
  if (query.visibility) params.set("is_active", query.visibility === "visible" ? "true" : "false");
  return params.toString();
}

export function hasFilters(query: CatalogQuery): boolean {
  return Boolean(query.q || query.category || query.stock || query.visibility);
}

/** «Торты · Классика», но «Бенто», если подраздел называется как раздел. */
export function sectionText(category: string, subcategory: string): string {
  if (!subcategory || category.trim().toLowerCase() === subcategory.trim().toLowerCase()) {
    return category;
  }
  return `${category} · ${subcategory}`;
}

/** Переставить элемент на шаг влево/вправо — для стрелок порядка разделов и фото. */
export function moveItem<T>(items: readonly T[], index: number, step: -1 | 1): T[] {
  const target = index + step;
  if (target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

/** Перетаскивание: вынуть элемент из `from` и вставить на место `to`. */
export function dropItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return [...items];
  next.splice(to, 0, moved);
  return next;
}
