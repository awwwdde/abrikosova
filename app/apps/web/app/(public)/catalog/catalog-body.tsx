"use client";

/**
 * Каталог ниже заголовка (005b): табы разделов, «таблетки» подразделов,
 * «Фильтры» и сортировка, сетка с промо-карточкой, «Показать ещё» и текст
 * раздела.
 *
 * Табы, «таблетки» и «Показать ещё» — обычные ссылки: у каждого раздела свой
 * адрес для поиска, и без JS каталог листается. Фильтры и сортировка меняют
 * адрес (`router.push`, без прокрутки наверх); сервер рисует новый список,
 * а пока он грузится, старая сетка бледнеет — пустой сетки человек не видит.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useTransition, type MouseEvent } from "react";
import { FilterPanel } from "@/app/(public)/catalog/filter-panel";
import { SortMenu } from "@/app/(public)/catalog/sort-menu";
import { SubcategoryPills, type Pill } from "@/app/(public)/catalog/subcategory-pills";
import { RevealGroup } from "@/components/motion";
import { ProductCard } from "@/components/product-card";
import { LinkButton } from "@/components/ui";
import type { CatalogFilters, Category, ProductListItem } from "@/lib/api";
import {
  EMPTY_FILTERS,
  catalogSearch,
  countSelected,
  hasFilters,
  pickFilters,
  type CatalogQuery,
  type Filters,
  type Sort,
} from "@/lib/catalog-query";
import { typograf } from "@/lib/format";

/**
 * Где показывать промо-карточку «Нужен торт к празднику?»: у раздела нет
 * флага (в 005a его не заводили), поэтому — по адресу раздела «Торты».
 */
const PROMO_CATEGORY = "torty";

/** Табы и «таблетки» ниже 1024 прокручиваются по горизонтали с затуханием по краю. */
const SCROLLER =
  "scrollbar-none overflow-x-auto max-lg:[mask-image:linear-gradient(to_right,#000_calc(100%-32px),transparent)]";

