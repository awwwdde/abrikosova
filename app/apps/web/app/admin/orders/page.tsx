"use client";

/** «Заказы» без выбранного заказа (011d). Фильтры — в параметрах адреса. */

import { Suspense } from "react";
import { OrdersView } from "@/components/admin/orders/orders-view";

export default function AdminOrdersPage() {
  // useSearchParams внутри требует границы Suspense — иначе Next откажется
  // собирать страницу статически
  return (
    <Suspense>
      <OrdersView selectedId={null} />
    </Suspense>
  );
}
