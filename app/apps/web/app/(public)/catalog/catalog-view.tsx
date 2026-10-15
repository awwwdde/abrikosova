/**
 * Каталог по макетам new/design/catalog/ (005b). Серверная часть: данные
 * и верх страницы — крошки, H1 «Каталог» на всех уровнях, справа две строки
 * из контента контактов (`catalog_note`). Табы, «таблетки», фильтры,
 * сортировка и сетка — в клиентском `CatalogBody`.
 *
 * Первая отрисовка — на сервере по параметрам адреса: фильтры, сортировка
 * и страница приходят в `searchParams`, сетка не мигает пустой. «Показать ещё»
 * ведёт на `?page=N`, и сервер рисует все товары страниц 1…N.
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CatalogBody } from "@/app/(public)/catalog/catalog-body";
import { Breadcrumbs } from "@/components/ui";
import {
  apiGet,
  type CatalogFilters,
  type Category,
  type ContactsPage,
  type Page,
  type ProductListItem,
} from "@/lib/api";
import {
  filterParams,
  hasQueryState,
  parseCatalogQuery,
  type CatalogQuery,
} from "@/lib/catalog-query";
import { typograf } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";

/** Сколько товаров за один запрос — предел API. В макете пагинации нет: обычно хватает одной страницы. */
export const PAGE_SIZE = 60;

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type Location = { category?: string; subcategory?: string };

function apiParams(location: Location, query: CatalogQuery): URLSearchParams {
  const params = filterParams(query);
  if (location.category) params.set("category", location.category);
  if (location.subcategory) params.set("subcategory", location.subcategory);
  return params;
}

async function loadProducts(location: Location, query: CatalogQuery) {
  const base = apiParams(location, query);
  base.set("sort", query.sort);
  base.set("page_size", String(PAGE_SIZE));
  // Страницы 1…N параллельно: по ссылке «?page=3» человек видит всё, что
  // успел догрузить, а не только третью порцию
  const pages = await Promise.all(
    Array.from({ length: query.page }, (_, index) => {
      const params = new URLSearchParams(base);
      params.set("page", String(index + 1));
      return apiGet<Page<ProductListItem>>(`/catalog/products?${params}`, 60);
    }),
  );
  return { items: pages.flatMap((page) => page.items), total: pages[0]?.total ?? 0 };
}

/**
 * Метаданные раздела. Адреса с фильтрами, сортировкой или страницей — тот же
 * раздел: `noindex, follow` и канонический адрес без параметров.
 */
export function catalogMetadata(
  base: { title: string; description: string; path: string },
  raw: Record<string, string | string[] | undefined>,
): Metadata {
  const filtered = hasQueryState(parseCatalogQuery(raw));
  return pageMetadata({ ...base, noindex: filtered, canonical: true });
}

export async function CatalogView({
  location,
  searchParams,
}: {
  location: Location;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const query = parseCatalogQuery(searchParams);
  const [categories, contacts] = await Promise.all([
    apiGet<Category[]>("/catalog/categories").catch(() => [] as Category[]),
    apiGet<ContactsPage>("/pages/contacts").catch(() => null),
  ]);

  const category = location.category
    ? categories.find((item) => item.slug === location.category)
    : undefined;
  const subcategory = location.subcategory
    ? category?.subcategories.find((item) => item.slug === location.subcategory)
    : undefined;
  if ((location.category && !category) || (location.subcategory && !subcategory)) notFound();

  const [products, filters] = await Promise.all([
    loadProducts(location, query),
    apiGet<CatalogFilters>(`/catalog/filters?${apiParams(location, query)}`, 60).catch(() => null),
  ]);

  // Полная цепочка вверх по дереву (отступление от макета, там только «Каталог»):
  // так же строится BreadcrumbList для поисковиков (012)
  const crumbs = [
    { href: "/", label: "Главная" },
    { href: category ? "/catalog" : undefined, label: "Каталог" },
    ...(category
      ? [
          {
            href: subcategory ? `/catalog/${category.slug}` : undefined,
            label: category.name,
          },
        ]
      : []),
    ...(subcategory ? [{ label: subcategory.name }] : []),
  ];
  const note = contacts?.content.catalog_note;

  return (
    <div className="container-page pb-20 xl:pb-[127px]">
      <div className="flex flex-col gap-6 pt-8 md:flex-row md:items-start md:justify-between xl:pt-[41px]">
        <div>
          <Breadcrumbs items={crumbs} />
          <h1 className="mt-[26px] font-display text-section leading-none text-ink max-md:mt-4">
            Каталог
          </h1>
        </div>
        {note ? (
          <p className="text-[17px] leading-7 whitespace-pre-line text-ink-muted md:mt-[52px]">
            {typograf(note)}
          </p>
        ) : null}
      </div>

      <CatalogBody
        categories={categories}
        categorySlug={category?.slug ?? null}
        subcategorySlug={subcategory?.slug ?? null}
        query={query}
        items={products.items}
        total={products.total}
        filters={filters}
        intro={(subcategory ? subcategory.intro : category?.intro) ?? null}
      />
    </div>
  );
}
