import { describe, expect, it, vi } from "vitest";
import { type LegacyLookup, legacyOutcome } from "./legacy-redirects";

// Данные переноса: старый слаг «medovik-klassika» стал «medovik», старая
// подкатегория 7 — «torty/bento», старая картинка перенесена в хранилище
const NEW_KEY = "products/12/0123456789abcdef0123456789abcdef.webp";
const lookup: LegacyLookup = async (kind, key) => {
  if (kind === "product" && key === "medovik-klassika") return { location: "/product/medovik" };
  if (kind === "subcategory" && key === "7") return { location: "/catalog/torty/bento" };
  if (kind === "media" && key === "products/2025/11/02/medovik.jpg") return { media_key: NEW_KEY };
  return null;
};

// Таблица «старый адрес → статус → Location» по каждому шаблону old/main/urls.py
const TABLE: [string, number | null, string | null][] = [
  ["/", null, null],
  ["/catalog/", 301, "/catalog"],
  ["/about/", 301, "/about"],
  ["/contacts/", 301, "/contacts"],
  ["/custom-cakes/", 301, "/custom-cakes"],
  ["/cart/", 301, "/cart"],
  ["/checkout/", 301, "/checkout"],
  ["/privacy/", 301, "/privacy"],
  ["/product/medovik-klassika/", 301, "/product/medovik"],
  // Слаг сохранили при переносе — соответствия в таблице нет, просто без слэша
  ["/product/praga/", 301, "/product/praga"],
  ["/catalog/7/", 301, "/catalog/torty/bento"],
  ["/catalog/subcategory/7/", 301, "/catalog/torty/bento"],
  ["/catalog/99/", 301, "/catalog"],
  ["/order/success/20251102-ABC123/", 301, "/order/20251102-ABC123"],
  ["/create-consultation/", 410, null],
  ["/cart/add/5/", 410, null],
  ["/cart/remove/5/", 410, null],
  ["/cart/update/5/", 410, null],
  ["/cart/count/", 410, null],
  ["/cart/items/", 410, null],
  ["/cart/clear/", 410, null],
  ["/media/products/2025/11/02/medovik.jpg", 301, `/media/${NEW_KEY}`],
  ["/media/products/2025/11/02/lost.jpg", 410, null],
  ["/media/custom_cakes/wedding.png", 410, null],
  // Новое — не трогаем: ключ хранилища, статика сайта, новые адреса
  [`/media/${NEW_KEY}`, null, null],
  ["/media/hero/poster.jpg", null, null],
  ["/product/medovik", null, null],
  ["/catalog/torty/bento", null, null],
  ["/admin", null, null],
];

describe("адреса старого сайта", () => {
  it.each(TABLE)("%s → %s %s", async (path, status, location) => {
    const outcome = await legacyOutcome(path, lookup, "/media");
    expect(outcome?.status ?? null).toBe(status);
    expect(outcome && "location" in outcome ? outcome.location : null).toBe(location);
  });

  it("без цепочек: адрес из Location больше никуда не редиректит", async () => {
    for (const [path] of TABLE) {
      const outcome = await legacyOutcome(path, lookup, "/media");
      if (outcome && "location" in outcome) {
        expect(await legacyOutcome(outcome.location, lookup, "/media")).toBeNull();
      }
    }
  });

  it("API недоступен — запасной вариант, а не ошибка", async () => {
    const broken: LegacyLookup = async () => {
      throw new Error("timeout");
    };
    expect(await legacyOutcome("/catalog/7/", broken, "/media")).toEqual({
      status: 301,
      location: "/catalog",
    });
    expect(await legacyOutcome("/media/about/elena.jpg", broken, "/media")).toEqual({
      status: 410,
    });
  });
});

describe("открытый редирект на чужой домен (012a)", () => {
  // Ни один из этих адресов не должен дать 301 на внешний хост
  const HOSTILE = [
    "//evil.example/",
    "/\\evil.example/",
    "/%2F%2Fevil.example/",
    "/%5Cevil.example/",
    "///evil.example/",
    "/product/%2F%2Fevil/",
    "/catalog//7/",
    "/about//",
  ];

  it.each(HOSTILE)("%s → нет редиректа за пределы сайта", async (path) => {
    const outcome = await legacyOutcome(path, lookup, "/media");
    if (outcome && "location" in outcome) {
      const target = new URL(outcome.location, "https://abrikosova-elena.ru");
      expect(target.origin).toBe("https://abrikosova-elena.ru");
    }
  });

  it("повторные и обратные слэши — не старые адреса вовсе", async () => {
    for (const path of [
      "//evil.example/",
      "/\\evil.example/",
      "/%2F%2Fevil.example/",
      "///evil.example/",
      "/catalog//7/",
    ]) {
      expect(await legacyOutcome(path, lookup, "/media")).toBeNull();
    }
  });

  it("абсолютный адрес из API — без редиректа и с предупреждением", async () => {
    const hostile: LegacyLookup = async () => ({ location: "https://evil.example/x" });
    const protocolRelative: LegacyLookup = async () => ({ location: "//evil.example/x" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await legacyOutcome("/product/medovik-klassika/", hostile, "/media")).toBeNull();
    expect(await legacyOutcome("/catalog/7/", protocolRelative, "/media")).toBeNull();
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("картинка на домене хранилища (прод) остаётся разрешённой", async () => {
    const outcome = await legacyOutcome(
      "/media/products/2025/11/02/medovik.jpg",
      lookup,
      "https://s3.example.ru/abrikosova",
    );
    expect(outcome).toEqual({
      status: 301,
      location: `https://s3.example.ru/abrikosova/${NEW_KEY}`,
    });
  });
});
