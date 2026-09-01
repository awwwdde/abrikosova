"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProductCard } from "@/components/product-card";
import { Breadcrumbs, Button, EmptyState, Input, Select } from "@/components/ui";
import { apiFetch, type Category, type Page, type ProductListItem } from "@/lib/api";

const SORT_OPTIONS = [
  { value: "", label: "По умолчанию" },
  { value: "price_asc", label: "Сначала дешевле" },
  { value: "price_desc", label: "Сначала дороже" },
  { value: "name", label: "По названию" },
  { value: "new", label: "Сначала новые" },
];

const PAGE_SIZE = 12;

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function CatalogView({
  categories,
  activeCategory,
  activeSubcategory,
}: {
  categories: Category[];
  activeCategory?: string;
  activeSubcategory?: string;
}) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<ProductListItem> | null>(null);
  const [loading, setLoading] = useState(true);

  // Debounce: поиск не должен бить в API на каждое нажатие клавиши
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
    if (debounced) params.set("search", debounced);
    if (sort) params.set("sort", sort);
    if (activeCategory) params.set("category", activeCategory);
    if (activeSubcategory) params.set("subcategory", activeSubcategory);

    let cancelled = false;
    setLoading(true);
    apiFetch<Page<ProductListItem>>(`/catalog/products?${params}`)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debounced, sort, page, activeCategory, activeSubcategory]);

  const category = useMemo(
    () => categories.find((c) => c.slug === activeCategory),
    [categories, activeCategory],
  );
  const subcategory = useMemo(
    () => category?.subcategories.find((s) => s.slug === activeSubcategory),
    [category, activeSubcategory],
  );

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="container-page py-10 md:py-14">
      <Breadcrumbs
        items={[
          { href: "/", label: "Главная" },
          { href: "/catalog", label: "Каталог" },
          ...(category ? [{ href: `/catalog/${category.slug}`, label: category.name }] : []),
          ...(subcategory ? [{ label: subcategory.name }] : []),
        ]}
      />

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-4xl">{subcategory?.name ?? category?.name ?? "Каталог"}</h1>
        {data ? (
          <p className="tnum text-sm text-ink-subtle">
            {data.total}{" "}
            {data.total % 10 === 1 && data.total % 100 !== 11
              ? "позиция"
              : [2, 3, 4].includes(data.total % 10) && ![12, 13, 14].includes(data.total % 100)
                ? "позиции"
                : "позиций"}
          </p>
        ) : null}
      </div>

      <div className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-12">
        <aside className="md:col-span-3">
          <p className="eyebrow mb-4">Категории</p>
          <ul className="space-y-0.5 text-sm">
            <li>
              <Link
                href="/catalog"
                className={`block rounded-sm px-2 py-1.5 -mx-2 transition-colors duration-150 ${
                  !activeCategory
                    ? "bg-surface-sunken font-medium text-ink"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                Все товары
              </Link>
            </li>
            {categories.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/catalog/${item.slug}`}
                  className={`block rounded-sm px-2 py-1.5 -mx-2 transition-colors duration-150 ${
                    item.slug === activeCategory && !activeSubcategory
                      ? "bg-surface-sunken font-medium text-ink"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {item.name}
                </Link>

                {item.slug === activeCategory && item.subcategories.length > 0 ? (
                  <ul className="mb-1 ml-2 space-y-0.5 border-l border-line pl-3 text-xs">
                    {item.subcategories.map((sub) => (
                      <li key={sub.id}>
                        <Link
                          href={`/catalog/${item.slug}/${sub.slug}`}
                          className={`block py-1.5 transition-colors duration-150 ${
                            sub.slug === activeSubcategory
                              ? "font-medium text-accent"
                              : "text-ink-muted hover:text-ink"
                          }`}
                        >
                          {sub.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </aside>

        <div className="md:col-span-9">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle">
                <SearchIcon />
              </span>
              <Input
                type="search"
                placeholder="Поиск по названию"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Поиск по каталогу"
                className="pl-9"
              />
            </div>
            <Select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(1);
              }}
              aria-label="Сортировка"
              className="sm:w-52"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 md:gap-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="animate-pulse rounded-lg bg-surface-sunken"
                  style={{ aspectRatio: "4/5.9" }}
                />
              ))}
            </div>
          ) : !data || data.items.length === 0 ? (
            <EmptyState
              title={debounced ? "Ничего не найдено" : "В этой категории пока пусто"}
              description={
                debounced
                  ? `По запросу «${debounced}» нет совпадений. Попробуйте другое слово.`
                  : "Мы скоро добавим сюда новые позиции."
              }
              action={
                debounced ? (
                  <Button variant="secondary" onClick={() => setSearch("")}>
                    Сбросить поиск
                  </Button>
                ) : (
                  <Link
                    href="/catalog"
                    className="text-sm text-accent transition-colors hover:text-accent-hover"
                  >
                    Смотреть весь каталог →
                  </Link>
                )
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 md:gap-6">
                {data.items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {totalPages > 1 ? (
                <div className="mt-12 flex items-center justify-center gap-4">
                  <Button
                    variant="secondary"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Назад
                  </Button>
                  <span className="tnum text-sm text-ink-muted">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Далее
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
