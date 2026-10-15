import { describe, expect, it } from "vitest";
import type { CatalogSitemap } from "./api";
import { WIP_SECTIONS } from "./pages-status";
import { buildRobots, buildSitemap } from "./seo-files";

describe("robots.txt", () => {
  it("прод: служебное закрыто, есть Sitemap и Host", () => {
    const robots = buildRobots("production");
    expect(robots.rules).toEqual({
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/dev", "/cart", "/checkout", "/order", "/under-construction"],
    });
    expect(robots.sitemap).toMatch(/^https?:\/\/.+\/sitemap\.xml$/);
    expect(robots.host).toMatch(/^https?:\/\//);
  });

  it("не прод (и переменная не задана): закрыто всё, без карты", () => {
    for (const env of ["staging", "development", undefined]) {
      expect(buildRobots(env)).toEqual({ rules: { userAgent: "*", disallow: "/" } });
    }
  });
});

const CATALOG: CatalogSitemap = {
  categories: [{ slug: "torty", subcategories: [{ slug: "bento" }, { slug: "klassika" }] }],
  products: [{ slug: "medovik", updated_at: "2026-09-30T10:00:00Z" }],
};

const DESIGNS = [{ slug: "belyy-s-pionami" }, { slug: "lisenok" }];

const paths = (entries: { url: string }[]) => entries.map((entry) => new URL(entry.url).pathname);

describe("sitemap.xml", () => {
  it("открытые страницы, включая контакты; закрытых разделов нет", () => {
    const urls = paths(buildSitemap(WIP_SECTIONS, CATALOG));
    expect(urls).toEqual([
      "/",
      "/catalog",
      "/custom-cakes",
      "/gallery",
      "/about",
      "/contacts",
      "/privacy",
      "/terms",
      "/consent",
      "/catalog/torty",
      "/catalog/torty/bento",
      "/catalog/torty/klassika",
      "/product/medovik",
    ]);
    for (const section of WIP_SECTIONS) {
      expect(urls.some((url) => url === section || url.startsWith(`${section}/`))).toBe(false);
    }
  });

  it("раздел в WIP_SECTIONS — ни он, ни его страницы в карту не попадают", () => {
    const urls = paths(buildSitemap(["/custom-cakes"], CATALOG, DESIGNS));
    expect(urls.some((url) => url.startsWith("/custom-cakes"))).toBe(false);
  });

  it("дизайны тортов на заказ (008c) — после страниц каталога", () => {
    const entries = buildSitemap(WIP_SECTIONS, CATALOG, DESIGNS);
    expect(paths(entries).slice(-2)).toEqual([
      "/custom-cakes/belyy-s-pionami",
      "/custom-cakes/lisenok",
    ]);
    expect(entries.find((entry) => entry.url.endsWith("/product/medovik"))?.lastModified).toBe(
      "2026-09-30T10:00:00Z",
    );
  });

  it("API недоступен — карта без каталога, а не ошибка", () => {
    expect(paths(buildSitemap([], null))).toEqual([
      "/",
      "/catalog",
      "/custom-cakes",
      "/gallery",
      "/about",
      "/contacts",
      "/privacy",
      "/terms",
      "/consent",
    ]);
  });
});
