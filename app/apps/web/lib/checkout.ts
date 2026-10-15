/**
 * Логика страницы корзины и оформления (007b) без React — покрыта тестами
 * в checkout.test.ts: схема формы (те же правила, что `OrderCreate` на бэкенде),
 * маска телефона, черновик формы в sessionStorage, подписи дат и окон, текст
 * «Три шоколада, 1,4 кг готовится 2 дня…», «3 позиции».
 */

import { z } from "zod";
import type { Cart, OrderCreate } from "./api";
import { pluralRu } from "./format";

export type Method = "pickup" | "delivery";
export type ContactMethod = "call" | "telegram";
type Interval = NonNullable<OrderCreate["delivery_interval"]>;

// --- Телефон ---

/**
 * Маска `+7 (___) ___-__-__` по мере ввода. Первая 8 или 7 — код страны; цифры
 * сверх 10 отбрасываются. Пусто — пусто (плейсхолдер виден).
 *
 * @example formatPhoneInput("89161234567") // "+7 (916) 123-45-67"
 */
export function formatPhoneInput(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits[0] === "8" || digits[0] === "7") digits = digits.slice(1);
  digits = digits.slice(0, 10);
  const [a, b, c, d] = [
    digits.slice(0, 3),
    digits.slice(3, 6),
    digits.slice(6, 8),
    digits.slice(8, 10),
  ];
  let out = "+7";
  if (a) out += ` (${a}${a.length === 3 ? ")" : ""}`;
  if (b) out += ` ${b}`;
  if (c) out += `-${c}`;
  if (d) out += `-${d}`;
  return out;
}

/** Номер полный: 10 цифр после +7. */
export function isFullPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 && (digits[0] === "7" || digits[0] === "8");
}

// --- Схема формы ---

const PHONE_ERROR = "Укажите телефон: +7 (900) 000-00-00";
export const EMAIL_ERROR = "Укажите почту, пришлём на неё копию заказа";
export const CONSENT_ERROR = "Отметьте согласие, чтобы отправить заказ";

const short = z.string().trim().max(20, "Не длиннее 20 символов");

/**
 * Правила совпадают с `OrderCreate` (схема API): почта обязательна, при доставке —
 * «улица и дом», при «получит другой человек» — имя и телефон получателя, дата
 * и окно обязательны всегда (007b). Тексты ошибок — с кадра «Ошибки в форме».
 */
export const checkoutSchema = z
  .object({
    delivery_method: z.enum(["pickup", "delivery"]),
    delivery_address: z.string().trim().max(500),
    address_apartment: short,
    address_entrance: short,
    address_floor: short,
    courier_comment: z.string().trim().max(500, "Не длиннее 500 символов"),
    desired_date: z.string(),
    delivery_interval: z.string(),
    customer_name: z.string().trim().min(2, "Укажите имя").max(200),
    customer_phone: z.string().refine(isFullPhone, PHONE_ERROR),
    customer_email: z
      .string()
      .trim()
      .max(254)
      .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, EMAIL_ERROR),
    contact_method: z.enum(["call", "telegram"]),
    other_recipient: z.boolean(),
    recipient_name: z.string().trim().max(200),
    recipient_phone: z.string(),
    customer_comment: z.string().trim().max(2000, "Не длиннее 2000 символов"),
    consent_pd: z.boolean().refine((value) => value, CONSENT_ERROR),
  })
  .superRefine((values, ctx) => {
    if (values.delivery_method === "delivery" && !values.delivery_address) {
      ctx.addIssue({ code: "custom", path: ["delivery_address"], message: "Укажите улицу и дом" });
    }
    if (!values.desired_date) {
      ctx.addIssue({ code: "custom", path: ["desired_date"], message: "Выберите дату" });
    }
    if (!values.delivery_interval) {
      ctx.addIssue({ code: "custom", path: ["delivery_interval"], message: "Выберите окно" });
    }
    if (values.other_recipient) {
      if (values.recipient_name.length < 2) {
        ctx.addIssue({
          code: "custom",
          path: ["recipient_name"],
          message: "Укажите имя получателя",
        });
      }
      if (!isFullPhone(values.recipient_phone)) {
        ctx.addIssue({
          code: "custom",
          path: ["recipient_phone"],
          message: "Укажите телефон получателя",
        });
      }
    }
  });

export type CheckoutValues = z.infer<typeof checkoutSchema>;

export const EMPTY_CHECKOUT: CheckoutValues = {
  delivery_method: "pickup",
  delivery_address: "",
  address_apartment: "",
  address_entrance: "",
  address_floor: "",
  courier_comment: "",
  desired_date: "",
  delivery_interval: "",
  customer_name: "",
  customer_phone: "",
  customer_email: "",
  contact_method: "call",
  other_recipient: false,
  recipient_name: "",
  recipient_phone: "",
  customer_comment: "",
  // Галочка согласия снята по умолчанию — предпроставленное согласие не считается
  // осознанным по 152-ФЗ; в черновик она не попадает
  consent_pd: false,
};

const orNull = (value: string) => value.trim() || null;