function Tabs({
  categories,
  active,
  search,
}: {
  categories: Category[];
  active: string | null;
  search: string;
}) {
  const items = [{ slug: null, name: "Все" }, ...categories];
  return (
    <nav
      aria-label="Разделы каталога"
      // С 1280 табы целиком, без прокрутки: линия под ними — по ширине содержимого,
      // как на макете (обрезка последнего таба — ревью 005b); ниже — прокрутка
      className={`${SCROLLER} -mb-px xl:shrink-0 xl:overflow-visible`}
    >
      <ul className="flex w-max min-w-full gap-[40.75px] border-b border-line max-sm:gap-6 xl:min-w-0">
        {items.map((item) => {
          const selected = item.slug === active;
          return (
            <li key={item.slug ?? "all"}>
              <Link
                href={`/catalog${item.slug ? `/${item.slug}` : ""}${search}`}
                aria-current={selected ? "page" : undefined}
                className={`relative block pt-[6px] pb-[16px] text-[17.25px] leading-6 whitespace-nowrap transition-colors duration-150 ${
                  selected ? "text-ink" : "text-ink-muted hover:text-ink"
                }`}
              >
                {typograf(item.name)}
                {selected ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-px h-0.5 bg-accent"
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Pills({
  category,
  active,
  search,
}: {
  category: Category;
  active: string | null;
  search: string;
}) {
  // «Таблетки» подразделов, где нечего показать, не выводим (ревью 005a)
  const subs = category.subcategories.filter((sub) => sub.product_count > 0);
  const items: Pill[] = [
    { slug: null, name: category.all_label || "Все", href: `/catalog/${category.slug}${search}` },
    ...subs.map((sub) => ({
      slug: sub.slug,
      name: sub.name,
      href: `/catalog/${category.slug}/${sub.slug}${search}`,
    })),
  ];
  // Не помещаются в строку — последние уходят под «Ещё» (006b, SubcategoryPills)
  return (
    <SubcategoryPills
      label={`Подразделы: ${category.name}`}
      items={items}
      active={active}
      className={`${SCROLLER} mt-[21px]`}
    />
  );
}

function PromoCard() {
  return (
    <article className="flex min-h-full flex-col bg-accent px-8 pt-[39px] pb-9 text-on-accent max-sm:px-4 max-sm:pt-5 max-sm:pb-5">
      <h2 className="font-display text-[32px] leading-[1.15] max-sm:text-xl">
        Нужен торт
        <br />к празднику?
      </h2>
      <p className="mt-[22px] text-[15px] leading-6 text-on-accent/80 max-sm:mt-3 max-sm:text-xs max-sm:leading-5">
        {typograf(
          "Здесь торты фиксированного веса. Под ваш повод соберём торт с нуля: вес по числу гостей, начинка на выбор из больше чем двадцати, оформление по эскизу",
        )}
      </p>
      <Link
        href="/custom-cakes"
        className="mt-auto inline-flex h-[52px] w-fit items-center bg-on-accent px-7 text-[15px] font-medium text-accent transition-colors duration-150 hover:bg-cream max-sm:h-10 max-sm:px-4 max-sm:text-sm"
      >
        Заказать торт
      </Link>
    </article>
  );
}

export function CatalogBody({
  categories,
  categorySlug,
  subcategorySlug,
  query,
  items,
  total,
  filters,
  intro,
}: {
  categories: Category[];
  categorySlug: string | null;
  subcategorySlug: string | null;
  query: CatalogQuery;
  items: ProductListItem[];
  total: number;
  filters: CatalogFilters | null;
  intro: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const filtersButton = useRef<HTMLButtonElement>(null);

  const applied = pickFilters(query);
  const category = categories.find((item) => item.slug === categorySlug) ?? null;
  // Табы и «таблетки» сохраняют выбранные фильтры и сортировку, но не страницу
  const keep = catalogSearch({ ...applied, sort: query.sort });
  // Промо — в самой категории «Торты» (не в подразделах), на первой странице, без фильтров
  const showPromo =
    categorySlug === PROMO_CATEGORY && !subcategorySlug && query.page === 1 && !hasFilters(applied);
  const hasMore = items.length < total;

  function go(next: Partial<CatalogQuery>) {
    const search = catalogSearch({ ...applied, sort: query.sort, ...next });
    startTransition(() => router.push(`${pathname}${search}`, { scroll: false }));
  }

  function loadMore(event: MouseEvent<HTMLAnchorElement>) {
    // Без JS это обычная ссылка; с JS — та же навигация, но без прокрутки наверх
    event.preventDefault();
    go({ page: query.page + 1 });
  }

  return (
    <>
      <div className="mt-[53px] flex flex-col gap-5 max-xl:mt-8 xl:flex-row xl:flex-wrap xl:items-end xl:justify-between">
        <Tabs categories={categories} active={categorySlug} search={keep} />
        <div className="flex items-center justify-between gap-6 max-sm:grid max-sm:grid-cols-2 max-sm:gap-2 xl:pt-0">
          <FilterPanel
            buttonRef={filtersButton}
            location={{ category: categorySlug, subcategory: subcategorySlug }}
            applied={applied}
            initial={filters}
            selectedCount={countSelected(applied)}
            onApply={(next: Filters) => go({ ...next, page: 1 })}
          />
          <SortMenu value={query.sort} onChange={(sort: Sort) => go({ sort, page: 1 })} />
        </div>
      </div>

      {category ? <Pills category={category} active={subcategorySlug} search={keep} /> : null}

      <div
        aria-busy={pending || undefined}
        data-catalog-results
        className={`${category ? "mt-10" : "mt-[41px]"} transition-opacity duration-200 ${pending ? "opacity-50" : ""}`}
      >
        {/* Заголовок списка для скринридеров и порядка заголовков: после H1
            «Каталог» карточки (H3) шли бы без H2 (Lighthouse heading-order) */}
        <h2 className="sr-only">
          {subcategorySlug
            ? `Товары подраздела «${category?.subcategories.find((sub) => sub.slug === subcategorySlug)?.name ?? ""}»`
            : category
              ? `Товары раздела «${category.name}»`
              : "Все товары"}
        </h2>
        {items.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-24 text-center">
            <h2 className="font-display text-[40px] leading-tight text-ink max-sm:text-[28px]">
              Ничего не нашлось
            </h2>
            <p className="mt-3 text-base text-ink-muted">
              {typograf("Попробуйте убрать часть фильтров")}
            </p>
            <LinkButton
              href={`${pathname}${catalogSearch({ ...EMPTY_FILTERS, sort: query.sort })}`}
              variant="outline"
              size="md"
              className="mt-8"
              scroll={false}
            >
              Сбросить фильтры
            </LinkButton>
          </div>
        ) : (
          <RevealGroup
            as="ul"
            key={`${pathname}${keep}`}
            className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-6 lg:grid-cols-3 xl:grid-cols-4 xl:gap-y-12"
          >
            {showPromo ? (
              <li>
                <PromoCard />
              </li>
            ) : null}
            {items.map((product, index) => (
              <li key={product.id}>
                <ProductCard
                  product={product}
                  meta="catalog"
                  // Первый ряд (4 на десктопе) — в первом экране, его фото и есть LCP
                  priority={index < 4}
                  sizes="(min-width: 1280px) 336px, (min-width: 1024px) 31vw, 47vw"
                />
              </li>
            ))}
          </RevealGroup>
        )}

        {hasMore ? (
          <div className="mt-14 flex justify-center">
            <LinkButton
              href={`${pathname}${catalogSearch({ ...applied, sort: query.sort, page: query.page + 1 })}`}
              onClick={loadMore}
              variant="outline"
              size="md"
              scroll={false}
            >
              Показать ещё
            </LinkButton>
          </div>
        ) : null}
      </div>

      {intro ? (
        <div className="mt-[95px] border-t border-line pt-[30px] max-sm:mt-12">
          <p className="max-w-[1100px] text-[15px] leading-7 whitespace-pre-line text-ink-muted">
            {typograf(intro)}
          </p>
        </div>
      ) : null}
    </>
  );
}
