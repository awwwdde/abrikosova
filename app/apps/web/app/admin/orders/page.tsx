"use client";

import { useState } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import {
  AdminPageHeader,
  Cell,
  Row,
  StateBlock,
  Table,
  useAdminData,
} from "@/components/admin/data-table";
import { Select } from "@/components/ui";
import { formatPrice, ORDER_STATUS_LABELS, type Page, type OrderAdminListItem } from "@/lib/api";

type OrderRow = OrderAdminListItem;

const STATUSES = Object.keys(ORDER_STATUS_LABELS);

export default function AdminOrdersPage() {
  const { authFetch } = useAdminAuth();
  const [filter, setFilter] = useState("");
  const query = filter ? `/admin/orders?status=${filter}` : "/admin/orders";
  const { data, loading, error, reload } = useAdminData<Page<OrderRow>>(query);
  const [busy, setBusy] = useState<number | null>(null);

  async function changeStatus(id: number, status: string) {
    setBusy(id);
    try {
      await authFetch(`/admin/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Заказы"
        action={
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Фильтр по статусу"
          >
            <option value="">Все статусы</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {ORDER_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        }
      />
      <StateBlock loading={loading} error={error} />

      {data && data.items.length === 0 ? (
        <p className="text-sm text-ink-subtle">Заказов нет</p>
      ) : null}

      {data && data.items.length > 0 ? (
        <>
          <Table headers={["Номер", "Клиент", "Получение", "Сумма", "Статус", "Создан"]}>
            {data.items.map((order) => (
              <Row key={order.id}>
                <Cell>{order.order_number}</Cell>
                <Cell>
                  <div>{order.customer_name}</div>
                  <div className="text-xs text-ink-subtle">{order.customer_phone}</div>
                </Cell>
                <Cell>
                  {order.delivery_method === "delivery" ? "Доставка" : "Самовывоз"}
                  {order.desired_date ? (
                    <div className="text-xs text-ink-subtle">к {order.desired_date}</div>
                  ) : null}
                </Cell>
                <Cell>{formatPrice(order.total_price)}</Cell>
                <Cell>
                  <Select
                    value={order.status}
                    disabled={busy === order.id}
                    onChange={(e) => void changeStatus(order.id, e.target.value)}
                    aria-label={`Статус заказа ${order.order_number}`}
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {ORDER_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </Select>
                </Cell>
                <Cell>
                  <span className="text-xs text-ink-subtle">
                    {new Date(order.created_at).toLocaleString("ru-RU")}
                  </span>
                </Cell>
              </Row>
            ))}
          </Table>
          <p className="mt-3 text-xs text-ink-subtle">Всего заказов: {data.total}</p>
        </>
      ) : null}
    </div>
  );
}
