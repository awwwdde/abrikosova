/**
 * Логика страницы товара (006) без React — покрыта тестами в product-page.test.ts:
 * цена с вариантом и надписью, «Хватит на 8–10 человек», текст срока, строка
 * «Вес и размер».
 */

import type { ProductDetail } from "./api";
import { pluralRu } from "./format";

type Variant = ProductDetail["variants"][number];

/** Макет 09.10 (006b): «До 24 знаков» под полем; бэкенд отвечает 422 на 25+. */
export const INSCRIPTION_MAX = 24;

/** Раздел «Торты»: у тортов блок «Вес» и «Вопрос по торту?» (006b). */
const CAKES_CATEGORY = "torty";

/**
 * Блок «Вес» — у тортов всегда (даже с одним весом: «Три шоколада, 1,4 кг» — одна
 * выбранная кнопка), у остальных — когда весов больше одного. У пирожного вес
 * пишется строкой под составом (макет «Эстерхази», 006b).
 */
export function showsWeightPicker(product: Pick<ProductDetail, "category" | "variants">): boolean {
  return product.category.slug === CAKES_CATEGORY || product.variants.length > 1;
}

/** «Вопрос по торту?» у тортов, «Вопрос о десерте?» у остального (006b). */
export function questionLabel(product: Pick<ProductDetail, "category">): string {
  return product.category.slug === CAKES_CATEGORY ? "Вопрос по торту?" : "Вопрос о десерте?";
}

/** Цена одной штуки: вариант плюс надпись, если она отмечена. */
export function unitPrice(
  variant: Pick<Variant, "price">,
  inscriptionPrice: string | number,
  withInscription: boolean,
): number {
  return Number(variant.price) + (withInscription ? Number(inscriptionPrice) : 0);
}

/**
 * «8–10 человек», «2–3 человека», «1 человека» — после «Хватит на»
 * (винительный падеж: на одного человека, на двух, на пятерых — «человек»).
 * Склонение по верхней границе. Нет порций — null, строку не показываем.
 */
export function formatPeople(min: number | null, max: number | null): string | null {
  const low = min ?? max;
  const high = max ?? min;
  if (low == null || high == null) return null;
  const range = low === high ? `${low}` : `${low}–${high}`;
  return `${range} ${pluralRu(high, ["человека", "человека", "человек"])}`;
}

const MONTHS = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

/** «2026-10-12» → «12 октября». Разбор строки, без Date: дата без часового пояса. */
export function formatDayMonth(isoDate: string): string {
  const [, month, day] = isoDate.split("-").map(Number);
  return `${day} ${MONTHS[(month ?? 1) - 1]}`;
}

/** «15-18» → «15:00–18:00». */
export function formatInterval(interval: string): string {
  const [from, to] = interval.split("-");
  return `${from}:00–${to}:00`;
}

export type Availability = {
  /** Первая строка: «Можно забрать сегодня» */
  title: string;
  /** Вторая строка: «ближайшее окно 15:00–18:00» */
  detail: string | null;
  /** Можно ли положить в корзину */
  orderable: boolean;
  /**
   * Цвет первой строки по макету 09.10: бордо — забрать сегодня/завтра,
   * тёмный — под заказ, серый — закончилось сегодня или нет в наличии
   */
  tone: "accent" | "ink" | "muted";
  /** Подпись кнопки: «Заказать на завтра», когда витрина сегодня кончилась */
  action: string;
};

/**
 * Текст срока для пяти случаев:
 * - нет в наличии;
 * - закончилось сегодня (006b) — «Закончилось сегодня · можно заказать на завтра,
 *   8 октября», кнопка «Заказать на завтра»;
 * - в наличии, окно сегодня — «Можно забрать сегодня · ближайшее окно 15:00–18:00»;
 * - в наличии, окна сегодня кончились — «Можно забрать завтра» и окно;
 * - под заказ — «Под заказ за 2 дня · ближайшая дата 9 октября».
 *
 * Окно и дата — `nearest_slot` от бэкенда: та же функция проверяет дату в заказе.
 * У закончившегося бэкенд уже считает срок «на день» — дата в slot завтрашняя.
 */
export function availabilityText(
  product: Pick<
    ProductDetail,
    "is_available" | "lead_time_days" | "nearest_slot" | "sold_out_today"
  >,
): Availability {
  const slot = product.nearest_slot;
  if (!product.is_available || !slot) {
    return {
      title: "Сейчас нет в наличии",
      detail: null,
      orderable: false,
      tone: "muted",
      action: "В корзину",
    };
  }
  if (product.sold_out_today) {
    const when =
      slot.days_ahead === 1
        ? `на завтра, ${formatDayMonth(slot.date)}`
        : `на ${formatDayMonth(slot.date)}`;
    return {
      title: "Закончилось сегодня",
      detail: `можно заказать ${when}`,
      orderable: true,
      tone: "muted",
      action: slot.days_ahead === 1 ? "Заказать на завтра" : "Заказать",
    };
  }
  if (product.lead_time_days > 0) {
    const days = product.lead_time_days;
    return {
      title: `Под заказ за ${days} ${pluralRu(days, ["день", "дня", "дней"])}`,
      detail: `ближайшая дата ${formatDayMonth(slot.date)}`,
      orderable: true,
      tone: "ink",
      action: "В корзину",
    };
  }
  const when =
    slot.days_ahead <= 0 ? "сегодня" : slot.days_ahead === 1 ? "завтра" : formatDayMonth(slot.date);
  return {
    title: `Можно забрать ${when}`,
    detail: `ближайшее окно ${formatInterval(slot.interval)}`,
    orderable: true,
    tone: "accent",
    action: "В корзину",
  };
}

/**
 * «Вес и размер»: «1 кг: диаметр 18 см, высота 8 см · 2 кг: диаметр 24 см, высота 9 см».
 * У товара с одним вариантом — только размер. Варианты без размера пропускаются,
 * нет ни одного — null, строку не показываем.
 */
export function sizeLine(variants: Pick<Variant, "label" | "size_note">[]): string | null {
  const withSize = variants.filter((variant) => variant.size_note);
  if (withSize.length === 0) return null;
  if (variants.length === 1) return withSize[0]!.size_note;
  return withSize.map((variant) => `${variant.label}: ${variant.size_note}`).join(" · ");
}

/** Вариант из адреса `?v=<id>`; неизвестный — первый (по умолчанию). */
export function pickVariant<T extends { id: number }>(variants: T[], raw: string | undefined): T {
  const id = Number(raw);
  return variants.find((variant) => variant.id === id) ?? variants[0]!;
}

/** Проверка надписи перед «В корзину»: отмечена — текст обязателен. */
export function inscriptionError(enabled: boolean, text: string): string | null {
  if (!enabled) return null;
  const clean = text.trim();
  if (!clean) return "Напишите текст надписи или снимите галочку";
  if (clean.length > INSCRIPTION_MAX) return `Не длиннее ${INSCRIPTION_MAX} символов`;
  return null;
}
