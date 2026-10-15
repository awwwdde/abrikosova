"use client";

/**
 * Главная админки по концепту new/design/admin/Dashboard.dc.html (задание 011b).
 * Все данные — одним запросом `GET /admin/dashboard`; «сегодня» и «неделя»
 * посчитаны бэкендом по времени кондитерской.
 */

import { ArrowClockwise, Plus } from "@phosphor-icons/react";
import { useAdminAuth } from "@/components/admin/auth-context";
import { useAdminData } from "@/components/admin/use-admin-data";
import {
  ActivitySection,
  CalendarSection,
  DashboardSkeleton,
  ReviewsSection,
} from "@/components/admin/dashboard/bottom";
import {
  ConsultationsSection,
  PlanSection,
  PopularSection,
} from "@/components/admin/dashboard/lists";
import { CategoriesCard, OrdersByDayCard, RevenueCard } from "@/components/admin/dashboard/summary";
import { Button, ButtonLink, Notice } from "@/components/admin/ui";
import { greeting, longDate } from "@/lib/admin-dashboard";
import type { Dashboard } from "@/lib/api";
import { pluralRu, typograf } from "@/lib/format";

function subtitle(data: Dashboard): string {
  const waiting = data.counters.orders_new;
  const orders =
    waiting === 0
      ? "Новых заказов нет."
      : `${waiting} ${pluralRu(waiting, ["новый заказ ждёт", "новых заказа ждут", "новых заказов ждут"])} подтверждения.`;
  return typograf(`${longDate(data.today)}. ${orders}`);
}

export default function AdminDashboardPage() {
  const { user } = useAdminAuth();
  const { data, loading, error, reload } = useAdminData<Dashboard>("/admin/dashboard");
  // «Добрый день, Елена» — первое слово имени (011c)
  const firstName = user?.name.trim().split(/\s+/)[0];

  if (!data) {
    if (error && !loading) {
      return (
        <Notice
          role="alert"
          action={
            <Button
              variant="outline"
              size="sm"
              icon={<ArrowClockwise aria-hidden="true" size={16} />}
              onClick={() => void reload()}
            >
              Повторить
            </Button>
          }
        >
          Не удалось загрузить сводку: {error}
        </Notice>
      );
    }
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[34px] leading-[1.05] font-normal adm-sm:text-[42px]">
            {greeting(data.now)}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-[15px] text-admin-muted">{subtitle(data)}</p>
        </div>
        <ButtonLink
          href="/admin/catalog"
          icon={<Plus aria-hidden="true" size={18} weight="bold" />}
          className="pr-5 pl-4"
        >
          Новый товар
        </ButtonLink>
      </div>

      {error ? (
        <Notice
          role="alert"
          action={
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              Повторить
            </Button>
          }
        >
          Не удалось обновить сводку, показаны прежние данные
        </Notice>
      ) : null}

      <div className="grid grid-cols-1 items-stretch gap-5 adm-lg:grid-cols-2 adm-xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
        <div className="adm-lg:col-span-2 adm-xl:col-span-1">
          <RevenueCard revenue={data.revenue} />
        </div>
        <OrdersByDayCard data={data.orders_by_day} />
        <CategoriesCard data={data.categories} />
      </div>

      <div className="grid grid-cols-1 items-start gap-5 adm-xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        <PlanSection plan={data.plan} />
        <ConsultationsSection data={data.consultations} now={data.now} />
      </div>

      <PopularSection products={data.popular} />

      <div className="grid grid-cols-1 items-start gap-5 adm-md:grid-cols-2 adm-xl:grid-cols-3">
        <CalendarSection initial={data.calendar} today={data.today} />
        <ActivitySection
          items={data.activity}
          now={data.now}
          journalHref={user?.role === "owner" ? "/admin/journal" : undefined}
        />
        <ReviewsSection initial={data.reviews} />
      </div>
    </div>
  );
}
