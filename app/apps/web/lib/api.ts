/**
 * Типизированный клиент API.
 *
 * Один слой доступа к бэкенду вместо разбросанных по страницам fetch —
 * в старом проекте логика запросов дублировалась инлайново в каждом шаблоне.
 */

/** Адрес API для браузера: должен быть доступен снаружи (публичный хост). */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/**
 * Адрес API для серверных компонентов.
 *
 * Внутри Docker это внутреннее имя сервиса (http://api:8000), а не localhost:
 * для контейнера web «localhost» — он сам, и запрос к публичному порту не дойдёт.
 */
const SERVER_API_URL = process.env.API_URL ?? API_URL;

export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

export type SubCategory = {
  id: number;
  name: string;
  slug: string;
  order: number;
  applies_fillings: boolean;
};

export type Category = {
  id: number;
  name: string;
  slug: string;
  order: number;
  subcategories: SubCategory[];
};

export type ProductTag = "new" | "hit" | "season";

export type ProductListItem = {
  id: number;
  name: string;
  slug: string;
  price: string;
  is_available: boolean;
  tags: ProductTag[];
  weight: string;
  main_image: string | null;
};

export type Filling = {
  id: number;
  name: string;
  description: string;
  image_key: string;
  price_per_kg: string;
};

export type ProductDetail = ProductListItem & {
  description: string;
  composition: string;
  portions: string | null;
  shelf_life: string | null;
  storage_conditions: string | null;
  category: { name: string; slug: string };
  subcategory: { name: string; slug: string; applies_fillings: boolean };
  images: { id: number; storage_key: string; is_main: boolean; order: number }[];
  related_products: ProductListItem[];
  fillings: Filling[];
};

export type CartItem = {
  product_id: number;
  name: string;
  slug: string;
  price: string;
  quantity: number;
  line_total: string;
  main_image: string | null;
  is_available: boolean;
};

export type Cart = {
  items: CartItem[];
  total_items: number;
  total_price: string;
};

export type Review = {
  id: number;
  author_name: string;
  text: string;
  image_key: string | null;
  rating: number | null;
  created_at: string;
};

export type GalleryItem = {
  id: number;
  image_key: string;
  caption: string;
  description: string | null;
};

export type PageContent = {
  page_key: string;
  content: Record<string, unknown>;
  address: string | null;
  phone: string | null;
  work_hours_weekdays: string | null;
  work_hours_weekend: string | null;
  delivery_hours: string | null;
  map_embed_code: string | null;
};

export type OrderItem = {
  product_id: number;
  name: string;
  quantity: number;
  price: string;
  line_total: string;
};

export type Order = {
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_comment: string | null;
  delivery_method: "pickup" | "delivery";
  delivery_address: string | null;
  desired_date: string | null;
  total_price: string;
  status: string;
  created_at: string;
  items: OrderItem[];
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

type ValidationDetail = { loc: (string | number)[]; msg: string };

/** Разбирает 422 от FastAPI в понятную форму для React Hook Form. */
function parseError(status: number, body: unknown): ApiError {
  const detail = (body as { detail?: unknown })?.detail;

  if (Array.isArray(detail)) {
    const fieldErrors: Record<string, string> = {};
    for (const item of detail as ValidationDetail[]) {
      const field = item.loc?.filter((p) => p !== "body").join(".") || "_";
      fieldErrors[field] = item.msg.replace(/^Value error, /, "");
    }
    return new ApiError(status, Object.values(fieldErrors)[0] ?? "Ошибка валидации", fieldErrors);
  }

  return new ApiError(status, typeof detail === "string" ? detail : "Не удалось выполнить запрос");
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    // credentials обязателен: корзина опознаётся по httpOnly cookie cart_id
    credentials: "include",
    headers: {
      ...(typeof init.body === "string" ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // тело может быть пустым — не страшно, отдадим общий текст
    }
    throw parseError(response.status, body);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Запросы для серверных компонентов: ISR с ревалидацией по умолчанию. */
export async function apiGet<T>(path: string, revalidate = 300): Promise<T> {
  const response = await fetch(`${SERVER_API_URL}${path}`, { next: { revalidate } });
  if (!response.ok) {
    throw new ApiError(response.status, `Запрос ${path} вернул ${response.status}`);
  }
  return (await response.json()) as T;
}

/** Базовый адрес объектного хранилища для браузера. */
export const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_URL ?? "http://localhost:9000/abrikosova";

/**
 * Собирает публичный адрес изображения по ключу объекта.
 *
 * В БД лежит только ключ — так адрес бакета не зашивается в данные и переезд
 * хранилища не требует миграции. Сид-данные содержат ключи с префиксом
 * `placeholder/`, под которыми файлов нет: для них показывается заглушка.
 */
export function imageUrl(key: string | null | undefined): string | null {
  if (!key || key.startsWith("placeholder/")) return null;
  if (key.startsWith("http")) return key;
  return `${MEDIA_URL}/${key}`;
}

export function formatPrice(value: string | number): string {
  const number = typeof value === "string" ? Number.parseFloat(value) : value;
  return `${number.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`;
}

export const TAG_LABELS: Record<ProductTag, string> = {
  new: "Новинка",
  hit: "Хит",
  season: "Сезон",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  new: "Новый",
  confirmed: "Подтверждён",
  in_progress: "В работе",
  ready: "Готов",
  completed: "Выполнен",
  cancelled: "Отменён",
};

export const CONSULTATION_STATUS_LABELS: Record<string, string> = {
  new: "Новая",
  contacted: "Связались",
  completed: "Завершена",
};

export const SOURCE_LABELS: Record<string, string> = {
  custom_cake: "Торты на заказ",
  contact_page: "Форма контактов",
};
