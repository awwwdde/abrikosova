"use client";

/**
 * Средний ряд главной: план выдачи, заявки на торты, популярное за неделю.
 * Строки — карточки по 14px со своей тенью (как `.row` в концепте); строка
 * плана и заявки — ссылка в раздел целиком.
 */

import { DownloadSimple, Eye, ImageSquare, PencilSimple } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import {
  Avatar,
  Badge,
  Button,
  CardHeader,
  ColumnLabel,
  EmptyState,
  SegmentedTabs,
  StatusBadge,
  useToast,
} from "@/components/admin/ui";
import { dayMonth, intervalLabel, shortName, whenLabel } from "@/lib/admin-dashboard";
import { imageUrl, OCCASION_LABELS, type Dashboard, type DashboardPopular } from "@/lib/api";
import { pluralRu, typograf } from "@/lib/format";

const ROW =
  "rounded-admin-card bg-admin-card text-admin-ink no-underline shadow-admin-card transition-shadow duration-150 hover:shadow-admin-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-side motion-reduce:transition-none";

const PLAN_COLUMNS = "adm-md:grid-cols-[120px_minmax(0,1fr)_104px_140px]";

export function PlanSection({ plan }: { plan: Dashboard["plan"] }) {
  const [day, setDay] = useState<"today" | "tomorrow">("today");
  const rows = plan[day];
  return (
    <section aria-labelledby="plan-title" className="flex flex-col gap-3">
      <CardHeader
        id="plan-title"
        title="План выдачи"
        action={
          <SegmentedTabs
            label="День"
            surface="card"
            value={day}
            onChange={setDay}
            controls="plan-panel"
            options={[
              { value: "today", label: `Сегодня · ${plan.today.length}` },
              { value: "tomorrow", label: `Завтра · ${plan.tomorrow.length}` },
            ]}
          />
        }
      />
      <div
        id="plan-panel"
        role="tabpanel"
        aria-labelledby="plan-title"
        className="flex flex-col gap-3"
      >
        {rows.length === 0 ? (
          <div className={`${ROW} hover:shadow-admin-card`}>
            <EmptyState
              compact
              title={day === "today" ? "Сегодня выдач нет" : "Завтра выдач пока нет"}
              text={typograf("Заказы с желаемой датой появятся здесь сами")}
            />
          </div>
        ) : (
          <>
            <div className={`hidden gap-4 px-5 adm-md:grid ${PLAN_COLUMNS}`} aria-hidden="true">
              <ColumnLabel>Время</ColumnLabel>
              <ColumnLabel>Клиент и состав</ColumnLabel>
              <ColumnLabel>Получение</ColumnLabel>
              <ColumnLabel className="text-right">Статус</ColumnLabel>
            </div>
            <ul className="flex flex-col gap-3">
              {rows.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className={`${ROW} grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 ${PLAN_COLUMNS}`}
                  >
                    <span className="col-start-1 row-start-1 text-[14.5px] font-bold tabular-nums adm-md:col-start-auto adm-md:row-start-auto">
                      {intervalLabel(order.delivery_interval)}
                    </span>
                    <span className="col-span-2 flex min-w-0 flex-col gap-0.5 adm-md:col-span-1">
                      <span className="text-[14.5px] font-bold">
                        {shortName(order.customer_name)}{" "}
                        <span className="text-[13px] font-medium text-admin-muted">
                          №&nbsp;{order.order_number}
                        </span>
                      </span>
                      <span className="truncate text-[13px] text-admin-muted">{order.items}</span>
                    </span>
                    <span className="text-[13.5px] text-admin-muted">
                      {order.delivery_method === "delivery" ? "Доставка" : "Самовывоз"}
                    </span>
                    <span className="col-start-2 row-start-1 justify-self-end adm-md:col-start-auto adm-md:row-start-auto">
                      <StatusBadge kind="order" status={order.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

export function ConsultationsSection({
  data,
  now,
}: {
  data: Dashboard["consultations"];
  now: string;
}) {
  return (
    <section aria-labelledby="requests-title" className="flex flex-col gap-3">
      <CardHeader
        id="requests-title"
        title="Заявки на торты"
        action={
          <Link
            href="/admin/consultations"
            className="text-[13px] font-bold text-admin-side no-underline"
          >
            Все заявки
          </Link>
        }
      />
      {data.items.length === 0 ? (
        <div className={`${ROW} hover:shadow-admin-card`}>
          <EmptyState compact title="Новых заявок нет" text={typograf("Все заявки разобраны")} />
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.items.map((request) => {
            const meta = [
              request.occasion ? OCCASION_LABELS[request.occasion] : "Вопрос с сайта",
              request.event_date ? dayMonth(request.event_date) : null,
              request.guests_count
                ? `${request.guests_count} ${pluralRu(request.guests_count, ["гость", "гостя", "гостей"])}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={request.id}>
                <Link
                  href={`/admin/consultations/${request.id}`}
                  className={`${ROW} flex items-center gap-3 px-4 py-3.5`}
                >
                  <Avatar name={request.name} />
                  <span className="flex min-w-0 grow flex-col gap-0.5">
                    <span className="text-[14.5px] font-bold">{shortName(request.name)}</span>
                    <span className="truncate text-[13px] text-admin-muted">{meta}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1.5">
                    <StatusBadge kind="consultation" status={request.status} />
                    <span className="text-xs text-admin-muted">
                      {whenLabel(request.created_at, now, "ago")}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {data.more > 0 ? (
        <Link
          href="/admin/consultations"
          className="flex h-11 items-center justify-center rounded-admin-card border border-dashed border-admin-dash text-[13.5px] font-bold text-admin-muted no-underline transition-colors duration-150 hover:bg-admin-soft hover:text-admin-side focus-visible:outline-2 focus-visible:outline-admin-side"
        >
          Показать ещё {data.more}
        </Link>
      ) : null}
    </section>
  );
}

function availability(product: DashboardPopular) {
  if (!product.is_active || !product.is_available)
    return <Badge tone="accent">Нет в наличии</Badge>;
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

/** «Торты · Классика», но «Бенто», а не «Бенто · Бенто» (011c). */
export function sectionLabel(category: string, subcategory: string): string {
  return category.trim().toLowerCase() === subcategory.trim().toLowerCase()
    ? category
    : `${category} · ${subcategory}`;
}

// Таблица — с 1280 (009): на 1024 рядом меню 256px, и фиксированные колонки
// оставляли названию 54px («Мед…»); ниже 1280 — две строки, как на телефоне
const POPULAR_COLUMNS = "adm-xl:grid-cols-[64px_minmax(0,1fr)_110px_170px_190px]";

export function PopularSection({ products }: { products: DashboardPopular[] }) {
  const { download } = useAdminAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function exportCsv() {
    setBusy(true);
    try {
      await download("/admin/dashboard/popular.csv", "populyarnoe.csv");
    } catch {
      toast.error("Не удалось выгрузить файл. Попробуйте ещё раз");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="popular-title" className="flex flex-col gap-3">
      <CardHeader
        id="popular-title"
        title="Популярное за неделю"
        action={
          <Button
            variant="soft"
            size="sm"
            className="h-[38px] px-3.5 text-[13px]"
            icon={<DownloadSimple aria-hidden="true" size={16} />}
            loading={busy}
            onClick={() => void exportCsv()}
            disabled={products.length === 0}
          >
            Выгрузить в Excel
          </Button>
        }
      />
      {products.length === 0 ? (
        <div className={`${ROW} hover:shadow-admin-card`}>
          <EmptyState
            compact
            title="За неделю продаж не было"
            text={typograf("Как только придут заказы, здесь появятся самые частые позиции")}
          />
        </div>
      ) : (
        <>
          <div className={`hidden gap-4 px-5 adm-xl:grid ${POPULAR_COLUMNS}`} aria-hidden="true">
            <ColumnLabel>Фото</ColumnLabel>
            <ColumnLabel>Товар</ColumnLabel>
            <ColumnLabel className="text-center">Продано</ColumnLabel>
            <ColumnLabel className="text-center">Наличие</ColumnLabel>
            <ColumnLabel className="text-right">Действия</ColumnLabel>
          </div>
          <ul className="flex flex-col gap-3">
            {products.map((product) => {
              const src = imageUrl(product.image_key);
              return (
                <li
                  key={product.id}
                  className={`${ROW} grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3 ${POPULAR_COLUMNS}`}
                >
                  <span className="row-span-2 flex h-[60px] w-12 items-center justify-center overflow-hidden rounded-lg bg-admin-photo text-admin-faint adm-xl:row-span-1">
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
                      // Фото у товара нет — нейтральная заглушка, а не пустой квадрат
                      <ImageSquare aria-hidden="true" size={22} />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[14.5px] font-bold">{product.name}</span>
                    <span className="truncate text-[13px] text-admin-muted">
                      {sectionLabel(product.category, product.subcategory)}
                    </span>
                  </span>
                  <span className="text-right text-[15px] font-bold tabular-nums adm-xl:text-center">
                    {product.sold}
                    <span className="sr-only"> шт. продано</span>
                  </span>
                  <span className="adm-xl:text-center">{availability(product)}</span>
                  <span className="col-span-2 flex justify-end gap-3.5 text-[13.5px] font-bold adm-xl:col-span-1">
                    <Link
                      href="/admin/catalog"
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
        </>
      )}
    </section>
  );
}
