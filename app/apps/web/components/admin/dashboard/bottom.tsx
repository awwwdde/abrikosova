"use client";

/**
 * Нижний ряд главной: календарь заказов, последние действия, новые отзывы.
 */

import { CaretLeft, CaretRight, Storefront } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import { useCounters } from "@/components/admin/counters";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  IconButton,
  Skeleton,
  useToast,
} from "@/components/admin/ui";
import {
  dayMonth,
  monthGrid,
  monthTitle,
  ordersCount,
  shiftMonth,
  shortName,
  whenLabel,
} from "@/lib/admin-dashboard";
import type { Dashboard, DashboardCalendar } from "@/lib/api";
import { typograf } from "@/lib/format";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const WEEKDAYS_FULL = [
  "понедельник",
  "вторник",
  "среда",
  "четверг",
  "пятница",
  "суббота",
  "воскресенье",
];

export function CalendarSection({ initial, today }: { initial: DashboardCalendar; today: string }) {
  const { authFetch } = useAdminAuth();
  const [calendar, setCalendar] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const counts = new Map(calendar.days.map((day) => [day.day, day.count]));

  async function go(delta: number) {
    const month = shiftMonth(calendar.month, delta);
    setLoading(true);
    setFailed(false);
    try {
      setCalendar(await authFetch<DashboardCalendar>(`/admin/dashboard/calendar?month=${month}`));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-labelledby="calendar-title" className="flex flex-col gap-3">
      <CardHeader id="calendar-title" title="Календарь заказов" />
      <Card padding="none" className="flex flex-col gap-3 px-[18px] pt-[18px] pb-4">
        <div className="flex items-center justify-between">
          <IconButton label="Предыдущий месяц" size="sm" onClick={() => void go(-1)}>
            <CaretLeft size={18} />
          </IconButton>
          <span aria-live="polite" className="text-[15px] font-bold">
            {monthTitle(calendar.month)}
          </span>
          <IconButton label="Следующий месяц" size="sm" onClick={() => void go(1)}>
            <CaretRight size={18} />
          </IconButton>
        </div>
        {failed ? (
          <p role="alert" className="text-center text-[13px] text-admin-side">
            Не удалось загрузить месяц
          </p>
        ) : null}
        <table
          className={`w-full table-fixed border-separate border-spacing-[3px] ${loading ? "opacity-50" : ""}`}
        >
          <caption className="sr-only">
            Заказы к выдаче по дням, {monthTitle(calendar.month).toLowerCase()}
          </caption>
          <thead>
            <tr>
              {WEEKDAYS.map((day, index) => (
                <th
                  key={day}
                  scope="col"
                  abbr={WEEKDAYS_FULL[index]}
                  className="pb-1.5 text-center text-xs font-bold text-admin-muted"
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthGrid(calendar.month).map((week, index) => (
              <tr key={index}>
                {week.map((day, dayIndex) => {
                  if (!day) return <td key={`empty-${dayIndex}`} />;
                  const count = counts.get(day) ?? 0;
                  const isToday = day === today;
                  const tone = isToday
                    ? "bg-admin-side font-extrabold text-admin-card"
                    : count > 0
                      ? "bg-admin-soft font-bold text-admin-side"
                      : "text-admin-ink";
                  return (
                    <td key={day} className="p-0">
                      <span
                        className={`relative flex h-9 items-center justify-center rounded-admin-small text-[13px] tabular-nums ${tone}`}
                      >
                        <span aria-hidden="true">{Number(day.slice(8))}</span>
                        {count > 0 ? (
                          <span
                            aria-hidden="true"
                            className={`absolute bottom-[3px] text-[9px] leading-none font-bold ${
                              isToday ? "text-admin-cream" : "text-admin-side"
                            }`}
                          >
                            {count}
                          </span>
                        ) : null}
                        <span className="sr-only">
                          {dayMonth(day)}
                          {isToday ? ", сегодня" : ""}:{" "}
                          {count > 0 ? ordersCount(count) : "заказов нет"}
                        </span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-admin-line pt-3">
          {calendar.large.length === 0 ? (
            <p className="text-[13.5px] text-admin-muted">Крупных заказов впереди нет</p>
          ) : (
            <ul
              aria-label="Ближайшие крупные заказы"
              className="flex flex-col gap-[9px] text-[13.5px]"
            >
              {calendar.large.map((event) => (
                <li key={`${event.day}-${event.label}`}>
                  <Link
                    href={event.href}
                    className="flex justify-between gap-3 text-admin-ink no-underline hover:text-admin-side"
                  >
                    <span>{event.label}</span>
                    <span className="shrink-0 font-bold">{dayMonth(event.day)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </section>
  );
}

/** Подпись времени события: на главной — «10:42»/«вчера», в журнале — с датой. */
export type WhenStyle = "clock" | "full";

/**
 * Лента действий: аватар, автор, время, текст. Общая для главной и «Журнала» (011c).
 * Событие сайта — значок витрины вместо инициалов; свои действия — «Вы».
 */
export function ActivityTimeline({
  items,
  now,
  when = "clock",
}: {
  items: Dashboard["activity"];
  now: string;
  when?: WhenStyle;
}) {
  // `at` приходит уже по часам кондитерской («…T17:53:00+03:00», 011d): дату и время
  // берём из строки, а не из пояса браузера — иначе журнал из другого города врал бы
  const full = (at: string) => `${dayMonth(at.slice(0, 10))} в ${at.slice(11, 16)}`;
  return (
    <ol className="relative">
      <span
        aria-hidden="true"
        className="absolute top-2 bottom-[22px] left-[18px] w-px bg-admin-field"
      />
      {items.map((item) => (
        <li key={item.id} className="relative grid grid-cols-[38px_minmax(0,1fr)] gap-3 pb-3.5">
          {item.is_site ? (
            <span
              aria-hidden="true"
              className="flex size-[38px] items-center justify-center rounded-full bg-admin-green-soft text-admin-green"
            >
              <Storefront size={18} />
            </span>
          ) : (
            <Avatar name={item.actor} tone={item.is_you ? "side" : "cream"} />
          )}
          <Card padding="none" as="div" className="flex flex-col gap-[3px] px-3.5 py-3">
            <span className="flex justify-between gap-2">
              <span className="truncate text-[13.5px] font-bold">
                {item.is_you ? "Вы" : item.actor}
                {!item.is_you && item.actor_role ? (
                  <span className="font-medium text-admin-muted"> ({item.actor_role})</span>
                ) : null}
              </span>
              <time dateTime={item.at} className="shrink-0 text-xs text-admin-muted">
                {when === "full" ? full(item.at) : whenLabel(item.at, now)}
              </time>
            </span>
            <span className="text-[13px] leading-[1.45] text-admin-muted">
              {typograf(item.text)}
            </span>
            {item.meta ? <span className="text-xs text-admin-muted">{item.meta}</span> : null}
          </Card>
        </li>
      ))}
    </ol>
  );
}

export function ActivitySection({
  items,
  now,
  journalHref,
}: {
  items: Dashboard["activity"];
  now: string;
  /** Ссылка «Журнал» — только владельцу: раздел журнала ему одному и доступен */
  journalHref?: string;
}) {
  return (
    <section aria-labelledby="activity-title" className="flex flex-col gap-3">
      <CardHeader
        id="activity-title"
        title="Последние действия"
        action={
          journalHref ? (
            <Link href={journalHref} className="text-[13px] font-bold text-admin-side no-underline">
              Журнал
            </Link>
          ) : null
        }
      />
      {items.length === 0 ? (
        <Card padding="sm">
          <EmptyState
            compact
            title="Пока тихо"
            text={typograf("Здесь появятся правки каталога, статусы заказов и публикации")}
          />
        </Card>
      ) : (
        <ActivityTimeline items={items} now={now} />
      )}
    </section>
  );
}

function Stars({ rating }: { rating: number | null }) {
  if (!rating) return null;
  return (
    <span
      aria-label={`Оценка ${rating} из 5`}
      role="img"
      className="text-[13px] tracking-[1px] text-admin-gold"
    >
      {"★".repeat(rating)}
      <span className="text-admin-field">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export function ReviewsSection({ initial }: { initial: Dashboard["reviews"] }) {
  const { authFetch } = useAdminAuth();
  const { refresh } = useCounters();
  const toast = useToast();
  const [published, setPublished] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<number | null>(null);

  async function publish(id: number) {
    setBusy(id);
    try {
      await authFetch(`/admin/reviews/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_published: true }),
      });
      setPublished((current) => new Set(current).add(id));
      toast.success("Отзыв опубликован на сайте");
      void refresh();
    } catch {
      toast.error("Не удалось опубликовать отзыв. Попробуйте ещё раз");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="reviews-title" className="flex flex-col gap-3">
      <CardHeader
        id="reviews-title"
        title="Новые отзывы"
        action={
          <Link
            href="/admin/reviews"
            className="text-[13px] font-bold text-admin-side no-underline"
          >
            Все отзывы
          </Link>
        }
      />
      {initial.length === 0 ? (
        <Card padding="sm">
          <EmptyState
            compact
            title="Новых отзывов нет"
            text={typograf("Отзывы с сайта ждут публикации здесь")}
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {initial.map((review) => (
            <Card as="li" key={review.id} padding="sm" className="flex flex-col gap-2">
              <span className="flex items-center gap-2.5">
                <Avatar name={review.author_name} size="sm" />
                <span className="flex min-w-0 grow flex-col">
                  <span className="truncate text-[13.5px] font-bold">
                    {shortName(review.author_name)}
                  </span>
                  <Stars rating={review.rating ?? null} />
                </span>
                {published.has(review.id) ? (
                  <Badge tone="grey">Опубликован</Badge>
                ) : (
                  <Button
                    size="sm"
                    className="h-[30px] rounded-full"
                    loading={busy === review.id}
                    onClick={() => void publish(review.id)}
                  >
                    Опубликовать
                    <span className="sr-only"> отзыв {shortName(review.author_name)}</span>
                  </Button>
                )}
              </span>
              <p className="line-clamp-3 text-[13px] leading-normal text-admin-ink-soft">
                {typograf(review.text)}
              </p>
            </Card>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Скелет главной той же формы, что и содержимое: страница не прыгает после загрузки. */
export function DashboardSkeleton() {
  const block = (className: string) => <Skeleton className={className} />;
  return (
    <div aria-busy="true" aria-label="Загружаем сводку" className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        {block("h-10 w-80 max-w-full")}
        {block("h-4 w-96 max-w-full")}
      </div>
      <div className="grid gap-5 adm-lg:grid-cols-2 adm-xl:grid-cols-[1.45fr_1fr_0.9fr]">
        {[0, 1, 2].map((index) => (
          <Card key={index} className="flex flex-col gap-4">
            {block("h-11 w-11")}
            {block("h-4 w-32")}
            {block("h-10 w-44")}
            {block("h-24 w-full")}
            {block("h-4 w-2/3")}
          </Card>
        ))}
      </div>
      <div className="grid gap-5 adm-xl:grid-cols-[1.75fr_1fr]">
        <div className="flex flex-col gap-3">
          {block("h-6 w-40")}
          {[0, 1, 2, 3].map((index) => (
            <Card key={index} padding="sm">
              {block("h-8 w-full")}
            </Card>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {block("h-6 w-40")}
          {[0, 1, 2].map((index) => (
            <Card key={index} padding="sm">
              {block("h-9 w-full")}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
