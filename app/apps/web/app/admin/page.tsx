"use client";

import Link from "next/link";
import { AdminPageHeader, StateBlock, useAdminData } from "@/components/admin/data-table";

type Stats = {
  orders_new: number;
  orders_today: number;
  orders_week: number;
  consultations_new: number;
  consultations_week: number;
  products_total: number;
  reviews_unpublished: number;
};

const CARDS: { key: keyof Stats; label: string; href: string }[] = [
  { key: "orders_new", label: "Новых заказов", href: "/admin/orders" },
  { key: "orders_today", label: "Заказов сегодня", href: "/admin/orders" },
  { key: "orders_week", label: "Заказов за неделю", href: "/admin/orders" },
  { key: "consultations_new", label: "Новых заявок", href: "/admin/consultations" },
  { key: "consultations_week", label: "Заявок за неделю", href: "/admin/consultations" },
  { key: "products_total", label: "Товаров в каталоге", href: "/admin/catalog" },
  { key: "reviews_unpublished", label: "Отзывов на модерации", href: "/admin/reviews" },
];

export default function AdminDashboard() {
  const { data, loading, error } = useAdminData<Stats>("/admin");

  return (
    <div>
      <AdminPageHeader title="Дашборд" description="Сводка за сегодня и неделю" />
      <StateBlock loading={loading} error={error} />

      {data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CARDS.map((card) => (
            <Link
              key={card.key}
              href={card.href}
              className="rounded-lg bg-surface p-5 shadow-raised transition-[box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:shadow-hover"
            >
              <p className="tnum font-display text-3xl">{data[card.key]}</p>
              <p className="mt-1 text-xs text-ink-muted">{card.label}</p>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
