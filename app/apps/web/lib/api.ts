/**
 * Типизированный клиент API.
 *
 * Один слой доступа к бэкенду вместо разбросанных по страницам fetch —
 * в старом проекте логика запросов дублировалась инлайново в каждом шаблоне.
 */

import type { components } from "./api-schema";

/** Адрес API для браузера: должен быть доступен снаружи (публичный хост). */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/**
 * Адрес API для серверных компонентов.
 *
 * Внутри Docker это внутреннее имя сервиса (http://api:8000), а не localhost:
 * для контейнера web «localhost» — он сам, и запрос к публичному порту не дойдёт.
 */
const SERVER_API_URL = process.env.API_URL ?? API_URL;

/**
 * Схемы API — из сгенерированного lib/api-schema.d.ts (`npm run gen:api`).
 *
 * Здесь только короткие имена: руками типы ответов не пишем, иначе они снова
 * разойдутся с Pydantic-схемами бэкенда и TypeScript этого не заметит.
 */
type Schemas = components["schemas"];

/**
 * Страница списка. В OpenAPI generic `Page[T]` разворачивается в отдельные
 * схемы `Page_ProductListItem_`, `Page_ReviewOut_` и т. д. с одинаковыми полями
 * пагинации — берём их у любой и подставляем тип элементов.
 */
export type Page<T> = Omit<Schemas["Page_ProductListItem_"], "items"> & { items: T[] };

// Перечисления — строковые union-типы из схемы
export type ProductTag = Schemas["ProductTag"];
export type Occasion = Schemas["Occasion"];
export type DietaryTag = Schemas["DietaryTag"];
export type PortionsRange = Schemas["PortionsRange"];
export type Availability = Schemas["Availability"];
export type DeliveryMethod = Schemas["DeliveryMethod"];
export type DeliveryInterval = Schemas["DeliveryInterval"];
export type OrderStatus = Schemas["OrderStatus"];
export type ConsultationStatus = Schemas["ConsultationStatus"];
export type ConsultationSource = Schemas["ConsultationSource"];

// Публичная часть
export type SubCategory = Schemas["SubCategoryOut"];
export type Category = Schemas["CategoryOut"];
export type ProductListItem = Schemas["ProductListItem"];
/** Отдельная схема, а не расширение ProductListItem: набор полей на бэкенде разный. */
export type ProductDetail = Schemas["ProductDetail"];
export type Nutrition = Schemas["Nutrition"];
export type Filling = Schemas["FillingOut"];
export type CartItem = Schemas["CartItemOut"];
export type Cart = Schemas["CartOut"];
export type Review = Schemas["ReviewOut"];
export type GalleryItem = Schemas["GalleryItemOut"];
export type PageContent = Schemas["PageContentOut"];
export type OrderItem = Schemas["OrderItemOut"];
export type Order = Schemas["OrderOut"];
export type OrderCreate = Schemas["OrderCreate"];
export type CatalogFilters = Schemas["CatalogFilters"];
/** Вариант фильтра каталога: значение для запроса и подпись для интерфейса. */
export type FilterOption<T extends string> = { value: T; label: string };

// Админка
export type ProductAdmin = Schemas["ProductAdminOut"];
export type ProductIn = Schemas["ProductIn"];
export type ConsultationAdmin = Schemas["ConsultationAdminOut"];
export type OrderAdminListItem = Schemas["OrderAdminListItem"];
export type CategoryAdmin = Schemas["CategoryAdminOut"];
export type SubCategoryAdmin = Schemas["SubCategoryAdminOut"];
export type ProductImage = Schemas["ProductImageOut"];
export type CustomCakeAdmin = Schemas["CustomCakeAdminOut"];
export type FillingAdmin = Schemas["FillingAdminOut"];
export type GalleryItemAdmin = Schemas["GalleryItemAdminOut"];
export type ReviewAdmin = Schemas["ReviewAdminOut"];
export type AdminUser = Schemas["AdminOut"];
export type Backup = Schemas["BackupOut"];

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors?: Record<string, string>,
    /**
     * Структурированная ошибка целиком, если бэкенд прислал `detail` объектом.
     * Например, `POST /orders` при слишком ранней дате: `{ message, earliest_date }` —
     * чекаут достаёт отсюда дату и подсказывает, какую можно выбрать.
     */
    public data?: Record<string, unknown>,
  ) {
    super(message);
  }
}

type ValidationDetail = { loc: (string | number)[]; msg: string };

/**
 * Разбирает ошибку FastAPI в понятную форму для формы.
 *
 * `detail` бывает трёх видов: строка (свои HTTPException), список (422 валидации
 * Pydantic с путями к полям) и объект с `message` (ошибки с дополнительными
 * данными, как ранняя дата заказа).
 */
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

  if (detail && typeof detail === "object") {
    const data = detail as Record<string, unknown>;
    const message = typeof data.message === "string" ? data.message : "Не удалось выполнить запрос";
    return new ApiError(status, message, undefined, data);
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
