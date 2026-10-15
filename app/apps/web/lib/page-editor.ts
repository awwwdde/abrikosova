/**
 * Редактор страниц сайта (011f): пути в контенте, схемы Zod той же формы, что
 * `schemas/pages.py` на бэкенде, и поиск текстов-заглушек. Без React — тесты
 * в page-editor.test.ts.
 *
 * Значение страницы — объект `PageContentIn`: `content` (блоки) и для контактов
 * поля таблицы (адрес, телефон, часы, рейтинг Яндекса, ссылки). Путь к полю —
 * строка через точку: `content.faq.0.answer`; так же бэкенд отдаёт `loc` в 422.
 */

import { z } from "zod";

export type PageKey = "home" | "about" | "custom_cakes" | "contacts" | "legal" | "gallery";
export type PageValue = Record<string, unknown>;

export function getAt(value: unknown, path: string): unknown {
  return path
    .split(".")
    .filter(Boolean)
    .reduce<unknown>((current, key) => {
      if (current === null || current === undefined) return undefined;
      return (current as Record<string, unknown>)[key];
    }, value);
}

/** Иммутабельная запись по пути: недостающие объекты/массивы создаются. */
export function setAt<T>(value: T, path: string, next: unknown): T {
  const keys = path.split(".").filter(Boolean);
  const write = (current: unknown, index: number): unknown => {
    const key = keys[index]!;
    const isIndex = /^\d+$/.test(key);
    const base: Record<string, unknown> | unknown[] = Array.isArray(current)
      ? [...current]
      : current && typeof current === "object"
        ? { ...(current as Record<string, unknown>) }
        : isIndex
          ? []
          : {};
    const child =
      index === keys.length - 1 ? next : write((base as Record<string, unknown>)[key], index + 1);
    (base as Record<string, unknown>)[key] = child;
    return base;
  };
  return write(value, 0) as T;
}

/** Текст из сида, который надо заменить: подсвечиваем «Нужен текст от заказчика». */
const PLACEHOLDER = /заглушк|черновой текст|заменяется (?:реальным|на этапе)/i;

export function isPlaceholder(value: unknown): boolean {
  return typeof value === "string" && PLACEHOLDER.test(value);
}

/** Есть ли заглушка где-то внутри блока (для метки в списке блоков). */
export function hasPlaceholder(value: unknown): boolean {
  if (isPlaceholder(value)) return true;
  if (Array.isArray(value)) return value.some(hasPlaceholder);
  if (value && typeof value === "object") return Object.values(value).some(hasPlaceholder);
  return false;
}

// --- Схемы: те же ограничения, что в schemas/pages.py ---

const line = z
  .string()
  .trim()
  .min(1, "Заполните или удалите строку")
  .max(300, "Не длиннее 300 символов");
const paragraph = z
  .string()
  .trim()
  .min(1, "Заполните или удалите абзац")
  .max(2000, "Не длиннее 2000 символов");
const https = z
  .string()
  .trim()
  .regex(/^https:\/\/\S+$/, "Ссылка должна начинаться с https://")
  .max(500, "Слишком длинная ссылка");
