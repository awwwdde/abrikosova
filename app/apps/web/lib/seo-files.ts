/**
 * Содержимое robots.txt и sitemap.xml (задание 012). Чистые функции: окружение
 * и список закрытых разделов передаются параметрами — так оба режима и «раздел
 * открылся» проверяются тестом без Next (seo-files.test.ts).
 */

import type { MetadataRoute } from "next";
import type { CatalogSitemap } from "./api";
import { SITE_URL } from "./seo";

/** Служебное, личное и заглушка — в индекс не нужно. */
export const ROBOTS_DISALLOW = [
  "/admin",
  "/api",
  "/dev",
  "/cart",
  "/checkout",
  "/order",
  "/under-construction",
];

export function buildRobots(siteEnv: string | undefined): MetadataRoute.Robots {
  // Тестовый стенд целиком закрыт: копия сайта в выдаче отняла бы позиции у настоящего
  if (siteEnv !== "production") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: ROBOTS_DISALLOW },
    sitemap: `${SITE_URL}/sitemap.xml`,
    // Host — директива Яндекса: какое зеркало главное
    host: SITE_URL,
  };
}

// Разделы сайта, которые попадают в карту, как только их уберут из WIP_SECTIONS
const SECTIONS = ["/catalog", "/custom-cakes", "/gallery", "/about", "/contacts"];

export function buildSitemap(
  wipSections: readonly string[],
  catalog: CatalogSitemap | null,
  /** Активные дизайны тортов на заказ (`GET /custom-cakes`, 008c) */
  designs: { slug: string }[] | null = null,
): MetadataRoute.Sitemap {
  const open = (path: string) => !wipSections.includes(path);
  const url = (path: string) => `${SITE_URL}${path === "/" ? "" : path}`;

  const entries: MetadataRoute.Sitemap = [
    { url: url("/"), changeFrequency: "daily", priority: 1 },
    ...SECTIONS.filter(open).map((path) => ({
      url: url(path),
      changeFrequency: "weekly" as const,
      priority: path === "/catalog" ? 0.9 : 0.7,
    })),
    { url: url("/privacy"), changeFrequency: "yearly", priority: 0.2 },
    { url: url("/terms"), changeFrequency: "yearly", priority: 0.2 },
    { url: url("/consent"), changeFrequency: "yearly", priority: 0.2 },
  ];

  if (catalog && open("/catalog")) {
    for (const category of catalog.categories) {
      entries.push({
        url: url(`/catalog/${category.slug}`),
        changeFrequency: "weekly",
        priority: 0.8,
      });
      for (const sub of category.subcategories) {
        entries.push({
          url: url(`/catalog/${category.slug}/${sub.slug}`),
          changeFrequency: "weekly",
          priority: 0.7,
        });
      }
    }
  }
  if (catalog && open("/product")) {
    for (const product of catalog.products) {
      entries.push({
        url: url(`/product/${product.slug}`),
        lastModified: product.updated_at,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  }
  if (designs && open("/custom-cakes")) {
    for (const design of designs) {
      entries.push({
        url: url(`/custom-cakes/${design.slug}`),
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
  }
  return entries;
}
