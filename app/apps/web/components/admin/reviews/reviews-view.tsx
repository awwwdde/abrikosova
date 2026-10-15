"use client";

/**
 * «Отзывы» (011e): вкладки «Ждут публикации / Опубликованы / Все», фильтры по
 * товару и источнику, публикация одной кнопкой (оптимистично) и правка в боковой
 * карточке. Состояние — в адресе: `?tab=all&source=yandex&edit=12`, `?edit=new`.
 */

import { Funnel, Plus, StarFour } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import { useCounters } from "@/components/admin/counters";
import { ProductCombobox } from "@/components/admin/product-combobox";
import { ReviewEditor, SOURCE_LABELS } from "@/components/admin/reviews/review-editor";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  FilterMenu,
  Notice,
  Pagination,
  Skeleton,
  useToast,
} from "@/components/admin/ui";
import { dayMonth, shortName } from "@/lib/admin-dashboard";
import { ApiError, apiFetch, type ReviewAdmin, type ReviewListPage } from "@/lib/api";
import { typograf } from "@/lib/format";

const PAGE_SIZE = 20;
type Tab = "pending" | "published" | "all";
const TABS: { value: Tab; label: string }[] = [
  { value: "pending", label: "Ждут публикации" },
  { value: "published", label: "Опубликованы" },
  { value: "all", label: "Все" },
];
const SOURCES = [
  { value: "", label: "Все источники" },
  { value: "site_form", label: "С сайта" },
  { value: "yandex", label: "Яндекс" },
  { value: "manual", label: "Вручную" },
];

type Query = { tab: Tab; product: string; source: string; page: number; edit: string };

function parse(params: URLSearchParams): Query {
  const tab = params.get("tab");
  const page = Number(params.get("page"));
  const edit = params.get("edit") ?? "";
  return {
    tab: tab === "published" || tab === "all" ? tab : "pending",
    product: /^\d+$/.test(params.get("product") ?? "") ? params.get("product")! : "",
    source: ["site_form", "yandex", "manual"].includes(params.get("source") ?? "")
      ? params.get("source")!
      : "",
    page: Number.isInteger(page) && page > 0 ? page : 1,
    edit: /^(\d+|new|yandex)$/.test(edit) ? edit : "",
  };
}

function toUrl(query: Query): string {
  const params = new URLSearchParams();
  if (query.tab !== "pending") params.set("tab", query.tab);
  if (query.product) params.set("product", query.product);
  if (query.source) params.set("source", query.source);
  if (query.page > 1) params.set("page", String(query.page));
  if (query.edit) params.set("edit", query.edit);
  const text = params.toString();
  return `/admin/reviews${text ? `?${text}` : ""}`;
}

