/**
 * Форма карточки товара в админке (011d): схема Zod, перевод из ответа API
 * в значения формы и обратно. Без React — покрыто тестами в product-form.test.ts.
 *
 * Поля формы — строки, как их ввёл человек («4 200», «5,2»): числа разбираются
 * схемой. Так ошибка показывается у поля («Цена — число больше нуля»), а не
 * молчаливым NaN в запросе.
 *
 * Цена, вес и порции — у вариантов товара (005a): «1 кг» и «2 кг» со своей ценой.
 * Вариантов не меньше одного, и хотя бы один включён.
 */

import { z } from "zod";
import type {
  DietaryTag,
  Occasion,
  ProductAdmin,
  ProductIn,
  ProductTag,
  Recipient,
  VariantIn,
} from "./api";

import { availabilityOf } from "./product-availability";
export { availabilityOf, type Availability } from "./product-availability";

/** «4 200», «4200,50» → 4200.5; пусто → null; мусор → NaN. */
export function parseNumber(text: string): number | null {
  const clean = text.replace(/[\s ]/g, "").replace(",", ".");
  if (clean === "") return null;
  return /^\d+(\.\d+)?$/.test(clean) ? Number(clean) : Number.NaN;
}

const optionalInt = (min: number, max: number, message: string) =>
  z.string().refine((value) => {
    const number = parseNumber(value);
    return number === null || (Number.isInteger(number) && number >= min && number <= max);
  }, message);

const optionalDecimal = (max: number, message: string) =>
  z.string().refine((value) => {
    const number = parseNumber(value);
    return number === null || (!Number.isNaN(number) && number >= 0 && number <= max);
  }, message);

const optionalText = (max: number) => z.string().max(max, `Не длиннее ${max} символов`);

const price = z.string().refine((value) => {
  const number = parseNumber(value);
  return number !== null && !Number.isNaN(number) && number > 0;
}, "Цена: число больше нуля, например 4200");

export const variantSchema = z
  .object({
    /** id сохранённого варианта; null — новый */
    id: z.number().nullable(),
    label: z.string().trim().min(1, "Подпись: «1 кг», «6 шт.»").max(50, "Не длиннее 50 символов"),
    price,
    weight_grams: optionalInt(1, 100_000, "Вес в граммах: целое число или пусто"),
    portions_min: optionalInt(1, 1000, "Целое число от 1 до 1000"),
    portions_max: optionalInt(1, 1000, "Целое число от 1 до 1000"),
    size_note: optionalText(100),
    is_active: z.boolean(),
    /** Вариант есть в заказах — удалить нельзя, только выключить (с сервера) */
    in_orders: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const from = parseNumber(values.portions_min);
    const to = parseNumber(values.portions_max);
    if ((from === null) !== (to === null)) {
      ctx.addIssue({
        code: "custom",
        path: [from === null ? "portions_min" : "portions_max"],
        message: "Укажите «от» и «до»; для одного значения одинаковые числа",
      });
    } else if (from !== null && to !== null && from > to) {
      ctx.addIssue({ code: "custom", path: ["portions_max"], message: "«До» не меньше, чем «от»" });
    }
  });

export type VariantFormValues = z.infer<typeof variantSchema>;

export const EMPTY_VARIANT: VariantFormValues = {
  id: null,
  label: "",
  price: "",
  weight_grams: "",
  portions_min: "",
  portions_max: "",
  size_note: "",
  is_active: true,
  in_orders: false,
};

export const productSchema = z
  .object({
    name: z.string().trim().min(1, "Укажите название").max(200, "Не длиннее 200 символов"),
    subtitle: optionalText(120),
    category_id: z.string().min(1, "Выберите раздел"),
    subcategory_id: z.string().min(1, "Выберите подраздел"),
    variants: z
      .array(variantSchema)
      .min(1, "Добавьте хотя бы один вариант")
      .refine(
        // Пустой список уже отмечен ошибкой min — второе сообщение не нужно
        (variants) => variants.length === 0 || variants.some((variant) => variant.is_active),
        "Включите хотя бы один вариант — иначе товар нельзя купить",
      ),
    allows_inscription: z.boolean(),
    description: z.string(),
    composition: z.string(),
    card_ingredients: optionalText(120),
    allergens: optionalText(200),
    packaging: optionalText(200),
    kcal: optionalDecimal(900, "От 0 до 900"),
    proteins: optionalDecimal(100, "От 0 до 100"),
    fats: optionalDecimal(100, "От 0 до 100"),
    carbs: optionalDecimal(100, "От 0 до 100"),
    occasions: z.array(z.string()),
    recipients: z.array(z.string()),
    dietary: z.array(z.string()),
    // Метки «Новинка», «Хит», «Сезон» — на странице товара под названием (007a)
    tags: z.array(z.string()),
    availability: z.enum(["today", "preorder", "out"]),
    lead_time_days: z.string(),
    // «Закончилось сегодня» (006b): только у «в наличии сегодня» — до полуночи под заказ на завтра
    sold_out_today: z.boolean(),
    // «Предлагать в корзине» (007a): блок «К торту часто берут»
    is_upsell: z.boolean(),
    is_active: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.availability === "preorder") {
      const days = parseNumber(values.lead_time_days);
      if (days === null || !Number.isInteger(days) || days < 1 || days > 60) {
        ctx.addIssue({
          code: "custom",
          path: ["lead_time_days"],
          message: "От 1 до 60 дней",
        });
      }
    }
  });

export type ProductFormValues = z.infer<typeof productSchema>;

/** Поля товара, которых нет в карточке (концепт их не показывает), — сохраняются как были. */
export type HiddenFields = Pick<
  ProductIn,
  | "slug"
  | "shelf_life"
  | "storage_conditions"
  | "transport_time"
  | "card_label"
  | "is_featured"
  | "order"
