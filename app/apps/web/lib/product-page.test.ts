import { describe, expect, it } from "vitest";
import type { ProductDetail } from "./api";
import {
  availabilityText,
  formatInterval,
  formatPeople,
  inscriptionError,
  pickVariant,
  questionLabel,
  showsWeightPicker,
  sizeLine,
  unitPrice,
} from "./product-page";

describe("цена", () => {
  it("вариант плюс надпись, если отмечена", () => {
    expect(unitPrice({ price: "2400.00" }, "300.00", false)).toBe(2400);
    expect(unitPrice({ price: "2400.00" }, "300.00", true)).toBe(2700);
    expect(unitPrice({ price: "4800.00" }, 0, true)).toBe(4800);
  });
});

describe("«Хватит на»", () => {
  it("склонение по верхней границе", () => {
    expect(formatPeople(8, 10)).toBe("8–10 человек");
    expect(formatPeople(2, 3)).toBe("2–3 человека");
    expect(formatPeople(1, 1)).toBe("1 человека");
    expect(formatPeople(16, 21)).toBe("16–21 человека");
    expect(formatPeople(12, 14)).toBe("12–14 человек");
    expect(formatPeople(null, null)).toBeNull();
  });
});

describe("срок", () => {
  const slot = (date: string, interval: string, days_ahead: number) => ({
    date,
    interval: interval as "15-18",
    days_ahead,
  });

  it("сегодня, завтра, под заказ, нет в наличии", () => {
    expect(
      availabilityText({
        is_available: true,
        lead_time_days: 0,
        sold_out_today: false,
        nearest_slot: slot("2026-10-08", "15-18", 0),
      }),
    ).toEqual({
      title: "Можно забрать сегодня",
      detail: "ближайшее окно 15:00–18:00",
      orderable: true,
      tone: "accent",
      action: "В корзину",
    });
    expect(
      availabilityText({
        is_available: true,
        lead_time_days: 0,
        sold_out_today: false,
        nearest_slot: slot("2026-10-09", "09-12", 1),
      }),
    ).toMatchObject({ title: "Можно забрать завтра", detail: "ближайшее окно 09:00–12:00" });
    // Макет 09.10: без тире, тёмным, а не бордо
    expect(
      availabilityText({
        is_available: true,
        lead_time_days: 2,
        sold_out_today: false,
        nearest_slot: slot("2026-10-09", "09-12", 2),
      }),
    ).toMatchObject({
      title: "Под заказ за 2 дня",
      detail: "ближайшая дата 9 октября",
      tone: "ink",
    });
    expect(
      availabilityText({
        is_available: false,
        lead_time_days: 0,
        sold_out_today: false,
        nearest_slot: null,
      }),
    ).toMatchObject({ title: "Сейчас нет в наличии", detail: null, orderable: false });
  });

  it("закончилось сегодня — серым, кнопка «Заказать на завтра» активна (006b)", () => {
    // Бэкенд уже считает срок «на день»: lead_time_days = 1, slot — завтра
    expect(
      availabilityText({
        is_available: true,
        lead_time_days: 1,
        sold_out_today: true,
        nearest_slot: slot("2026-10-08", "09-12", 1),
      }),
    ).toEqual({
      title: "Закончилось сегодня",
      detail: "можно заказать на завтра, 8 октября",
      orderable: true,
      tone: "muted",
      action: "Заказать на завтра",
    });
    // Завтрашние окна уже нельзя (поздний вечер) — дата словами, без «завтра»
    expect(
      availabilityText({
        is_available: true,
        lead_time_days: 1,
        sold_out_today: true,
        nearest_slot: slot("2026-10-09", "09-12", 2),
      }),
    ).toMatchObject({ detail: "можно заказать на 9 октября", action: "Заказать" });
  });

  it("интервал", () => {
    expect(formatInterval("09-12")).toBe("09:00–12:00");
  });
});

describe("«Вес и размер»", () => {
  it("из вариантов", () => {
    expect(
      sizeLine([
        { label: "1 кг", size_note: "диаметр 18 см, высота 8 см" },
        { label: "2 кг", size_note: "диаметр 24 см, высота 9 см" },
      ]),
    ).toBe("1 кг: диаметр 18 см, высота 8 см · 2 кг: диаметр 24 см, высота 9 см");
    expect(sizeLine([{ label: "1,2 кг", size_note: "диаметр 20 см" }])).toBe("диаметр 20 см");
    expect(
      sizeLine([
        { label: "1 кг", size_note: null },
        { label: "2 кг", size_note: "диаметр 24 см" },
      ]),
    ).toBe("2 кг: диаметр 24 см");
    expect(sizeLine([{ label: "100 г", size_note: null }])).toBeNull();
  });
});

describe("вариант из адреса и надпись", () => {
  const variants = [{ id: 2 }, { id: 3 }];
  it("?v=", () => {
    expect(pickVariant(variants, "3").id).toBe(3);
    expect(pickVariant(variants, "999").id).toBe(2);
    expect(pickVariant(variants, undefined).id).toBe(2);
  });
  it("надпись отмечена — текст обязателен", () => {
    expect(inscriptionError(false, "")).toBeNull();
    expect(inscriptionError(true, "  ")).toBe("Напишите текст надписи или снимите галочку");
    // Макет 09.10 (006b): до 24 знаков
    expect(inscriptionError(true, "х".repeat(24))).toBeNull();
    expect(inscriptionError(true, "х".repeat(25))).toBe("Не длиннее 24 символов");
    expect(inscriptionError(true, " С днём рождения ")).toBeNull();
  });
});

describe("правила раздела (006b)", () => {
  const category = (slug: string) => ({ name: "", slug });
  const one = [{ id: 1 }] as ProductDetail["variants"];
  const two = [{ id: 1 }, { id: 2 }] as ProductDetail["variants"];

  it("«Вес»: у торта всегда, у остального — при двух весах и больше", () => {
    expect(showsWeightPicker({ category: category("torty"), variants: one })).toBe(true);
    expect(showsWeightPicker({ category: category("deserty"), variants: one })).toBe(false);
    expect(showsWeightPicker({ category: category("pirogi-i-rulety"), variants: two })).toBe(true);
  });

  it("«Вопрос по торту?» / «Вопрос о десерте?»", () => {
    expect(questionLabel({ category: category("torty") })).toBe("Вопрос по торту?");
    expect(questionLabel({ category: category("deserty") })).toBe("Вопрос о десерте?");
  });
});