function Stars({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-xs text-admin-muted">без оценки</span>;
  return (
    <span
      role="img"
      aria-label={`Оценка ${rating} из 5`}
      className="text-[13px] tracking-[1px] text-admin-gold"
    >
      {"★".repeat(rating)}
      <span className="text-admin-field">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export function ReviewsView() {
  const { authFetch } = useAdminAuth();
  const { refresh: refreshCounters } = useCounters();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const query = useMemo(() => parse(new URLSearchParams(params.toString())), [params]);
  const [data, setData] = useState<ReviewListPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [yandexUrl, setYandexUrl] = useState<string | null>(null);
  const [today, setToday] = useState(new Date().toISOString().slice(0, 10));
  const [publishing, setPublishing] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const api = new URLSearchParams({
      tab: query.tab,
      page: String(query.page),
      page_size: String(PAGE_SIZE),
    });
    if (query.product) api.set("product_id", query.product);
    if (query.source) api.set("source", query.source);
    try {
      setData(await authFetch<ReviewListPage>(`/admin/reviews?${api}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось загрузить отзывы");
    } finally {
      setLoading(false);
    }
  }, [authFetch, query.tab, query.page, query.product, query.source]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    authFetch<{ today: string }>("/admin/clock")
      .then((clock) => setToday(clock.today))
      .catch(() => {});
    apiFetch<{ yandex_maps_url?: string | null }>("/pages/contacts")
      .then((page) => setYandexUrl(page.yandex_maps_url ?? null))
      .catch(() => setYandexUrl(null));
  }, [authFetch]);

  const go = (next: Partial<Query>) =>
    router.push(toUrl({ ...query, page: 1, ...next }), { scroll: false });

  async function publish(review: ReviewAdmin) {
    setPublishing(review.id);
    setData(
      (current) =>
        current && {
          ...current,
          items: current.items.map((item) =>
            item.id === review.id ? { ...item, is_published: true } : item,
          ),
          counts: {
            ...current.counts,
            pending: Math.max(0, (current.counts.pending ?? 0) - 1),
            published: (current.counts.published ?? 0) + 1,
          },
        },
    );
    try {
      await authFetch(`/admin/reviews/${review.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_published: true }),
      });
      toast.success(`Отзыв ${shortName(review.author_name)} опубликован`);
      void refreshCounters();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось опубликовать");
      await load();
    } finally {
      setPublishing(null);
    }
  }

  const editing =
    query.edit && /^\d+$/.test(query.edit)
      ? (data?.items.find((item) => String(item.id) === query.edit) ?? null)
      : null;
  const creating = query.edit === "new" || query.edit === "yandex";
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[34px] leading-[1.05] font-normal adm-sm:text-[42px]">
            Отзывы
          </h1>
          <p className="text-[15px] text-admin-muted">
            {typograf("Отзывы с сайта ждут публикации, отзывы с Яндекса добавляются вручную")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <ProductCombobox
            aria-label="Товар"
            className="w-64"
            value={query.product}
            emptyLabel="Все товары"
            onChange={(product) => go({ product })}
          />
          <FilterMenu
            label="Источник"
            icon={<Funnel size={17} />}
            value={query.source}
            options={SOURCES}
            onChange={(source) => go({ source })}
          />
          <Button
            icon={<Plus aria-hidden="true" size={17} weight="bold" />}
            onClick={() => go({ edit: "yandex", page: query.page })}
          >
            Добавить отзыв с Яндекса
          </Button>
        </div>
      </div>

      <nav aria-label="Статус отзыва" className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const selected = query.tab === tab.value;
          const count = data?.counts[tab.value] ?? 0;
          return (
            <Link
              key={tab.value}
              href={toUrl({ ...query, tab: tab.value, page: 1, edit: "" })}
              scroll={false}
              aria-current={selected ? "page" : undefined}
              className={`inline-flex h-10 items-center gap-2.5 rounded-full pr-2 pl-4 text-[13.5px] font-bold no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-side ${
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
                    : tab.value === "pending" && count > 0
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
          aria-label="Список отзывов"
          className={`flex flex-col gap-2.5 ${query.edit ? "max-adm-lg:hidden" : ""}`}
        >
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
            [0, 1, 2].map((index) => <Skeleton key={index} className="h-24 rounded-admin-card" />)
          ) : data.items.length === 0 ? (
            <div className="rounded-admin-card bg-admin-card shadow-admin-card">
              <EmptyState
                icon={<StarFour size={24} />}
                title={query.tab === "pending" ? "Новых отзывов нет" : "Отзывов нет"}
                text={
                  query.tab === "pending"
                    ? "Все отзывы с сайта разобраны"
                    : "Попробуйте другой фильтр"
                }
              />
            </div>
          ) : (
            <ul className={`flex flex-col gap-2.5 ${loading ? "opacity-60" : ""}`}>
              {data.items.map((review) => {
                const selected = String(review.id) === query.edit;
                return (
                  <li
                    key={review.id}
                    className={`flex flex-col gap-2 rounded-admin-card border-[1.5px] bg-admin-card px-4 py-3.5 shadow-admin-card transition-shadow duration-150 hover:shadow-admin-hover ${
                      selected ? "border-admin-side" : "border-transparent"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <Avatar name={review.author_name} size="sm" />
                      <span className="flex min-w-0 grow flex-col">
                        <Link
                          href={toUrl({ ...query, edit: String(review.id) })}
                          scroll={false}
                          aria-current={selected ? "true" : undefined}
                          className="truncate text-[14.5px] font-bold text-admin-ink no-underline hover:text-admin-side"
                        >
                          {shortName(review.author_name)}
                          <span className="sr-only">: открыть отзыв</span>
                        </Link>
                        <Stars rating={review.rating} />
                      </span>
                      <Badge tone={review.source === "yandex" ? "amber" : "grey"}>
                        {SOURCE_LABELS[review.source]}
                      </Badge>
                      {review.is_published ? (
                        <Badge tone="green">Опубликован</Badge>
                      ) : (
                        <Button
                          size="sm"
                          className="h-[30px] rounded-full"
                          loading={publishing === review.id}
                          onClick={() => void publish(review)}
                        >
                          Опубликовать
                          <span className="sr-only"> отзыв {shortName(review.author_name)}</span>
                        </Button>
                      )}
                    </div>
                    <p className="line-clamp-2 text-[13.5px] leading-normal text-admin-ink-soft">
                      {typograf(review.text)}
                    </p>
                    <p className="flex flex-wrap gap-x-1.5 text-[12.5px] text-admin-muted">
                      <span>{dayMonth(review.created_at.slice(0, 10))}</span>
                      {review.product_name ? <span>· {review.product_name}</span> : null}
                    </p>
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
              <Pagination
                page={query.page}
                pages={pages}
                onChange={(page) => go({ page, edit: "" })}
              />
            </div>
          ) : null}
        </section>

        <aside
          aria-label="Карточка отзыва"
          className={`overflow-hidden rounded-admin-card bg-admin-card shadow-admin-card adm-lg:sticky adm-lg:top-3 ${query.edit ? "" : "max-adm-lg:hidden"}`}
        >
          {query.edit ? (
            <Link
              href={toUrl({ ...query, edit: "" })}
              scroll={false}
              className="flex items-center px-[22px] pt-3 text-[13.5px] font-bold text-admin-side no-underline adm-lg:hidden"
            >
              Назад к списку
            </Link>
          ) : null}
          {editing || creating ? (
            <ReviewEditor
              key={editing ? editing.id : query.edit}
              review={editing}
              yandexUrl={yandexUrl}
              createSource={query.edit === "yandex" ? "yandex" : "manual"}
              today={today}
              onSaved={(saved) => {
                void load();
                void refreshCounters();
                if (!editing)
                  router.replace(toUrl({ ...query, edit: String(saved.id), tab: "all" }), {
                    scroll: false,
                  });
              }}
              onDeleted={() => {
                router.replace(toUrl({ ...query, edit: "" }), { scroll: false });
                void load();
                void refreshCounters();
              }}
            />
          ) : (
            <EmptyState
              title={query.edit ? "Отзыв не на этой странице" : "Выберите отзыв"}
              text={
                query.edit
                  ? "Откройте нужную вкладку или страницу списка"
                  : "Нажмите на имя автора, чтобы поправить текст, оценку или дату"
              }
            />
          )}
        </aside>
      </div>
    </div>
  );
}
