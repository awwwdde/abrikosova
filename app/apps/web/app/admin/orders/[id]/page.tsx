"use client";

/**
 * Глубокая ссылка на заказ (011d): `/admin/orders/123` — список с открытой
 * карточкой. Сюда ведут план выдачи на главной, поиск и колокольчик.
 */

import { useParams } from "next/navigation";
import { Suspense } from "react";
import { OrdersView } from "@/components/admin/orders/orders-view";

export default function AdminOrderPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  return (
    <Suspense>
      <OrdersView selectedId={Number.isInteger(id) && id > 0 ? id : null} />
    </Suspense>
  );
}
