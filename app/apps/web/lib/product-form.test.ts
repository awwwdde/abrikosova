import { describe, expect, it } from "vitest";
import {
  EMPTY_FORM,
  EMPTY_HIDDEN,
  EMPTY_VARIANT,
  earliestDate,
  isSmallPhoto,
  parseNumber,
  productSchema,
  toPayload,
  type ProductFormValues,
} from "./product-form";

const kilo = {
  ...EMPTY_VARIANT,
  label: "1,5 кг",
  price: "4 200",
  weight_grams: "1500",
  portions_min: "10",
  portions_max: "12",
};

const valid: ProductFormValues = {
  ...EMPTY_FORM,
  name: "Медовик",
  category_id: "1",
  subcategory_id: "2",
  variants: [kilo],
  proteins: "5,2",
};

function errors(values: ProductFormValues): Record<string, string> {
  const result = productSchema.safeParse(values);
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join("."), issue.message]),
  );
}

describe("схема карточки товара", () => {
  it("числа как их вводят люди", () => {
    expect(parseNumber("4 200")).toBe(4200);
    expect(parseNumber("5,2")).toBe(5.2);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("12кг")).toBeNaN();
  });

  it("корректная форма проходит", () => {
    expect(errors(valid)).toEqual({});
  });

  it("ошибки у своих полей", () => {
    const result = errors({
      ...valid,
      name: "  ",
      variants: [{ ...kilo, price: "0", portions_min: "12", portions_max: "", label: " " }],
      availability: "preorder",
      lead_time_days: "0",
      kcal: "1000",
      subtitle: "х".repeat(121),
    });
    expect(Object.keys(result).sort()).toEqual(
      [
        "kcal",
        "lead_time_days",
        "name",
        "subtitle",
        "variants.0.label",
        "variants.0.portions_max",
        "variants.0.price",
      ].sort(),
    );
    expect(result["variants.0.price"]).toBe("Цена: число больше нуля, например 4200");
  });

  it("«до» не меньше «от»", () => {
    expect(
      errors({ ...valid, variants: [{ ...kilo, portions_min: "12", portions_max: "10" }] }),
    ).toEqual({ "variants.0.portions_max": "«До» не меньше, чем «от»" });
  });

  it("хотя бы один включённый вариант", () => {
    expect(errors({ ...valid, variants: [] })).toEqual({
      variants: "Добавьте хотя бы один вариант",
    });
    expect(errors({ ...valid, variants: [{ ...kilo, is_active: false }] })).toEqual({
      variants: "Включите хотя бы один вариант — иначе товар нельзя купить",
    });
  });
});

describe("тело запроса", () => {
  it("наличие и срок", () => {
    const today = toPayload(
      { ...valid, variants: [kilo, { ...kilo, id: 7, label: "3 кг", size_note: "  " }] },
      { ...EMPTY_HIDDEN, slug: "medovik" },
    );
    expect(today).toMatchObject({
      slug: "medovik",
      proteins: "5.2",
      kcal: null,
      subtitle: null,
      is_available: true,
      lead_time_days: 0,
    });
    // Варианты — по порядку, числа разобраны, пустой размер — null, in_orders не уходит
    expect(today.variants).toEqual([
      {
        id: null,
        label: "1,5 кг",
        price: "4200",
        weight_grams: 1500,
        portions_min: 10,
        portions_max: 12,
        size_note: null,
        is_active: true,
      },
      expect.objectContaining({ id: 7, label: "3 кг", size_note: null }),
    ]);
    const preorder = toPayload(
      { ...valid, availability: "preorder", lead_time_days: "3" },
      EMPTY_HIDDEN,
    );
    expect(preorder).toMatchObject({ is_available: true, lead_time_days: 3 });
    // «Нет в наличии» помнит прежний срок
    const out = toPayload({ ...valid, availability: "out" }, EMPTY_HIDDEN, 2);
    expect(out).toMatchObject({ is_available: false, lead_time_days: 2 });
  });

  it("ближайшая дата и маленькое фото", () => {
    expect(earliestDate("2026-10-30", 3)).toBe("2026-11-02");
    expect(isSmallPhoto(1000, 1199)).toBe(true);
    expect(isSmallPhoto(960, 1200)).toBe(false);
  });
});