>;

export const EMPTY_HIDDEN: HiddenFields = {
  slug: "",
  shelf_life: null,
  storage_conditions: null,
  transport_time: null,
  card_label: null,
  is_featured: false,
  order: 0,
};

export const EMPTY_FORM: ProductFormValues = {
  name: "",
  subtitle: "",
  category_id: "",
  subcategory_id: "",
  variants: [EMPTY_VARIANT],
  allows_inscription: false,
  description: "",
  composition: "",
  card_ingredients: "",
  allergens: "",
  packaging: "",
  kcal: "",
  proteins: "",
  fats: "",
  carbs: "",
  occasions: [],
  recipients: [],
  dietary: [],
  tags: [],
  availability: "today",
  lead_time_days: "",
  sold_out_today: false,
  is_upsell: false,
  is_active: true,
};

const text = (value: string | number | null | undefined) =>
  value === null || value === undefined ? "" : String(value).replace(".", ",");

/** «4200.00» → «4200», «5.20» → «5,2» — как удобно править человеку. */
function trimDecimal(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  return text(Number(value));
}

export function toFormValues(product: ProductAdmin): ProductFormValues {
  return {
    name: product.name,
    subtitle: product.subtitle ?? "",
    category_id: String(product.category_id),
    subcategory_id: String(product.subcategory_id),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      label: variant.label,
      price: trimDecimal(variant.price),
      weight_grams: text(variant.weight_grams),
      portions_min: text(variant.portions_min),
      portions_max: text(variant.portions_max),
      size_note: variant.size_note ?? "",
      is_active: variant.is_active,
      in_orders: variant.in_orders,
    })),
    allows_inscription: product.allows_inscription,
    description: product.description,
    composition: product.composition,
    card_ingredients: product.card_ingredients ?? "",
    allergens: product.allergens ?? "",
    packaging: product.packaging ?? "",
    kcal: trimDecimal(product.kcal),
    proteins: trimDecimal(product.proteins),
    fats: trimDecimal(product.fats),
    carbs: trimDecimal(product.carbs),
    occasions: [...product.occasions],
    recipients: [...product.recipients],
    dietary: [...product.dietary],
    tags: [...product.tags],
    availability: availabilityOf(product),
    lead_time_days: product.lead_time_days > 0 ? String(product.lead_time_days) : "",
    sold_out_today: product.sold_out_today ?? false,
    is_upsell: product.is_upsell ?? false,
    is_active: product.is_active,
  };
}

export function hiddenOf(product: ProductAdmin): HiddenFields {
  return {
    slug: product.slug,
    shelf_life: product.shelf_life,
    storage_conditions: product.storage_conditions,
    transport_time: product.transport_time,
    card_label: product.card_label,
    is_featured: product.is_featured,
    order: product.order,
  };
}

const asInt = (value: string) => {
  const number = parseNumber(value);
  return number === null ? null : Math.trunc(number);
};
const asDecimal = (value: string) => {
  const number = parseNumber(value);
  return number === null ? null : String(number);
};
const asText = (value: string) => value.trim() || null;

export function toVariantPayload(values: VariantFormValues): VariantIn {
  return {
    id: values.id,
    label: values.label.trim(),
    price: String(parseNumber(values.price)),
    weight_grams: asInt(values.weight_grams),
    portions_min: asInt(values.portions_min),
    portions_max: asInt(values.portions_max),
    size_note: asText(values.size_note),
    is_active: values.is_active,
  };
}

/**
 * Значения формы → тело `PUT/POST /admin/products`. «Нет в наличии» сохраняет
 * прежний срок изготовления: вернут в продажу — срок не придётся вспоминать.
 */
export function toPayload(
  values: ProductFormValues,
  hidden: HiddenFields,
  previousLeadTime = 0,
): ProductIn {
  const lead =
    values.availability === "preorder"
      ? (asInt(values.lead_time_days) ?? 1)
      : values.availability === "today"
        ? 0
        : previousLeadTime;
  return {
    ...hidden,
    name: values.name.trim(),
    subtitle: asText(values.subtitle),
    category_id: Number(values.category_id),
    subcategory_id: Number(values.subcategory_id),
    variants: values.variants.map(toVariantPayload),
    allows_inscription: values.allows_inscription,
    description: values.description,
    composition: values.composition,
    card_ingredients: asText(values.card_ingredients),
    allergens: asText(values.allergens),
    packaging: asText(values.packaging),
    kcal: asDecimal(values.kcal),
    proteins: asDecimal(values.proteins),
    fats: asDecimal(values.fats),
    carbs: asDecimal(values.carbs),
    occasions: values.occasions as Occasion[],
    recipients: values.recipients as Recipient[],
    dietary: values.dietary as DietaryTag[],
    tags: values.tags as ProductTag[],
    is_available: values.availability !== "out",
    lead_time_days: lead,
    // У «под заказ» и «нет в наличии» отметка ничего не значит — снимаем
    sold_out_today: values.availability === "today" && values.sold_out_today,
    is_upsell: values.is_upsell,
    is_active: values.is_active,
  };
}

/** Ближайшая дата получения — по тем же правилам, что `earliest_date` на бэкенде. */
export function earliestDate(today: string, leadDays: number): string {
  const day = new Date(`${today}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + Math.max(0, leadDays));
  return day.toISOString().slice(0, 10);
}

/** Длинная сторона меньше этого — предупреждаем, что на сайте фото может быть размытым. */
export const MIN_PHOTO_SIDE = 1200;

export function isSmallPhoto(width: number, height: number): boolean {
  return Math.max(width, height) < MIN_PHOTO_SIDE;
}