/** Тело `POST /orders`. При самовывозе адресные поля не отправляем вовсе. */
export function toOrderPayload(values: CheckoutValues, website: string): OrderCreate {
  const delivery = values.delivery_method === "delivery";
  return {
    customer_name: values.customer_name.trim(),
    customer_phone: values.customer_phone,
    customer_email: values.customer_email.trim(),
    contact_method: values.contact_method,
    customer_comment: orNull(values.customer_comment),
    delivery_method: values.delivery_method,
    delivery_address: delivery ? orNull(values.delivery_address) : null,
    address_apartment: delivery ? orNull(values.address_apartment) : null,
    address_entrance: delivery ? orNull(values.address_entrance) : null,
    address_floor: delivery ? orNull(values.address_floor) : null,
    courier_comment: delivery ? orNull(values.courier_comment) : null,
    other_recipient: values.other_recipient,
    recipient_name: values.other_recipient ? orNull(values.recipient_name) : null,
    recipient_phone: values.other_recipient ? orNull(values.recipient_phone) : null,
    desired_date: values.desired_date,
    delivery_interval: values.delivery_interval as Interval,
    consent_pd: values.consent_pd,
    website: website || null,
  };
}

// --- Черновик формы ---

export const DRAFT_KEY = "checkout-draft";

/**
 * Черновик в sessionStorage — чтобы после «Изменить» или перехода на товар форма
 * не терялась. Согласие не сохраняем: его отмечают осознанно перед отправкой.
 * Хранилище может быть недоступно (приватный режим, запрет) — тогда черновика нет.
 */
export function saveDraft(values: CheckoutValues, storage: Storage | null = safeStorage()): void {
  if (!storage) return;
  const rest: Partial<CheckoutValues> = { ...values };
  delete rest.consent_pd;
  try {
    storage.setItem(DRAFT_KEY, JSON.stringify(rest));
  } catch {
    // Переполнено или запрещено — форма работает и без черновика
  }
}

export function loadDraft(storage: Storage | null = safeStorage()): Partial<CheckoutValues> {
  if (!storage) return {};
  try {
    const raw = storage.getItem(DRAFT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const draft: Partial<CheckoutValues> = {};
    for (const [key, fallback] of Object.entries(EMPTY_CHECKOUT)) {
      if (key === "consent_pd") continue;
      const value = parsed[key];
      // Только поля формы и только своего типа: чужие ключи и мусор отбрасываем
      if (value !== undefined && typeof value === typeof fallback) {
        (draft as Record<string, unknown>)[key] = value;
      }
    }
    return draft;
  } catch {
    return {};
  }
}

export function clearDraft(storage: Storage | null = safeStorage()): void {
  try {
    storage?.removeItem(DRAFT_KEY);
  } catch {
    // нечего чистить
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

// --- Подписи ---

const MONTHS_SHORT = [
  "янв",
  "фев",
  "мар",
  "апр",
  "мая",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];
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

function parts(isoDate: string): [number, number] {
  const [, month, day] = isoDate.split("-").map(Number);
  return [day ?? 1, month ?? 1];
}

/** «2026-10-09» → «9 окт» — вторая строка кнопки даты. */
export function dayShort(isoDate: string): string {
  const [day, month] = parts(isoDate);
  return `${day} ${MONTHS_SHORT[month - 1]}`;
}

/** «2026-10-09» → «9 октября». */
export function dayLong(isoDate: string): string {
  const [day, month] = parts(isoDate);
  return `${day} ${MONTHS[month - 1]}`;
}

/** «09-12» → «9:00–12:00», как на макете (без ведущего нуля). */
export function intervalText(interval: string): string {
  const [from, to] = interval.split("-").map(Number);
  return `${from}:00–${to}:00`;
}

/** «15-18» → «с 15:00 до 18:00» — шаг 3 «Заказ принят». */
export function intervalRange(interval: string): string {
  const [from, to] = interval.split("-").map(Number);
  return `с ${from}:00 до ${to}:00`;
}

/** «Три шоколада, 1,4 кг готовится 2 дня, поэтому весь заказ можно получить с 9 октября». */
export function earliestReasonText(
  cart: Pick<Cart, "earliest_reason" | "earliest_date">,
): string | null {
  const reason = cart.earliest_reason;
  if (!reason) return null;
  const name = reason.variant_label ? `${reason.name}, ${reason.variant_label}` : reason.name;
  const days = `${reason.lead_time_days} ${pluralRu(reason.lead_time_days, ["день", "дня", "дней"])}`;
  return `${name} готовится ${days}, поэтому весь заказ можно получить с ${dayLong(cart.earliest_date)}`;
}

/** «3 позиции» — по числу штук, как в макете «Ваш заказ». */
export function positionsText(count: number): string {
  return `${count} ${pluralRu(count, ["позиция", "позиции", "позиций"])}`;
}

/** Срок строки корзины: «Можно забрать сегодня» / «завтра» / «Под заказ за 2 дня». */
export function leadText(days: number): { text: string; ready: boolean } {
  if (days <= 0) return { text: "Можно забрать сегодня", ready: true };
  if (days === 1) return { text: "Можно забрать завтра", ready: true };
  return { text: `Под заказ за ${days} ${pluralRu(days, ["день", "дня", "дней"])}`, ready: false };
}

/**
 * После смены способа получения: окно, которого у нового способа нет (18–21
 * у доставки) или которое там недоступно, сбрасывается. Возвращает новое окно
 * (или "") и нужно ли подсказать, почему оно сброшено.
 */
export function keepInterval(
  cart: Pick<Cart, "slots">,
  method: Method,
  date: string,
  interval: string,
): { interval: string; dropped: boolean } {
  if (!interval) return { interval: "", dropped: false };
  const day = cart.slots[method].find((item) => item.date === date);
  const option = day?.intervals.find((item) => item.interval === interval);
  if (option?.available) return { interval, dropped: false };
  return { interval: "", dropped: true };
}