// Кнопка ведёт на страницу сайта («/catalog») или на https: без javascript: и mailto
const href = z
  .string()
  .trim()
  .regex(/^(\/(?!\/)\S*|https:\/\/\S+|#[\w-]*)$/, "Путь на сайте (/catalog) или https://");
const optional = <T extends z.ZodTypeAny>(schema: T) => schema.nullable().optional();

const cta = z.object({ label: line, href }).strict();
const sectionIntro = z.object({ title: line, subtitle: paragraph, cta }).strict();

export const homeSchema = z
  .object({
    hero: optional(
      z
        .object({
          title_lines: z.array(line),
          subtitle_lines: z.array(line),
          cta,
          video_key: optional(
            z.string().regex(/^hero\/[a-f0-9]{32}\.mp4$/, "Загрузите видео через кнопку"),
          ),
          poster_key: optional(
            z.string().regex(/^(hero|pages)\/[a-f0-9]{32}\.webp$/, "Загрузите постер через кнопку"),
          ),
        })
        .strict(),
    ),
    ticker: z.array(line).optional(),
    ready_today: optional(sectionIntro),
    made_to_order: optional(sectionIntro),
    fillings_intro: z.array(paragraph).optional(),
    order_banner: optional(z.object({ title: line, text: paragraph }).strict()),
    author: optional(
      z
        .object({
          name: line,
          role: line,
          quote: paragraph,
          paragraphs: z.array(paragraph).optional(),
          stats: z
            .array(z.object({ value: line, label: line }).strict())
            .max(4, "Не больше 4 показателей")
            .optional(),
          image_key: optional(z.string().max(500)),
        })
        .strict(),
    ),
    faq: z.array(z.object({ question: line, answer: paragraph }).strict()).optional(),
  })
  .strict();

export const contactsContentSchema = z
  .object({
    title: optional(line),
    intro: optional(paragraph),
    email: optional(
      z
        .string()
        .max(254)
        .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Укажите адрес почты"),
    ),
    pickup_description: optional(paragraph),
    delivery_description: optional(paragraph),
    delivery: optional(paragraph),
    pickup: optional(paragraph),
    catalog_note: optional(paragraph),
    product_pickup: optional(line),
    pickup_place: optional(line),
    product_delivery: optional(line),
    payment: optional(paragraph),
    how_to_get: optional(paragraph),
    features: z.array(line).optional(),
    route_url: optional(https),
    reviews_count_text: optional(line),
    award: optional(line),
    interior_image_key: optional(z.string().max(500)),
    socials: z.array(z.object({ label: line, href: https }).strict()).optional(),
    legal: optional(
      z
        .object({
          name: line,
          ogrnip: z.string().regex(/^\d{15}$/, "ОГРНИП: ровно 15 цифр"),
          inn: optional(z.string().regex(/^\d{12}$/, "ИНН ИП: ровно 12 цифр")),
          production_address: optional(line),
        })
        .strict(),
    ),
    geo: optional(
      z
        .object({
          latitude: z
            .number({ error: "Число, например 55,7155" })
            .min(-90, "От −90 до 90")
            .max(90, "От −90 до 90"),
          longitude: z
            .number({ error: "Число, например 37,4339" })
            .min(-180, "От −180 до 180")
            .max(180, "От −180 до 180"),
        })
        .strict(),
    ),
  })
  .strict();

const aboutText = z.object({ title: line, text: paragraph }).strict();
export const aboutContentSchema = z
  .object({
    title: optional(line),
    main_text: optional(paragraph),
    principles: z.array(aboutText).optional(),
    coffee_shop: optional(aboutText),
    biography: optional(z.array(paragraph)),
    timeline: optional(
      z.array(aboutText.extend({ year: z.string().regex(/^\d{4}$/, "Год: четыре цифры") })).max(12),
    ),
    workflow: optional(z.array(aboutText).max(8)),
    workshop_image_key: optional(z.string().max(500)),
    team: optional(
      z
        .array(
          z
            .object({
              name: line,
              role: line,
              image_key: optional(z.string().max(500)),
              placeholder: optional(line),
            })
            .strict(),
        )
        .max(12),
    ),
  })
  .strict();

/** Свободный контент страницы «Торты на заказ». */
const freeContent = z.record(z.string(), z.unknown());

/** «Торты на заказ» (014): схема той же формы, что CustomCakesContent на бэкенде.
 * Повод карточки меню — значение фильтра «Работ» (009), в том числе группа
 * «Юбилей и корпоратив». */
const OCCASIONS = ["wedding", "birthday", "kids", "anniversary_corporate"] as const;
export const customCakesContentSchema = z
  .object({
    title: optional(line),
    subtitle: optional(line),
    consultation_text: optional(paragraph),
    calculator_text: optional(paragraph),
    calculator_note: optional(paragraph),
    prices_intro: optional(paragraph),
    prices_note: optional(paragraph),
    fillings_intro: optional(paragraph),
    lead_days_note: optional(line),
    order_facts: z
      .array(z.object({ label: line, value: line }).strict())
      .max(4)
      .optional(),
    faq: z
      .array(z.object({ question: line, answer: paragraph }).strict())
      .max(20)
      .optional(),
    design_filling_note: optional(line),
    tasting_set_slug: optional(z.string().max(200)),
    stages: z
      .array(z.object({ title: line, duration: optional(line), text: paragraph }).strict())
      .max(8)
      .optional(),
    header_menu: optional(
      z
        .object({
          facts: optional(line),
          cards: z
            .array(
              z
                .object({
                  occasion: z.enum(OCCASIONS, {
                    message: "Повод: wedding, birthday, kids или anniversary_corporate",
                  }),
                  label: line,
                  image_key: optional(z.string().max(500)),
                })
                .strict(),
            )
            .max(4, "Не больше четырёх карточек")
            .optional(),
        })
        .strict(),
    ),
  })
  .strict();

const rating = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .refine((value) => {
    if (value === null || value === undefined || value === "") return true;
    const number = Number(String(value).replace(",", "."));
    return /^\d(?:[.,]\d)?$/.test(String(value)) && number >= 0 && number <= 5;
  }, "От 0 до 5, один знак после запятой: 4,9");

const count = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .refine(
    (value) => value === null || value === undefined || value === "" || /^\d+$/.test(String(value)),
    "Целое число",
  );

const optionalHttps = z
  .union([z.string(), z.null()])
  .optional()
  .refine(
    (value) => !value || /^https:\/\/\S+$/.test(value),
    "Ссылка должна начинаться с https://",
  );

/** Даты редакции правовых документов (010b): ГГГГ-ММ-ДД из поля type="date". */
const revisionDate = optional(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Дата: ГГГГ-ММ-ДД"));
export const legalContentSchema = z
  .object({
    privacy_revised_at: revisionDate,
    terms_revised_at: revisionDate,
    consent_revised_at: revisionDate,
  })
  .strict();

/** «Работы» (009): текст справа от заголовка и бордовая плашка «Не нашли похожий?». */
export const galleryContentSchema = z
  .object({
    intro: optional(paragraph),
    cta: optional(z.object({ title: line, text: paragraph }).strict()),
  })
  .strict();

export function pageSchema(key: PageKey) {
  const content =
    key === "home"
      ? homeSchema
      : key === "contacts"
        ? contactsContentSchema
        : key === "about"
          ? aboutContentSchema
          : key === "legal"
            ? legalContentSchema
            : key === "custom_cakes"
              ? customCakesContentSchema
              : key === "gallery"
                ? galleryContentSchema
                : freeContent;
  return z.object({
    content,
    address: z.string().max(500).nullable().optional(),
    phone: z.string().max(50).nullable().optional(),
    work_hours_weekdays: z.string().max(100).nullable().optional(),
    work_hours_weekend: z.string().max(100).nullable().optional(),
    delivery_hours: z.string().max(100).nullable().optional(),
    yandex_rating: rating,
    yandex_reviews_count: count,
    yandex_maps_url: optionalHttps,
    telegram_url: optionalHttps,
  });
}

/** Ошибки Zod → { "content.faq.0.answer": "…" }. */
export function zodErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (!result[path]) result[path] = issue.message;
  }
  return result;
}

/** 422 бэкенда: loc ["body", "content", "faq", 0, "answer"] → "content.faq.0.answer". */
export function serverErrors(
  issues: { loc: (string | number)[]; msg: string }[],
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of issues) {
    const path = issue.loc.filter((part) => part !== "body").join(".");
    if (!result[path]) result[path] = issue.msg.replace(/^Value error, /, "");
  }
  return result;
}

