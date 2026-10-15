"use client";

/**
 * Каталог (011e): «Товары» — список с фильтрами и массовыми действиями,
 * «Разделы» — порядок, названия, видимость. Вкладка и фильтры — в адресе.
 * Правка товара — в отдельной карточке `/admin/catalog/products/[id]` (011d);
 * старая встроенная форма удалена.
 */

import { Plus } from "@phosphor-icons/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import { ProductsList } from "@/components/admin/catalog/products-list";
import { SectionsEditor } from "@/components/admin/catalog/sections";
import { ButtonLink, Notice } from "@/components/admin/ui";
import { DEFAULT_CATALOG, catalogQueryString, parseCatalog } from "@/lib/admin-catalog";
import { ApiError, type CategoryAdmin } from "@/lib/api";

function CatalogView() {
  const { authFetch } = useAdminAuth();
  const params = useSearchParams();
  const query = useMemo(() => parseCatalog(new URLSearchParams(params.toString())), [params]);
  const [categories, setCategories] = useState<CategoryAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      setCategories(await authFetch<CategoryAdmin[]>("/admin/categories"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось загрузить разделы");
    }
  }, [authFetch]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const tabs = [
    { view: "products" as const, label: "Товары" },
    { view: "sections" as const, label: "Разделы" },
  ];

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[34px] leading-[1.05] font-normal adm-sm:text-[42px]">
            Каталог
          </h1>
          <p className="text-[15px] text-admin-muted">
            Товары, их видимость на сайте и разделы каталога
          </p>
        </div>
        <ButtonLink
          href="/admin/catalog/products/new"
          icon={<Plus aria-hidden="true" size={18} weight="bold" />}
        >
          Новый товар
        </ButtonLink>
      </div>

      <nav aria-label="Раздел каталога" className="flex gap-2">
        {tabs.map((tab) => {
          const selected = query.view === tab.view;
          return (
            <Link
              key={tab.view}
              href={`/admin/catalog${catalogQueryString({ ...(tab.view === "products" ? query : DEFAULT_CATALOG), view: tab.view, page: 1 })}`}
              scroll={false}
              aria-current={selected ? "page" : undefined}
              className={`inline-flex h-10 items-center rounded-full px-4 text-[13.5px] font-bold no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-side ${
                selected
                  ? "bg-admin-side text-admin-card"
                  : "bg-admin-card text-admin-ink shadow-admin-card hover:bg-admin-soft"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {error ? <Notice role="alert">{error}</Notice> : null}

      {query.view === "sections" ? (
        <SectionsEditor categories={categories} onChanged={loadCategories} />
      ) : (
        <ProductsList query={query} categories={categories ?? []} />
      )}
    </div>
  );
}

export default function AdminCatalogPage() {
  return (
    <Suspense>
      <CatalogView />
    </Suspense>
  );
}
