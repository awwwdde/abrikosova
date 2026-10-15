import { describe, expect, it } from "vitest";
import type { ProductListItem } from "./api";
import {
  cardMetaParts,
  formatPortionsRange,
  formatWeightRange,
  hasPriceRange,
  needsChoice,
} from "./product-meta";

type Variant = ProductListItem["variants"][number];

function variant(
  price: string,
  weight: number | null,
  portions: [number, number] | null = null,
): Variant {
  return {
    id: 1,
    label: "",
    price,
    weight_grams: weight,
    portions_min: portions?.[0] ?? null,
    portions_max: portions?.[1] ?? null,
  };
}

const pie = {
  card_label: "фирменная позиция",
  subcategory: { name: "Пироги", slug: "pirogi" },
  variants: [variant("3400.00", 1200, [10, 12])],
};

describe("строка «подкатегория · вес · порции»", () => {
  it("каталог: подкатегория и килограммы с запятой, card_label не используется", () => {
    expect(cardMetaParts(pie, "catalog")).toEqual(["пироги", "1,2 кг", "10–12 порций"]);
  });

  it("главная: card_label и граммы, как на макете главной", () => {
    expect(cardMetaParts(pie, "home")).toEqual(["фирменная позиция", "1200 г", "10–12 порций"]);
  });

  it("без card_label главная пишет подкатегорию", () => {
    expect(cardMetaParts({ ...pie, card_label: null }, "home")[0]).toBe("пироги");
  });

  it("несколько вариантов — диапазоны веса и порций по всем", () => {
    const whole = {
      ...pie,
      subcategory: { name: "Классические", slug: "klassicheskie" },
      variants: [variant("2400.00", 1000, [8, 10]), variant("4800.00", 2000, [16, 20])],
    };
    expect(cardMetaParts(whole, "catalog")).toEqual(["классические", "1–2 кг", "8–20 порций"]);
  });

  it("порции — по тем вариантам, у которых они есть; без порций — без части", () => {
    expect(formatPortionsRange([variant("1", 100), variant("1", 200, [2, 3])])).toBe("2–3 порции");
    expect(formatPortionsRange([variant("1", 100)])).toBeNull();
    expect(formatPortionsRange([variant("1", 60, [1, 1])])).toBe("1 порция");
    expect(cardMetaParts({ ...pie, variants: [variant("1", null)] }, "catalog")).toEqual([
      "пироги",
    ]);
  });

  it("вес: граммы, килограммы, смешанный диапазон", () => {
    expect(formatWeightRange([100], "catalog")).toBe("100 г");
    expect(formatWeightRange([1000], "catalog")).toBe("1 кг");
    expect(formatWeightRange([1250], "catalog")).toBe("1,25 кг");
    expect(formatWeightRange([450, 900], "catalog")).toBe("450–900 г");
    expect(formatWeightRange([450, 1200], "catalog")).toBe("450 г – 1,2 кг");
    expect(formatWeightRange([1200, 2400], "home")).toBe("1200–2400 г");
    expect(formatWeightRange([], "catalog")).toBeNull();
  });
});

describe("цена и «+»", () => {
  it("«от» — только если цены вариантов различаются", () => {
    expect(hasPriceRange([{ price: "2400.00" }, { price: "4800.00" }])).toBe(true);
    expect(hasPriceRange([{ price: "480.00" }, { price: "480" }])).toBe(false);
    expect(hasPriceRange([{ price: "480.00" }])).toBe(false);
  });

  it("«+» кладёт в корзину только один вариант без надписи", () => {
    const one = [variant("480.00", 100)];
    expect(needsChoice({ variants: one, allows_inscription: false })).toBe(false);
    expect(needsChoice({ variants: one, allows_inscription: true })).toBe(true);
    expect(
      needsChoice({ variants: [...one, variant("900.00", 200)], allows_inscription: false }),
    ).toBe(true);
  });
});
