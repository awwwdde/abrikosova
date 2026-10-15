"use client";

/**
 * «Заказы» (011d, концепт Orders.dc.html): фильтры, вкладки по статусам со
 * счётчиками, строки-карточки, пагинация по 20 и липкая карточка заказа справа.
 *
 * Выбранный заказ — в адресе (`/admin/orders/[id]`), фильтры — в параметрах:
 * на заказ можно дать ссылку, а «Назад» в браузере возвращает к прежней выборке.
 * Уже 1024 карточка открывается на весь экран со ссылкой «Назад к списку».
 */

import { CalendarBlank, CaretLeft, DownloadSimple, Truck } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import { useCounters } from "@/components/admin/counters";
import { OrderCard, OrderCardEmpty } from "@/components/admin/orders/order-card";
import {
  Avatar,
  Button,
  ColumnLabel,
  EmptyState,
  FilterMenu,
  Input,
  Notice,
  Pagination,
  Skeleton,
  StatusBadge,
  useToast,
} from "@/components/admin/ui";
import { intervalLabel, shortName } from "@/lib/admin-dashboard";
import {
  METHODS,
  ORDER_TABS,
  PERIODS,
  apiParams,
  parseQuery,
  queryString,
  shortNumber,
  tabOf,
  type OrderQuery,
} from "@/lib/admin-orders";
import { ApiError, formatPrice, type OrderListPage, type OrderStatus } from "@/lib/api";
import { formatDayShort, typograf } from "@/lib/format";

const PAGE_SIZE = 20;
// Таблица в шесть колонок — только от 1536px (011g). Уже рядом с карточкой
// заказа (400px) списку остаётся ~610px: имя клиента сжималось до нуля, состав —
// до «Корп…». До 1536 строка двухэтажная, как на узком экране
const ROW_COLUMNS = "adm-2xl:grid-cols-[72px_minmax(0,1.2fr)_150px_minmax(0,1.2fr)_96px_136px]";

const money = (value: string | number) => formatPrice(value).replace(" ₽", " ₽");

