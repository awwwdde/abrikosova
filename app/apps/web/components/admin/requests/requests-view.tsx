"use client";

/**
 * «Заявки на торты» (011e) — по образцу заказов: фильтры в адресе, вкладки со
 * счётчиками, строки-карточки, липкая карточка справа, `/admin/consultations/[id]`.
 */

import { CalendarBlank, CaretLeft, Cake, Funnel } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import { useCounters } from "@/components/admin/counters";
import { RequestCard, RequestCardEmpty } from "@/components/admin/requests/request-card";
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
} from "@/components/admin/ui";
import { dayMonth, shortName, whenLabel } from "@/lib/admin-dashboard";
import {
  EVENT_PERIODS,
  REQUEST_TABS,
  SOURCES,
  parseRequests,
  requestsApiParams,
  requestsQueryString,
  tabOfRequest,
  type RequestQuery,
} from "@/lib/admin-requests";
import {
  ApiError,
  REQUEST_OCCASION_LABELS,
  type ConsultationListPage,
  type ConsultationStatus,
} from "@/lib/api";
import { pluralRu } from "@/lib/format";

const PAGE_SIZE = 20;
// Таблица — от 1536px, уже — двухэтажная строка: рядом с карточкой заявки (400px)
// имя клиента сжималось до «Анас…» (011g, как в заказах)
const COLUMNS = "adm-2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_130px_110px_120px]";

const OCCASIONS = [
  { value: "", label: "Любой повод" },
  ...Object.entries(REQUEST_OCCASION_LABELS).map(([value, label]) => ({ value, label })),
];

