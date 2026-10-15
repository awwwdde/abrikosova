"use client";

/** «Торты на заказ и начинки» (011f): вкладки «Начинки» и «Позиции». */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ItemsView, type Kind } from "@/components/admin/custom-cakes/items-view";

function CustomCakesView() {
  const params = useSearchParams();
  const tab: Kind = params.get("tab") === "cakes" ? "cakes" : "fillings";
  const tabs: { value: Kind; label: string }[] = [
    { value: "fillings", label: "Начинки" },
    { value: "cakes", label: "Дизайны" },
  ];
  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-[34px] leading-[1.05] font-normal adm-sm:text-[42px]">
          Торты на заказ и начинки
        </h1>
        <p className="text-[15px] text-admin-muted">
          Начинки — во «Вкусе изнутри» и на странице тортов на заказ, дизайны — в её сетке
        </p>
      </div>
      <nav aria-label="Раздел" className="flex gap-2">
        {tabs.map((item) => {
          const selected = item.value === tab;
          return (
            <Link
              key={item.value}
              href={`/admin/custom-cakes?tab=${item.value}`}
              scroll={false}
              aria-current={selected ? "page" : undefined}
              className={`inline-flex h-10 items-center rounded-full px-4 text-[13.5px] font-bold no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-side ${
                selected
                  ? "bg-admin-side text-admin-card"
                  : "bg-admin-card text-admin-ink shadow-admin-card hover:bg-admin-soft"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <ItemsView key={tab} kind={tab} />
    </div>
  );
}

export default function AdminCustomCakesPage() {
  return (
    <Suspense>
      <CustomCakesView />
    </Suspense>
  );
}