export function OrdersView({ selectedId }: { selectedId: number | null }) {
  const { authFetch, download } = useAdminAuth();
  const { refresh: refreshCounters } = useCounters();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const query = useMemo(() => parseQuery(new URLSearchParams(params.toString())), [params]);
  const [data, setData] = useState<OrderListPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await authFetch<OrderListPage>(`/admin/orders?${apiParams(query, PAGE_SIZE)}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось загрузить заказы");
    } finally {
      setLoading(false);
    }
  }, [authFetch, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const qs = queryString(query);
  const go = (next: Partial<OrderQuery>) => {
    const merged = { ...query, page: 1, ...next };
    router.push(
      `${selectedId ? `/admin/orders/${selectedId}` : "/admin/orders"}${queryString(merged)}`,
      {
        scroll: false,
      },
    );
  };

  // Строка списка и счётчики вкладок следуют за статусом из карточки — сразу,
  // без перезагрузки; если сервер отказал, карточка вызовет это же с прежним статусом
  const onStatusChange = useCallback(
    (id: number, status: OrderStatus) => {
      setData((current) => {
        if (!current) return current;
        const before = current.items.find((item) => item.id === id);
        if (!before || before.status === status) return current;
        const counts = { ...current.counts };
        const from = tabOf(before.status);
        const to = tabOf(status);
        if (from !== to) {
          counts[from] = Math.max(0, (counts[from] ?? 0) - 1);
          counts[to] = (counts[to] ?? 0) + 1;
        }
        return {
          ...current,
          counts,
          items: current.items.map((item) => (item.id === id ? { ...item, status } : item)),
        };
      });
      void refreshCounters();
    },
    [refreshCounters],
  );

  async function exportCsv() {
    setExporting(true);
    try {
      await download(`/admin/orders/export.csv?${apiParams(query, PAGE_SIZE, true)}`, "zakazy.csv");
    } catch {
      toast.error("Не удалось выгрузить файл. Попробуйте ещё раз");
    } finally {
      setExporting(false);
    }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const listHidden = selectedId !== null; // на узком экране показываем только карточку

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        {/* Карточка на весь экран: заголовок раздела остаётся для скринридера */}
        <div className={`flex flex-col gap-1.5 ${listHidden ? "max-adm-lg:sr-only" : ""}`}>
          <h1 className="font-display text-[34px] leading-[1.05] font-normal adm-sm:text-[42px]">
            Заказы
          </h1>
          <p className="text-[15px] text-admin-muted">
            {typograf("Нажмите на заказ, чтобы открыть его справа")}
          </p>
        </div>
        <div
          className={`flex flex-wrap items-center gap-2.5 ${listHidden ? "max-adm-lg:hidden" : ""}`}
        >
          <FilterMenu
            label="Дата получения"
            icon={<CalendarBlank size={17} />}
            value={query.period}
            options={PERIODS}
            onChange={(period) => go({ period })}
          />
          <FilterMenu
            label="Способ получения"
            icon={<Truck size={17} />}
            value={query.method}
            options={METHODS}
            onChange={(method) => go({ method })}
          />
          <Button
            variant="soft"
            className="px-3.5 text-[13.5px]"
            icon={<DownloadSimple aria-hidden="true" size={17} />}
            loading={exporting}
            onClick={() => void exportCsv()}
          >
            Excel
          </Button>
        </div>
      </div>

      {query.period === "custom" ? (
        <div className={`flex flex-wrap items-end gap-3 ${listHidden ? "max-adm-lg:hidden" : ""}`}>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold">
            С даты
            <Input
              type="date"
              value={query.from}
              onChange={(event) => go({ from: event.target.value })}
              className="w-44"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold">
            По дату
            <Input
              type="date"
              value={query.to}
              onChange={(event) => go({ to: event.target.value })}
              className="w-44"
            />
          </label>
        </div>
      ) : null}

      <nav
        aria-label="Статус заказа"
        className={`flex flex-wrap gap-2 ${listHidden ? "max-adm-lg:hidden" : ""}`}
      >
        {ORDER_TABS.map((tab) => {
          const selected = query.tab === tab.value;
          const count = data?.counts[tab.value] ?? 0;
          return (
            <Link
              key={tab.value}
              href={`${selectedId ? `/admin/orders/${selectedId}` : "/admin/orders"}${queryString({ ...query, tab: tab.value, page: 1 })}`}
              scroll={false}
              aria-current={selected ? "page" : undefined}
              className={`inline-flex h-10 items-center gap-2.5 rounded-full pr-2 pl-4 text-[13.5px] font-bold no-underline transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-side ${
                selected
                  ? "bg-admin-side text-admin-card"
                  : "bg-admin-card text-admin-ink shadow-admin-card hover:bg-admin-soft"
              }`}
            >
              {tab.label}
              <span
                className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-[7px] text-xs tabular-nums ${
                  selected
                    ? "bg-admin-card/20"
                    : tab.value === "new" && count > 0
                      ? "bg-admin-soft text-admin-side"
                      : "bg-admin-panel text-admin-muted"
                }`}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="grid grid-cols-1 items-start gap-5 adm-lg:grid-cols-[minmax(0,1fr)_400px]">
        <section
          aria-label="Список заказов"
          className={`flex flex-col gap-2.5 ${listHidden ? "max-adm-lg:hidden" : ""}`}
        >
          <div
            className={`hidden gap-3.5 px-[18px] adm-2xl:grid ${ROW_COLUMNS}`}
            aria-hidden="true"
          >
            <ColumnLabel>№</ColumnLabel>
            <ColumnLabel>Клиент</ColumnLabel>
            <ColumnLabel>Получение</ColumnLabel>
            <ColumnLabel>Состав</ColumnLabel>
            <ColumnLabel className="text-right">Сумма</ColumnLabel>
            <ColumnLabel className="text-right">Статус</ColumnLabel>
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
            [0, 1, 2, 3, 4].map((index) => (
              <Skeleton key={index} className="h-[66px] rounded-admin-card" />
            ))
          ) : data.items.length === 0 ? (
            <div className="rounded-admin-card bg-admin-card shadow-admin-card">
              <EmptyState
                compact
                title="Здесь пока пусто"
                text={typograf("Заказы с этим статусом и датой появятся автоматически")}
              />
            </div>
          ) : (
            <ul className={`flex flex-col gap-2.5 ${loading ? "opacity-60" : ""}`}>
              {data.items.map((order) => {
                const selected = order.id === selectedId;
                return (
                  <li key={order.id}>
                    <Link
                      href={`/admin/orders/${order.id}${qs}`}
                      scroll={false}
                      aria-current={selected ? "true" : undefined}
                      title={`Заказ № ${order.order_number}`}
                      className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1.5 rounded-admin-card border-[1.5px] bg-admin-card px-[18px] py-3 text-admin-ink no-underline shadow-admin-card transition-shadow duration-150 hover:shadow-admin-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-side motion-reduce:transition-none ${ROW_COLUMNS} ${
                        selected ? "border-admin-side" : "border-transparent"
                      }`}
                    >
                      <span className="text-[13.5px] font-bold text-admin-muted tabular-nums">
                        <span className="sr-only">Заказ № </span>
                        {shortNumber(order.order_number)}
                      </span>
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={order.customer_name} size="sm" className="size-8" />
                        <span className="truncate text-[14.5px] font-bold">
                          {shortName(order.customer_name)}
                        </span>
                      </span>
                      <span className="justify-self-end adm-2xl:hidden">
                        <StatusBadge kind="order" status={order.status} />
                      </span>
                      <span className="col-span-2 flex flex-col gap-0.5 max-adm-2xl:col-span-1 max-adm-2xl:col-start-2 max-adm-2xl:row-start-2 max-adm-2xl:flex-row max-adm-2xl:items-baseline max-adm-2xl:gap-2 adm-2xl:col-span-1">
                        <span className="text-[13.5px] font-bold">
                          {order.desired_date
                            ? formatDayShort(order.desired_date)
                            : "Дата не выбрана"}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-admin-muted tabular-nums">
                          {order.delivery_interval ? intervalLabel(order.delivery_interval) : ""}
                          {order.delivery_method === "delivery" ? (
                            // Доставка — значком в строке (007a): курьеру нужен адрес из карточки
                            <span title="Доставка" className="inline-flex text-admin-side">
                              <Truck aria-hidden="true" size={14} weight="bold" />
                              <span className="sr-only">, доставка</span>
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <span className="truncate text-[13.5px] text-admin-muted max-adm-2xl:col-span-2 max-adm-2xl:col-start-2">
                        {order.items_summary}
                      </span>
                      <span className="text-right text-[14.5px] font-extrabold tabular-nums max-adm-2xl:row-start-2 max-adm-2xl:col-start-3">
                        {money(order.total_price)}
                      </span>
                      <span className="hidden justify-self-end adm-2xl:block">
                        <StatusBadge kind="order" status={order.status} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {data && data.total > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1.5 text-[13.5px] text-admin-muted">
              <span aria-live="polite">
                Показано {data.items.length} из {data.total}
              </span>
              <Pagination page={query.page} pages={pages} onChange={(page) => go({ page })} />
            </div>
          ) : null}
        </section>

        <aside
          aria-label="Карточка заказа"
          className={`overflow-hidden rounded-admin-card bg-admin-card shadow-admin-card adm-lg:sticky adm-lg:top-3 ${
            listHidden ? "" : "max-adm-lg:hidden"
          }`}
        >
          {selectedId ? (
            <>
              <Link
                href={`/admin/orders${qs}`}
                className="flex items-center gap-1.5 px-[22px] py-3 text-[13.5px] font-bold text-admin-side no-underline adm-lg:hidden"
              >
                <CaretLeft aria-hidden="true" size={16} weight="bold" />
                Назад к списку
              </Link>
              <OrderCard key={selectedId} orderId={selectedId} onStatusChange={onStatusChange} />
            </>
          ) : (
            <OrderCardEmpty />
          )}
        </aside>
      </div>
    </div>
  );
}