/** Пустые строки в необязательных полях — null: бэкенд не ждёт "" вместо «нет значения». */
export function cleanPage(value: PageValue): PageValue {
  // Пустая строка в списке остаётся строкой: схема скажет «Заполните или удалите
  // строку», а null дал бы невнятное «expected string»
  const clean = (item: unknown, inList = false): unknown => {
    if (typeof item === "string") return !inList && item.trim() === "" ? null : item;
    if (Array.isArray(item)) return item.map((child) => clean(child, true));
    if (item && typeof item === "object") {
      return Object.fromEntries(Object.entries(item).map(([key, child]) => [key, clean(child)]));
    }
    return item;
  };
  const result = clean(value) as PageValue;
  // Рейтинг «4,9» → «4.9», число оценок → число
  if (typeof result.yandex_rating === "string")
    result.yandex_rating = result.yandex_rating.replace(",", ".");
  if (typeof result.yandex_reviews_count === "string")
    result.yandex_reviews_count = Number(result.yandex_reviews_count);
  // Координаты (012): «55,7155» → 55.7155; оба поля пустые — блока нет совсем
  const content = result.content as Record<string, unknown> | undefined;
  const geo = content?.geo as Record<string, unknown> | null | undefined;
  if (content && geo) {
    if (geo.latitude == null && geo.longitude == null) content.geo = null;
    else {
      const number = (value: unknown) =>
        typeof value === "string" && /^-?\d+([.,]\d+)?$/.test(value.trim())
          ? Number(value.trim().replace(",", "."))
          : value;
      content.geo = { latitude: number(geo.latitude), longitude: number(geo.longitude) };
    }
  }
  return result;
}
