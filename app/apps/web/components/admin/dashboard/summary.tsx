"use client";

/**
 * Верхний ряд главной: выручка, заказы по дням, «Что заказывают».
 * Графики без библиотек: столбики — CSS, донат — SVG `stroke-dasharray`.
 * У обоих текстовая альтернатива: `role="img"` и цифры в `aria-label`.
 */

import { DownloadSimple, ShoppingBag } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import {
  Card,
  CardHeader,
  ColumnLabel,
  Delta,
  SegmentedTabs,
  useToast,
} from "@/components/admin/ui";
import {
  ordersCount,
  percentChange,
  periodLabel,
  topShares,
  weekdayDayMonth,
} from "@/lib/admin-dashboard";
import { formatPrice, type Dashboard } from "@/lib/api";
import { typograf } from "@/lib/format";

const money = (value: string | number) => formatPrice(value).replace(" ₽", " ₽");

export function RevenueCard({ revenue }: { revenue: Dashboard["revenue"] }) {
  const { download } = useAdminAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const total = Number(revenue.total);
  const change = percentChange(total, Number(revenue.previous_total));
  const averageChange = percentChange(Number(revenue.average), Number(revenue.previous_average));

  async function downloadReport() {
    setBusy(true);
    try {
      await download("/admin/dashboard/report.csv", "zakazy.csv");
    } catch {
      toast.error("Не удалось скачать отчёт. Попробуйте ещё раз");
    } finally {
      setBusy(false);
    }
  }

  const metrics = [
    {
      label: "Заказов",
      value: String(revenue.orders),
      delta: revenue.orders - revenue.previous_orders,
      suffix: "",
      positive: "up" as const,
    },
    {
      label: "Средний чек",
      value: money(revenue.average),
      delta: averageChange,
      suffix: "%",
      positive: "up" as const,
    },
    {
      label: "Отменено",
      value: String(revenue.cancelled),
      delta: revenue.cancelled - revenue.previous_cancelled,
      suffix: "",
      positive: "down" as const,
    },
    {
      label: "Новых клиентов",
      value: String(revenue.new_customers),
      delta: revenue.new_customers - revenue.previous_new_customers,
      suffix: "",
      positive: "up" as const,
    },
  ];

  return (
    <Card
      aria-labelledby="revenue-title"
      className="grid gap-7 adm-sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]"
    >
      <div className="flex flex-col gap-3.5">
        <span
          aria-hidden="true"
          className="flex size-[46px] items-center justify-center rounded-admin-control bg-admin-soft text-admin-side"
        >
          <ShoppingBag size={24} />
        </span>
        <h2
          id="revenue-title"
          className="mt-2.5 font-sans text-[13px] font-semibold text-admin-muted"
        >
          Выручка за неделю
        </h2>
        <p className="text-[40px] leading-none font-extrabold tracking-[-0.02em] tabular-nums">
          {money(total)}
        </p>
        {change !== null ? (
          <span>
            <Delta
              value={change}
              suffix={`% к прошлой неделе`}
              label={`На ${Math.abs(change)}% ${change >= 0 ? "больше" : "меньше"}, чем на прошлой неделе`}
            />
          </span>
        ) : null}
        <p className="text-[13.5px] leading-normal text-admin-muted">
          {typograf(
            `${periodLabel(revenue.period_start, revenue.period_end)}, без отменённых заказов`,
          )}
        </p>
        <button
          type="button"
          onClick={() => void downloadReport()}
          disabled={busy}
          aria-busy={busy || undefined}
          className="mt-auto inline-flex h-11 items-center gap-3 self-start rounded-full border border-admin-disabled bg-admin-card py-0 pr-1.5 pl-[18px] text-[13.5px] font-bold text-admin-ink transition-[background-color,transform] duration-150 hover:bg-admin-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-side active:translate-y-px disabled:opacity-60"
        >
          Скачать отчёт
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-full bg-admin-side text-admin-card"
          >
            <DownloadSimple size={17} weight="bold" />
          </span>
        </button>
      </div>
      <dl className="border-admin-line adm-sm:border-l adm-sm:pl-6">
        {metrics.map((metric, index) => (
          <div
            key={metric.label}
            className={`flex flex-col gap-1.5 py-3.5 ${index > 0 ? "border-t border-admin-line" : ""}`}
          >
            <dt>
              <ColumnLabel>{metric.label}</ColumnLabel>
            </dt>
            <dd className="flex items-center gap-2 text-lg font-bold tabular-nums">
              {metric.value}
              {metric.delta !== null && metric.delta !== 0 ? (
                <Delta
                  value={metric.delta}
                  suffix={metric.suffix}
                  positive={metric.positive}
                  label={`${metric.delta > 0 ? "больше" : "меньше"} на ${Math.abs(metric.delta)}${metric.suffix}, чем на прошлой неделе`}
                />
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export function OrdersByDayCard({ data }: { data: Dashboard["orders_by_day"] }) {
  const max = Math.max(1, ...data.days.map((day) => day.count));
  const counts = data.days.map((day) => day.count);
  const delta = data.today - data.yesterday;
  return (
    <Card aria-labelledby="by-day-title" className="flex flex-col gap-3.5">
      <CardHeader
        id="by-day-title"
        title="Заказы по дням"
        action={
          <Link href="/admin/orders" className="text-[13px] font-bold text-admin-side no-underline">
            Все заказы
          </Link>
        }
      />
      <p className="flex items-baseline gap-2.5">
        <span className="text-[34px] leading-none font-extrabold tabular-nums">{data.today}</span>
        <span className="text-[13.5px] text-admin-muted">к выдаче сегодня</span>
        {delta !== 0 ? (
          <Delta
            value={delta}
            label={`${delta > 0 ? "больше" : "меньше"} на ${Math.abs(delta)}, чем вчера`}
          />
        ) : null}
      </p>
      <div
        role="img"
        aria-label={`Заказы к выдаче за 14 дней: от ${Math.min(...counts)} до ${Math.max(...counts)} в день, сегодня ${data.today}`}
        className="flex h-24 items-end gap-[5px] border-b border-admin-line pb-1.5"
      >
        {data.days.map((day, index) => (
          <span
            key={day.day}
            title={`${weekdayDayMonth(day.day)}: ${ordersCount(day.count)}`}
            className={`min-h-[3px] flex-1 rounded-t-[4px] ${
              index === data.days.length - 1 ? "bg-admin-side" : "bg-admin-rose"
            }`}
            style={{ height: `${(day.count / max) * 100}%` }}
          />
        ))}
      </div>
      <ul>
        {data.upcoming.map((day) => {
          const marks = [day.has_wedding ? "свадьба" : null, day.has_large ? "крупный" : null]
            .filter(Boolean)
            .join(", ");
          return (
            <li
              key={day.day}
              className="flex justify-between gap-2 border-t border-admin-line py-[9px] text-[13.5px]"
            >
              <span className="text-admin-muted">{weekdayDayMonth(day.day)}</span>
              <span className="font-bold tabular-nums">
                {day.count === 0 ? "нет заказов" : ordersCount(day.count)}
                {marks ? `, ${marks}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

const SHARE_COLORS = [
  "var(--color-admin-side)",
  "var(--color-admin-gold)",
  "var(--color-admin-rose)",
  "var(--color-admin-faint)",
];

export function CategoriesCard({ data }: { data: Dashboard["categories"] }) {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const items = data[period];
  const shares = topShares(items);
  const total = items.reduce((sum, item) => sum + item.items, 0);
  let offset = 0;
  const description = shares.length
    ? `${period === "week" ? "За неделю" : "За месяц"}: ${shares
        .map((share) => `${share.name} ${share.percent}%`)
        .join(", ")}`
    : "Заказов за период нет";

  return (
    <Card aria-labelledby="categories-title" className="flex flex-col gap-4">
      <CardHeader
        id="categories-title"
        title="Что заказывают"
        action={
          <SegmentedTabs
            label="Период"
            value={period}
            onChange={setPeriod}
            controls="categories-panel"
            options={[
              { value: "week", label: "Неделя" },
              { value: "month", label: "Месяц" },
            ]}
          />
        }
      />
      <div id="categories-panel" role="tabpanel" className="flex flex-col gap-4">
        <div role="img" aria-label={description} className="relative size-[170px] self-center">
          <svg
            width="170"
            height="170"
            viewBox="0 0 42 42"
            aria-hidden="true"
            className="-rotate-90"
          >
            <circle
              cx="21"
              cy="21"
              r="15.9"
              fill="none"
              stroke="var(--color-admin-photo)"
              strokeWidth="5"
            />
            {shares.map((share, index) => {
              const dash = `${share.percent} ${100 - share.percent}`;
              const circle = (
                <circle
                  key={share.name}
                  cx="21"
                  cy="21"
                  r="15.9"
                  fill="none"
                  stroke={SHARE_COLORS[index]}
                  strokeWidth="5"
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                />
              );
              offset += share.percent;
              return circle;
            })}
          </svg>
          <span
            aria-hidden="true"
            className="absolute inset-0 flex flex-col items-center justify-center"
          >
            <span className="text-[28px] leading-none font-extrabold tabular-nums">{total}</span>
            <span className="text-[12.5px] text-admin-muted">позиций</span>
          </span>
        </div>
        {shares.length ? (
          <ul aria-hidden="true" className="flex flex-col gap-[9px]">
            {shares.map((share, index) => (
              <li key={share.name} className="flex items-center gap-2.5 text-[13.5px]">
                <span
                  className="size-3 rounded-[4px]"
                  style={{ background: SHARE_COLORS[index] }}
                />
                <span className="grow">{share.name}</span>
                <span className="font-bold tabular-nums">{share.percent}%</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-center text-[13.5px] text-admin-muted">
            {typograf(period === "week" ? "За неделю заказов не было" : "За месяц заказов не было")}
          </p>
        )}
      </div>
    </Card>
  );
}
