/**
 * Middleware целиком (012a): итоговый Location всегда того же origin, что и запрос.
 * Проверяет и правила lib/legacy-redirects.ts, и последний рубеж в самом middleware.
 */

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { middleware } from "./middleware";

const ORIGIN = "https://abrikosova-elena.ru";

async function run(path: string) {
  // new URL сам схлопнул бы «//», поэтому путь собирается как строка
  const response = await middleware(new NextRequest(`${ORIGIN}${path}`));
  return { status: response.status, location: response.headers.get("location") };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("middleware: Location только своего сайта", () => {
  const PATHS = [
    "//evil.example/",
    "/\\evil.example/",
    "/%2F%2Fevil.example/",
    "///evil.example/",
    "/product/%2F%2Fevil/",
    // Обычные старые адреса — для сравнения: редирект есть, origin свой
    "/about/",
    "/catalog/7/",
    "/product/medovik/",
    "/about/?utm_source=ya",
  ];

  it.each(PATHS)("%s", async (path) => {
    // API соответствий в тесте нет — запасные варианты 012
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 404 })),
    );
    const { status, location } = await run(path);
    if (location) {
      expect(new URL(location, ORIGIN).origin).toBe(ORIGIN);
      expect(status).toBe(301);
    }
  });

  it("обычные редиректы 012 не сломались: одношаговые 301, utm сохраняется", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 404 })),
    );
    expect(await run("/about/")).toEqual({ status: 301, location: `${ORIGIN}/about` });
    expect(await run("/about/?utm_source=ya")).toEqual({
      status: 301,
      location: `${ORIGIN}/about?utm_source=ya`,
    });
    expect((await run("/create-consultation/")).status).toBe(410);
  });

  it("API вернул чужой адрес — middleware не редиректит", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ location: "https://evil.example/" })),
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});
    // Свой ключ, чтобы не попасть в кэш ответов API из прошлых проверок
    const { location } = await run("/product/only-in-this-test/");
    expect(location).toBeNull();
  });
});
