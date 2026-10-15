"use client";

/**
 * Каталог: список товаров (011e) — строки-карточки как «Популярное» и заказы.
 *
 * Фильтры в адресе; «на сайте» — переключатель прямо в строке (оптимистично,
 * откат и тост при ошибке); массовые действия — выбор галочками и один запрос
 * `POST /admin/products/bulk`, журнал при этом получает запись по каждому товару.
 */

import {
  Eye,
  ImageSquare,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Stack,
  Storefront,
  Tag,
} from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import {
  Badge,
  Button,
  ButtonLink,
  ColumnLabel,
  ConfirmDialog,
  EmptyState,
  FilterMenu,
  Input,
  Notice,
  Pagination,
  Skeleton,
  Switch,
  useToast,
} from "@/components/admin/ui";
import {
  STOCK_OPTIONS,
  VISIBILITY_OPTIONS,
  catalogApiParams,
  catalogQueryString,
  hasFilters,
  sectionText,
  DEFAULT_CATALOG,
  type CatalogQuery,
} from "@/lib/admin-catalog";
import {
  ApiError,
  formatPrice,
  imageUrl,
  type CategoryAdmin,
  type Page,
  type ProductAdminListItem,
} from "@/lib/api";
import { pluralRu } from "@/lib/format";
import { hasPriceRange } from "@/lib/product-meta";

const PAGE_SIZE = 20;
// Таблица — от 1280px (011g). Её колонки фиксированной ширины занимают ~740px,
// а на 768–1279 рядом с меню остаётся 690–720: название товара сжималось до нуля,
// «На сайте» уезжало за край и давало горизонтальную прокрутку. Уже — карточка
const COLUMNS = "adm-xl:grid-cols-[28px_48px_minmax(0,1fr)_110px_150px_120px_190px]";

type BulkAction = "hide" | "show" | "unavailable" | "sold_out" | "back_in_stock";
const BULK: Record<BulkAction, { label: string; verb: string }> = {
  hide: { label: "Скрыть с сайта", verb: "Скрыть с сайта" },
  show: { label: "Показать на сайте", verb: "Показать на сайте" },
  unavailable: { label: "Снять с наличия", verb: "Снять с наличия" },
  // 006b: витрина кончилась — до полуночи под заказ на завтра
  sold_out: { label: "Закончилось сегодня", verb: "Отметить «Закончилось сегодня»" },
  back_in_stock: { label: "Снова есть сегодня", verb: "Вернуть в наличие сегодня" },
};

const money = (value: string | number) => formatPrice(value).replace(" ₽", " ₽");

/** «от 2 400 ₽», если цены включённых вариантов различаются (005a); без вариантов — «—». */
function priceText(product: ProductAdminListItem): string {
  if (product.price_from === null) return "—";
  const active = product.variants.filter((variant) => variant.is_active);
  return `${hasPriceRange(active) ? "от " : ""}${money(product.price_from)}`;
}

function stockBadge(product: ProductAdminListItem) {
  if (!product.is_available) return <Badge tone="accent">Нет в наличии</Badge>;
  if (product.sold_out_today) return <Badge tone="amber">Закончилось сегодня</Badge>;
  if (product.lead_time_days > 0) {
    const days = product.lead_time_days;
    return (
      <Badge tone="amber">
        Под заказ, {days}&nbsp;{pluralRu(days, ["день", "дня", "дней"])}
      </Badge>
    );
  }
  return <Badge tone="green">В наличии</Badge>;
}