export function RequestsView({ selectedId }: { selectedId: number | null }) {
  const { authFetch } = useAdminAuth();
  const { refresh: refreshCounters } = useCounters();
  const router = useRouter();
  const params = useSearchParams();
  const query = useMemo(() => parseRequests(new URLSearchParams(params.toString())), [params]);
  const [data, setData] = useState<ConsultationListPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(
        await authFetch<ConsultationListPage>(
          `/admin/consultations?${requestsApiParams(query, PAGE_SIZE)}`,
        ),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось загрузить заявки");
    } finally {
      setLoading(false);
    }
  }, [authFetch, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const base = selectedId ? `/admin/consultations/${selectedId}` : "/admin/consultations";
  const qs = requestsQueryString(query);
  const go = (next: Partial<RequestQuery>) =>
    router.push(`${base}${requestsQueryString({ ...query, page: 1, ...next })}`, { scroll: false });

  const onStatusChange = useCallback(
    (id: number, status: ConsultationStatus) => {
      setData((current) => {
        if (!current) return current;
        const before = current.items.find((item) => item.id === id);
        if (!before || before.status === status) return current;
        const counts = { ...current.counts };
        const from = tabOfRequest(before.status);
        const to = tabOfRequest(status);
        counts[from] = Math.max(0, (counts[from] ?? 0) - 1);
        counts[to] = (counts[to] ?? 0) + 1;
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

  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const listHidden = selectedId !== null;
  const now = new Date().toISOString();

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className={`flex flex-col gap-1.5 ${listHidden ? "max-adm-lg:sr-only" : ""}`}>
          <h1 className="font-display text-[34px] leading-[1.05] font-normal adm-sm:text-[42px]">
            Заявки на торты
          </h1>
          <p className="text-[15px] text-admin-muted">Нажмите на заявку, чтобы открыть её справа</p>
        </div>
        <div
          className={`flex flex-wrap items-center gap-2.5 ${listHidden ? "max-adm-lg:hidden" : ""}`}
        >
          <FilterMenu
            label="Повод"
            icon={<Cake size={17} />}
            value={query.occasion}
            options={OCCASIONS}
            onChange={(occasion) => go({ occasion })}
          />
          <FilterMenu
            label="Дата события"
            icon={<CalendarBlank size={17} />}
            value={query.period}
            options={EVENT_PERIODS}
            onChange={(period) => go({ period })}
          />
          <FilterMenu
            label="Источник"
            icon={<Funnel size={17} />}
            value={query.source}
            options={SOURCES}
            onChange={(source) => go({ source })}
          />
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
        aria-label="Статус заявки"
        className={`flex flex-wrap gap-2 ${listHidden ? "max-adm-lg:hidden" : ""}`}
      >
        {REQUEST_TABS.map((tab) => {
          const selected = query.tab === tab.value;
          const count = data?.counts[tab.value] ?? 0;
          return (
            <Link
              key={tab.value}
              href={`${base}${requestsQueryString({ ...query, tab: tab.value, page: 1 })}`}
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
          aria-label="Список заявок"
          className={`flex flex-col gap-2.5 ${listHidden ? "max-adm-lg:hidden" : ""}`}
        >
          <div className={`hidden gap-3.5 px-[18px] adm-2xl:grid ${COLUMNS}`} aria-hidden="true">
            <ColumnLabel>Клиент</ColumnLabel>
            <ColumnLabel>Повод</ColumnLabel>
            <ColumnLabel>Событие</ColumnLabel>
            <ColumnLabel>Заявка</ColumnLabel>
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
            [0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-[66px] rounded-admin-card" />
            ))
          ) : data.items.length === 0 ? (
            <div className="rounded-admin-card bg-admin-card shadow-admin-card">
              <EmptyState
                compact
                title="Здесь пока пусто"
                text="Новые заявки с сайта появятся автоматически"
              />
            </div>
          ) : (
            <ul className={`flex flex-col gap-2.5 ${loading ? "opacity-60" : ""}`}>
              {data.items.map((row) => {
                const selected = row.id === selectedId;
                const occasion = row.occasion
                  ? REQUEST_OCCASION_LABELS[row.occasion]
                  : row.source === "contact_page"
                    ? "Вопрос с сайта"
                    : "Торт на заказ";
                return (
                  <li key={row.id}>
                    <Link
                      href={`/admin/consultations/${row.id}${qs}`}
                      scroll={false}
                      aria-current={selected ? "true" : undefined}
                      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1 rounded-admin-card border-[1.5px] bg-admin-card px-[18px] py-3 text-admin-ink no-underline shadow-admin-card transition-shadow duration-150 hover:shadow-admin-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-side ${COLUMNS} ${
                        selected ? "border-admin-side" : "border-transparent"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={row.name} size="sm" className="size-8" />
                        <span className="truncate text-[14.5px] font-bold">
                          {shortName(row.name)}
                        </span>
                      </span>
                      <span className="justify-self-end adm-2xl:hidden">
                        <StatusBadge kind="consultation" status={row.status} />
                      </span>
                      <span className="truncate text-[13.5px] font-semibold max-adm-2xl:col-span-2">
                        {occasion}
                        {row.design ? ` · ${row.design.title}` : ""}
                      </span>
                      <span className="flex flex-col gap-0.5 text-[13px] max-adm-2xl:col-span-2 max-adm-2xl:flex-row max-adm-2xl:gap-2">
                        <span className="font-bold">
                          {row.event_date ? dayMonth(row.event_date) : "Дата не указана"}
                        </span>
                        {row.guests_count ? (
                          <span className="text-admin-muted">
                            {row.guests_count}{" "}
                            {pluralRu(row.guests_count, ["гость", "гостя", "гостей"])}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-[12.5px] text-admin-muted max-adm-2xl:col-span-2">
                        {whenLabel(row.created_at, now, "ago")}
                      </span>
                      <span className="hidden justify-self-end adm-2xl:block">
                        <StatusBadge kind="consultation" status={row.status} />
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
          aria-label="Карточка заявки"
          className={`overflow-hidden rounded-admin-card bg-admin-card shadow-admin-card adm-lg:sticky adm-lg:top-3 ${listHidden ? "" : "max-adm-lg:hidden"}`}
        >
          {selectedId ? (
            <>
              <Link
                href={`/admin/consultations${qs}`}
                className="flex items-center gap-1.5 px-[22px] py-3 text-[13.5px] font-bold text-admin-side no-underline adm-lg:hidden"
              >
                <CaretLeft aria-hidden="true" size={16} weight="bold" />
                Назад к списку
              </Link>
              <RequestCard
                key={selectedId}
                requestId={selectedId}
                onStatusChange={onStatusChange}
              />
            </>
          ) : (
            <RequestCardEmpty />
          )}
        </aside>
      </div>
    </div>
  );
}
