import { describe, expect, it } from "vitest";
import {
  cleanPage,
  getAt,
  hasPlaceholder,
  isPlaceholder,
  pageSchema,
  serverErrors,
  setAt,
  zodErrors,
} from "./page-editor";

describe("пути в контенте", () => {
  it("чтение и неизменяемая запись", () => {
    const page = { content: { faq: [{ question: "Q", answer: "A" }] } };
    expect(getAt(page, "content.faq.0.answer")).toBe("A");
    const next = setAt(page, "content.faq.0.answer", "B");
    expect(getAt(next, "content.faq.0.answer")).toBe("B");
    expect(page.content.faq[0]!.answer).toBe("A");
    expect(getAt(setAt({}, "content.ticker.1", "x"), "content.ticker")).toEqual([undefined, "x"]);
  });

  it("ошибки сервера → пути", () => {
    expect(
      serverErrors([
        { loc: ["body", "content", "socials", 0, "href"], msg: "Value error, только https" },
      ]),
    ).toEqual({
      "content.socials.0.href": "только https",
    });
  });
});

describe("заглушки", () => {
  it("находит тексты из сида", () => {
    expect(isPlaceholder("Заглушка. Здесь встанет отзыв")).toBe(true);
    expect(isPlaceholder("Черновой текст о Елене")).toBe(true);
    expect(isPlaceholder("Торт под вашу дату")).toBe(false);
    expect(hasPlaceholder({ about: { items: ["ок", "Заглушка"] } })).toBe(true);
  });
});

describe("схемы страниц", () => {
  it("торты на заказ: калькулятор сохраняется вместе с остальным контентом 008a/008b", () => {
    const data = {
      content: {
        title: "Торты на заказ",
        calculator_text: "Подберём вес под дизайн",
        calculator_note: "Итог зависит от оформления",
        prices_intro: "Цена за килограмм",
        prices_note: null,
        fillings_intro: "Выберите начинку",
        lead_days_note: "Ярусные от 10 дней",
        order_facts: [{ label: "Аванс", value: "50% после эскиза" }],
        faq: [{ question: "Как заказать?", answer: "Оставьте заявку" }],
        design_filling_note: "Любая из списка",
        tasting_set_slug: "degustacionnyy-set",
      },
    };
    expect(pageSchema("custom_cakes").parse(data)).toEqual(data);
    expect(
      pageSchema("custom_cakes").safeParse({ content: { ...data.content, typo: "x" } }).success,
    ).toBe(false);
  });
  it("о нас: проверяет год и роль сотрудника, сохраняет фотографии команды", () => {
    const data = {
      content: {
        timeline: [{ year: "2021", title: "Открытие", text: "Кофейня" }],
        team: [{ name: "Елена", role: "Кондитер", image_key: "pages/portrait.webp" }],
      },
    };
    expect(pageSchema("about").parse(data)).toEqual(data);
    const invalid = pageSchema("about").safeParse({
      content: {
        timeline: [{ year: "год", title: "Этап", text: "Описание" }],
        team: [{ name: "Елена" }],
      },
    });
    expect(Object.keys(zodErrors(invalid.error!))).toEqual([
      "content.timeline.0.year",
      "content.team.0.role",
    ]);
  });
  it("главная: пустая строка и javascript: в кнопке — ошибки у полей", () => {
    const result = pageSchema("home").safeParse({
      content: {
        hero: {
          title_lines: ["Торты", " "],
          subtitle_lines: [],
          cta: { label: "Каталог", href: "javascript:alert(1)" },
        },
      },
    });
    expect(result.success).toBe(false);
    const errors = zodErrors(result.error!);
    expect(Object.keys(errors).sort()).toEqual([
      "content.hero.cta.href",
      "content.hero.title_lines.1",
    ]);
  });

  it("контакты: соцсеть только https, рейтинг 0–5", () => {
    const result = pageSchema("contacts").safeParse({
      content: { socials: [{ label: "ВКонтакте", href: "http://vk.com" }] },
      yandex_rating: "5,6",
      yandex_maps_url: "https://yandex.ru/maps/org/1",
    });
    const errors = zodErrors(result.error!);
    expect(Object.keys(errors).sort()).toEqual(["content.socials.0.href", "yandex_rating"]);
  });

  it("очистка: пустое — null, рейтинг с точкой", () => {
    expect(
      cleanPage({
        content: { award: "  ", ticker: ["", "Кофе"] },
        yandex_rating: "4,9",
        yandex_reviews_count: "169",
      }),
    ).toEqual({
      content: { award: null, ticker: ["", "Кофе"] },
      yandex_rating: "4.9",
      yandex_reviews_count: 169,
    });
  });
});

describe("координаты кондитерской (012)", () => {
  it("строки с запятой → числа, пустые → без блока, вне диапазона — ошибка", () => {
    const filled = cleanPage({ content: { geo: { latitude: "55,7155", longitude: "37.4339" } } });
    expect((filled.content as { geo: unknown }).geo).toEqual({
      latitude: 55.7155,
      longitude: 37.4339,
    });
    expect(pageSchema("contacts").safeParse(filled).success).toBe(true);

    const empty = cleanPage({ content: { geo: { latitude: "", longitude: " " } } });
    expect((empty.content as { geo: unknown }).geo).toBeNull();

    const wrong = cleanPage({ content: { geo: { latitude: "95", longitude: "37" } } });
    const errors = zodErrors(pageSchema("contacts").safeParse(wrong).error!);
    expect(Object.keys(errors)).toEqual(["content.geo.latitude"]);
  });
});