export function ProductsList({
  query,
  categories,
}: {
  query: CatalogQuery;
  categories: CategoryAdmin[];
}) {
  const { authFetch } = useAdminAuth();
  const toast = useToast();
  const router = useRouter();
  const [data, setData] = useState<Page<ProductAdminListItem> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulk, setBulk] = useState<BulkAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(query.q);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(
        await authFetch<Page<ProductAdminListItem>>(
          `/admin/products?${catalogApiParams(query, PAGE_SIZE)}`,
        ),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось загрузить каталог");
    } finally {
      setLoading(false);
    }
  }, [authFetch, query]);

  useEffect(() => {
    void load();
    setSelected(new Set());
  }, [load]);

  const go = useCallback(
    (next: Partial<CatalogQuery>) => {
      router.push(`/admin/catalog${catalogQueryString({ ...query, page: 1, ...next })}`, {
        scroll: false,
      });
    },
    [query, router],
  );

  // Поиск — с задержкой 300 мс, чтобы не дёргать адрес на каждую букву
  useEffect(() => {
    if (search === query.q) return;
    const timer = window.setTimeout(() => go({ q: search }), 300);
    return () => window.clearTimeout(timer);
  }, [search, query.q, go]);

  const category = categories.find((item) => String(item.id) === query.category);
  const categoryOptions = useMemo(
    () => [
      { value: "", label: "Все разделы" },
      ...categories.map((item) => ({ value: String(item.id), label: item.name })),
    ],
    [categories],
  );
  const subOptions = useMemo(
    () => [
      { value: "", label: "Все подразделы" },
      ...(category?.subcategories ?? []).map((item) => ({
        value: String(item.id),
        label: item.name,
      })),
    ],
    [category],
  );

  async function toggleVisible(product: ProductAdminListItem, next: boolean) {
    setData(
      (current) =>
        current && {
          ...current,
          items: current.items.map((item) =>
            item.id === product.id ? { ...item, is_active: next } : item,
          ),
        },
    );
    try {
      await authFetch("/admin/products/bulk", {
        method: "POST",
        body: JSON.stringify({ ids: [product.id], action: next ? "show" : "hide" }),
      });
      toast.success(next ? `«${product.name}» снова на сайте` : `«${product.name}» скрыт с сайта`);
    } catch (err) {
      setData(
        (current) =>
          current && {
            ...current,
            items: current.items.map((item) =>
              item.id === product.id ? { ...item, is_active: !next } : item,
            ),
          },
      );
      toast.error(err instanceof ApiError ? err.message : "Не удалось изменить видимость");
    }
  }

  async function runBulk() {
    if (!bulk) return;
    setBusy(true);
    try {
      const result = await authFetch<{ updated: number }>("/admin/products/bulk", {
        method: "POST",
        body: JSON.stringify({ ids: [...selected], action: bulk }),
      });
      toast.success(
        result.updated === 0
          ? "Ничего не изменилось: у выбранных товаров уже так"
          : `Готово: ${result.updated} ${pluralRu(result.updated, ["товар", "товара", "товаров"])}`,
      );
      setBulk(null);
      setSelected(new Set());
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось выполнить действие");
    } finally {
      setBusy(false);
    }
  }

  const items = data?.items ?? [];
  const allChecked = items.length > 0 && items.every((item) => selected.has(item.id));
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const count = selected.size;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="w-full adm-sm:w-64">
          <Input
            type="search"
            aria-label="Поиск по названию"
            placeholder="Поиск по названию"
            icon={<MagnifyingGlass size={18} />}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <FilterMenu
          label="Раздел"
          icon={<Stack size={17} />}
          value={query.category}
          options={categoryOptions}
          onChange={(value) => go({ category: value, subcategory: "" })}
        />
        {category ? (
          <FilterMenu
            label="Подраздел"
            value={query.subcategory}
            options={subOptions}
            onChange={(value) => go({ subcategory: value })}
          />
        ) : null}
        <FilterMenu
          label="Наличие"
          icon={<Tag size={17} />}
          value={query.stock}
          options={STOCK_OPTIONS}
          onChange={(stock) => go({ stock })}
        />
        <FilterMenu
          label="Видимость"
          icon={<Storefront size={17} />}
          value={query.visibility}
          options={VISIBILITY_OPTIONS}
          onChange={(visibility) => go({ visibility })}
        />
      </div>

      {count > 0 ? (
        <div
          role="region"
          aria-label="Действия с выбранными"
          className="flex flex-wrap items-center gap-2.5 rounded-admin-card bg-admin-ink px-4 py-2.5 text-admin-card"
        >
          <span className="mr-2 text-sm font-bold tabular-nums">Выбрано: {count}</span>
          {(Object.keys(BULK) as BulkAction[]).map((action) => (
            <Button key={action} variant="soft" size="sm" onClick={() => setBulk(action)}>
              {BULK[action].label}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-admin-card hover:bg-admin-card/10 hover:text-admin-card"
            onClick={() => setSelected(new Set())}
          >
            Снять выбор
          </Button>
        </div>
      ) : null}

      <div className={`hidden items-center gap-4 px-5 adm-xl:grid ${COLUMNS}`}>
        <input
          type="checkbox"
          aria-label="Выбрать все товары на странице"
          checked={allChecked}
          onChange={(event) =>
            setSelected(event.target.checked ? new Set(items.map((item) => item.id)) : new Set())
          }
          className="size-4 accent-admin-side"
        />
        <ColumnLabel>Фото</ColumnLabel>
        <ColumnLabel>Товар</ColumnLabel>
        <ColumnLabel className="text-right">Цена</ColumnLabel>
        <ColumnLabel className="text-center">Наличие</ColumnLabel>
        <ColumnLabel>На сайте</ColumnLabel>
        <ColumnLabel className="text-right">Действия</ColumnLabel>
      </div>

      {error ? (
        <Notice
          role="alert"
          action={
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Повторить
            </Button>
          }
        >
          {error}
        </Notice>
      ) : !data ? (
        [0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-[84px] rounded-admin-card" />
        ))
      ) : items.length === 0 ? (
        <div className="rounded-admin-card bg-admin-card shadow-admin-card">
          <EmptyState
            title={hasFilters(query) ? "Ничего не нашлось" : "Каталог пуст"}
            text={
              hasFilters(query)
                ? "Попробуйте другие фильтры или сбросьте их"
                : "Добавьте первый товар, он появится здесь"
            }
            action={
              hasFilters(query) ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    router.push(`/admin/catalog${catalogQueryString(DEFAULT_CATALOG)}`);
                  }}
                >
                  Сбросить фильтры
                </Button>
              ) : (
                <ButtonLink href="/admin/catalog/products/new" size="sm" icon={<Plus size={16} />}>
                  Новый товар
                </ButtonLink>
              )
            }
          />
        </div>
      ) : (
        <ul className={`flex flex-col gap-3 ${loading ? "opacity-60" : ""}`}>
          {items.map((product) => {
            const src = imageUrl(product.main_image);
            const checked = selected.has(product.id);
            return (
              <li
                key={product.id}
                className={`grid grid-cols-[28px_48px_minmax(0,1fr)] items-center gap-x-4 gap-y-2 rounded-admin-card border-[1.5px] bg-admin-card px-5 py-3 shadow-admin-card transition-shadow duration-150 hover:shadow-admin-hover ${COLUMNS} ${
                  checked ? "border-admin-side" : "border-transparent"
                }`}
              >
                <input
                  type="checkbox"
                  aria-label={`Выбрать «${product.name}»`}
                  checked={checked}
                  onChange={(event) =>
                    setSelected((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(product.id);
                      else next.delete(product.id);
                      return next;
                    })
                  }
                  className="size-4 accent-admin-side"
                />
                <span className="flex h-[60px] w-12 items-center justify-center overflow-hidden rounded-lg bg-admin-photo text-admin-faint">
                  {src ? (
                    <Image
                      src={src}
                      alt=""
                      width={48}
                      height={60}
                      sizes="48px"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImageSquare aria-hidden="true" size={22} />
                  )}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <Link
                    href={`/admin/catalog/products/${product.id}`}
                    className="truncate text-[14.5px] font-bold text-admin-ink no-underline hover:text-admin-side"
                  >
                    {product.name}
                  </Link>
                  <span className="truncate text-[13px] text-admin-muted">
                    {sectionText(product.category_name, product.subcategory_name)}
                  </span>
                </span>
                <span className="col-start-3 text-[15px] font-bold tabular-nums adm-xl:col-start-auto adm-xl:text-right">
                  {priceText(product)}
                </span>
                <span className="col-start-3 adm-xl:col-start-auto adm-xl:text-center">
                  {stockBadge(product)}
                </span>
                <span className="col-start-3 adm-xl:col-start-auto">
                  <Switch
                    checked={product.is_active}
                    onChange={(next) => void toggleVisible(product, next)}
                    label={`На сайте: ${product.name}`}
                    hideLabel
                  />
                </span>
                <span className="col-span-3 flex justify-end gap-3.5 text-[13.5px] font-bold adm-xl:col-span-1">
                  <Link
                    href={`/admin/catalog/products/${product.id}`}
                    className="inline-flex items-center gap-[5px] text-admin-ink no-underline hover:text-admin-side"
                  >
                    <PencilSimple aria-hidden="true" size={16} />
                    Изменить<span className="sr-only"> «{product.name}»</span>
                  </Link>
                  {product.is_active ? (
                    <a
                      href={`/product/${product.slug}`}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-[5px] text-admin-side no-underline hover:text-admin-hover"
                    >
                      <Eye aria-hidden="true" size={16} />
                      На сайте<span className="sr-only"> (в новой вкладке)</span>
                    </a>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {data && data.total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1.5 text-[13.5px] text-admin-muted">
          <span aria-live="polite">
            Показано {items.length} из {data.total}
          </span>
          <Pagination page={query.page} pages={pages} onChange={(page) => go({ page })} />
        </div>
      ) : null}

      <ConfirmDialog
        open={bulk !== null}
        title={
          bulk
            ? `${BULK[bulk].verb}: ${count} ${pluralRu(count, ["товар", "товара", "товаров"])}?`
            : ""
        }
        text="Изменение сразу видно на сайте. В журнал запишется каждый товар отдельно."
        confirmLabel={bulk ? BULK[bulk].label : ""}
        loading={busy}
        onConfirm={() => void runBulk()}
        onClose={() => setBulk(null)}
      />
    </div>
  );
}
