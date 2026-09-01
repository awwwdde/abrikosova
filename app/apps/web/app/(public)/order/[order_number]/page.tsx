import { notFound } from "next/navigation";
import { Card, LinkButton, Price } from "@/components/ui";
import { apiGet, ORDER_STATUS_LABELS, type Order } from "@/lib/api";

export const metadata = { title: "Заказ оформлен" };
// Страница заказа никогда не кэшируется: статус меняется, и это персональные данные
export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ order_number: string }> }) {
  const { order_number: orderNumber } = await params;

  let order: Order;
  try {
    order = await apiGet<Order>(`/orders/${orderNumber}`, 0);
  } catch {
    notFound();
  }

  const details = [
    {
      label: "Способ получения",
      value: order.delivery_method === "delivery" ? "Доставка" : "Самовывоз",
    },
    ...(order.delivery_address ? [{ label: "Адрес", value: order.delivery_address }] : []),
    ...(order.desired_date ? [{ label: "Желаемая дата", value: order.desired_date }] : []),
    { label: "Статус", value: ORDER_STATUS_LABELS[order.status] ?? order.status },
  ];

  return (
    <div className="container-page py-16 md:py-24">
      <div className="mx-auto max-w-xl">
        <div className="text-center">
          <span
            className="inline-flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent"
            aria-hidden="true"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12.5l4.5 4.5L19 7.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>

          <h1 className="mt-6 text-2xl md:text-3xl">Заказ №{order.order_number} принят</h1>
          <p className="mt-3 text-sm text-ink-muted">
            Мы свяжемся с вами по телефону{" "}
            <span className="tnum whitespace-nowrap text-ink">{order.customer_phone}</span> для
            подтверждения деталей.
          </p>
        </div>

        <Card className="mt-10 p-6">
          <p className="eyebrow mb-4">Состав заказа</p>
          <ul className="space-y-2.5 text-sm">
            {order.items.map((item) => (
              <li key={item.product_id} className="flex justify-between gap-3">
                <span className="text-ink-muted">
                  {item.name} <span className="tnum text-ink-subtle">× {item.quantity}</span>
                </span>
                <Price value={item.line_total} className="shrink-0" />
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
            <span className="text-sm">Итого</span>
            <Price value={order.total_price} className="text-lg font-medium" />
          </div>

          <dl className="mt-6 space-y-2.5 border-t border-line pt-5 text-sm">
            {details.map((item) => (
              <div key={item.label} className="flex justify-between gap-4">
                <dt className="text-ink-subtle">{item.label}</dt>
                <dd className="text-right">{item.value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <div className="mt-8 flex justify-center">
          <LinkButton href="/catalog" variant="secondary">
            Вернуться в каталог
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
