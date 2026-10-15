/**
 * Окно заявки на торт (008c): правила формы, черновик и разбор ошибок API.
 *
 * Правила совпадают с `ConsultationIn` бэкенда (schemas/custom_cakes.py): повод
 * обязателен, гостей от 1, почта обязательна, согласие — true. Дата не раньше
 * `earliest_date` проверяется и здесь (подсказать сразу), и на сервере (истина).
 * Тексты ошибок — с кадра «Состояния»: «Выберите повод», «Укажите телефон»…
 */

import { z } from "zod";
import { isFullPhone } from "./checkout";
import { pluralRu } from "./format";

export const MAX_REFERENCES = 5;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Тип по MIME или по расширению: HEIC с айфона браузер часто отдаёт без MIME */
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const ALLOWED_EXTENSIONS = /\.(jpe?g|png|webp|heic|heif)$/i;

export const DRAFT_KEY = "consultation-draft";

export function leadDaysError(days: number): string {
  return `Выберите дату не раньше чем через ${days} ${pluralRu(days, ["день", "дня", "дней"])}`;
}

export function makeSchema(earliestDate: string, leadDays: number, minGuests: number) {
  return z.object({
    occasion: z.string().min(1, "Выберите повод"),
    event_date: z
      .string()
      .min(1, "Выберите дату праздника")
      .refine((value) => value >= earliestDate, leadDaysError(leadDays)),
    guests: z.string().refine((value) => {
      const number = Number.parseInt(value, 10);
      return Number.isInteger(number) && number >= minGuests && number <= 1000;
    }, `Гостей — от ${minGuests}`),
    filling_id: z.string(),
    wishes: z.string().max(2000, "Не длиннее 2000 знаков"),
    extras: z.array(z.string()),
    delivery_method: z.enum(["pickup", "delivery"]),
    name: z.string().trim().min(2, "Укажите имя"),
    phone: z.string().refine(isFullPhone, "Укажите телефон"),
    email: z
      .string()
      .trim()
      .min(1, "Укажите почту, пришлём на неё копию заявки")
      .email("Укажите почту, пришлём на неё копию заявки"),
    contact_method: z.enum(["call", "telegram"]),
    consent_pd: z.boolean().refine(Boolean, "Отметьте согласие"),
  });
}

export type RequestValues = z.infer<ReturnType<typeof makeSchema>>;
export type DraftValues = Omit<RequestValues, "consent_pd">;

/** Черновик — всё, кроме согласия и файлов. sessionStorage может быть недоступен */
export function readDraft(): Partial<DraftValues> | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Partial<DraftValues>) : null;
  } catch {
    return null;
  }
}

export function writeDraft(values: Partial<RequestValues>): void {
  try {
    const draft: Partial<RequestValues> = { ...values };
    delete draft.consent_pd;
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Приватный режим или квота — черновик не обязателен
  }
}

export function clearDraft(): void {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // см. writeDraft
  }
}

/** Проверка файла до отправки — для удобства; истина — на сервере (тип по содержимому) */
export function fileError(file: File): string | null {
  const typeOk = ALLOWED_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.test(file.name);
  if (!typeOk) return `«${file.name}»: подходят JPEG, PNG, WEBP и HEIC`;
  if (file.size > MAX_FILE_BYTES) return `«${file.name}» больше 10 МБ`;
  return null;
}

/** Поля API → поля формы (у API `guests_count`, у формы `guests`) */
const FIELD_MAP: Record<string, keyof RequestValues> = {
  occasion: "occasion",
  event_date: "event_date",
  guests_count: "guests",
  filling_id: "filling_id",
  wishes: "wishes",
  extras: "extras",
  delivery_method: "delivery_method",
  name: "name",
  phone: "phone",
  email: "email",
  contact_method: "contact_method",
  consent_pd: "consent_pd",
};

export function mapApiField(field: string): keyof RequestValues | null {
  return FIELD_MAP[field.split(".")[0]!] ?? null;
}

/** Тело multipart-запроса `POST /consultations` */
export function buildFormData(
  values: RequestValues,
  sample: { designId: number | null; workId: number | null },
  files: File[],
): FormData {
  const form = new FormData();
  form.set("name", values.name.trim());
  form.set("phone", values.phone);
  form.set("email", values.email.trim());
  form.set("contact_method", values.contact_method);
  form.set("occasion", values.occasion);
  form.set("event_date", values.event_date);
  form.set("guests_count", String(Number.parseInt(values.guests, 10)));
  form.set("delivery_method", values.delivery_method);
  form.set("consent_pd", "true");
  if (values.filling_id) form.set("filling_id", values.filling_id);
  if (values.wishes.trim()) form.set("wishes", values.wishes.trim());
  for (const extra of values.extras) form.append("extras", extra);
  if (sample.designId) form.set("design_id", String(sample.designId));
  if (sample.workId) form.set("gallery_item_id", String(sample.workId));
  for (const file of files) form.append("references", file, file.name);
  return form;
}
