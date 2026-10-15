/**
 * sitemap.xml (задание 012): содержимое — lib/seo-files.ts. Закрытые разделы
 * (WIP_SECTIONS) в карту не попадают и появляются в ней сами, когда их оттуда
 * уберут. Кэш — час; правка товара в админке сбрасывает его сразу
 * (revalidate.catalog_paths на бэкенде).
 */

import { apiGet, type CatalogSitemap, type CustomCakeList } from "@/lib/api";
import { WIP_SECTIONS } from "@/lib/pages-status";
import { buildSitemap } from "@/lib/seo-files";

export const revalidate = 3600;

export default async function sitemap() {
  // API недоступен — карта без каталога лучше, чем 500 на sitemap.xml
  const [catalog, designs] = await Promise.all([
    apiGet<CatalogSitemap>("/catalog/sitemap", 3600).catch(() => null),
    // Дизайны тортов на заказ (008c): API отдаёт только активные
    apiGet<CustomCakeList>("/custom-cakes", 3600).catch(() => null),
  ]);
  return buildSitemap(WIP_SECTIONS, catalog, designs?.items ?? null);
}
