/**
 * «Заказ принят» по кадру new/design/pages/cart-checkout.png (007b).
 *
 * Открывается только по ссылке после оформления: `?t=` — подписанный токен на 7 дней
 * (007a). Без него или с чужим — 404: номер заказа короткий и угадывается, а на
 * странице адрес и состав. Телефон и почта приходят из API уже замаскированными —
 * ссылку могут переслать, полные контакты в ней не нужны.
 *
 * Три шага — что будет дальше: как свяжемся (звонок или Telegram — что выбрал
 * покупатель), подтверждение и где/когда получить. Заказ после закрытия
 * (`after_hours`) — первый шаг честно говорит, что свяжемся утром.
 */

import { notFound } from "next/navigation";
import { Breadcrumbs, LinkButton } from "@/components/ui";
import { apiGet, apiGetPrivate, type ContactsPage, type Order } from "@/lib/api";
import { dayLong, intervalRange } from "@/lib/checkout";
import { typograf } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Заказ принят",
  description: "Что будет с заказом дальше.",
  path: "/order",
  noindex: true,
});
// Персональные данные и статус: никакого кэша
export const dynamic = "force-dynamic";

const money = (value: string | number) =>
  `${Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`;

function contactStep(order: Order): string {
  const how =
    order.contact_method === "telegram"
      ? `напишем в Telegram на ${order.phone_masked}`
      : `позвоним на ${order.phone_masked}`;
  if (order.after_hours) {
    return `Заказ пришёл после ${order.work_hours_end}:00, поэтому свяжемся утром после ${order.work_hours_start}:00: ${how}`;
  }
  return `${how[0]!.toUpperCase()}${how.slice(1)} в течение 30 минут`;
}

function whenText(order: Order): string {
  const parts = [
    order.desired_date ? dayLong(order.desired_date) : null,
    order.delivery_interval ? intervalRange(order.delivery_interval) : null,
  ].filter(Boolean);
  return parts.join(" ");
}

function receiveStep(order: Order, pickupPlace: string | null): string {
  const when = whenText(order);
  if (order.delivery_method === "delivery") {
    const address = [
      order.delivery_address,
      order.address_apartment ? `кв. ${order.address_apartment}` : null,
      order.address_entrance ? `подъезд ${order.address_entrance}` : null,
      order.address_floor ? `этаж ${order.address_floor}` : null,
    ]
      .filter(Boolean)
      .join(", ");
    return `Привезём по адресу ${address}${when ? `, ${when}` : ""}`;
  }
  return `Заказ ждёт вас${pickupPlace ? ` ${pickupPlace}` : " в кондитерской"}${when ? `, ${when}` : ""}`;
}

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ order_number: string }>;
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const [{ order_number: orderNumber }, query] = await Promise.all([params, searchParams]);
  const token = Array.isArray(query.t) ? query.t[0] : query.t;
  if (!token) notFound();

  const [order, contacts] = await Promise.all([
    apiGetPrivate<Order>(
      `/orders/${encodeURIComponent(orderNumber)}?t=${encodeURIComponent(token)}`,
    ).catch(() => null),
    apiGet<ContactsPage>("/pages/contacts").catch(() => null),
  ]);
  if (!order) notFound();

  const content = contacts?.content;
  const steps = [
    contactStep(order),
    "Подтвердим состав, дату и сумму, договоримся об оплате",
    receiveStep(order, content?.pickup_place ?? null),
  ];
  const delivery = order.delivery_method === "delivery";

  return (
    <div className="order-page public-page container-page pt-8 pb-20 xl:pt-[41px] xl:pb-[160px]">
      <Breadcrumbs items={[{ href: "/", label: "Главная" }, { label: "Заказ принят" }]} />
      <p className="mt-6 text-[14px] leading-5 text-ink-subtle xl:mt-[27px]">
        Заказ № {order.order_number}
      </p>
      <h1 className="mt-1 font-display text-section leading-[1.1] text-ink">Заказ принят</h1>

      <div className="max-w-[760px]">
        <ol className="mt-[30px] border-t border-line">
          {steps.map((text, index) => (
            <li
              key={index}
              className="flex items-baseline gap-6 border-b border-line py-[22px] sm:gap-[42px]"
            >
              <span
                aria-hidden="true"
                className="w-[14px] shrink-0 font-display text-[28px] leading-7 text-accent"
              >
                {index + 1}
              </span>
              <span className="text-[17px] leading-6 text-ink">{typograf(text)}</span>
            </li>
          ))}
        </ol>

        {order.email_masked ? (
          <p className="mt-[22px] text-[14px] leading-5 text-ink-muted">
            Копию заказа пришлём на {order.email_masked}
          </p>
        ) : null}

        <details className="group mt-[30px]">
          <summary className="cursor-pointer text-[15px] font-medium text-ink marker:text-[10px]">
            Состав заказа
          </summary>
          <ul className="mt-4 flex flex-col gap-3 border-t border-line pt-4 text-[15px] leading-5">
            {order.items.map((item, index) => (
              <li key={index} className="flex justify-between gap-4">
                <span className="text-ink">
                  {typograf(item.name)}
                  {item.variant_label ? `, ${item.variant_label}` : ""}
                  <span className="text-ink-subtle tabular-nums"> × {item.quantity}</span>
                  {item.inscription_text ? (
                    <span className="block text-[13px] text-ink-subtle">
                      Надпись «{item.inscription_text}»
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 tabular-nums">{money(item.line_total)}</span>
              </li>
            ))}
            <li className="flex justify-between gap-4 text-ink-muted">
              <span>{delivery ? "Доставка" : "Самовывоз"}</span>
              <span className="shrink-0 tabular-nums">
                {Number(order.delivery_price) > 0 ? money(order.delivery_price) : "бесплатно"}
              </span>
            </li>
          </ul>
          <p className="mt-4 flex justify-between gap-4 border-t border-line pt-4 text-[17px] font-semibold text-ink">
            <span>Итого</span>
            <span className="tabular-nums">{money(order.total_price)}</span>
          </p>
        </details>

        <LinkButton href="/catalog" variant="outline" className="mt-[34px]">
          Вернуться в каталог
        </LinkButton>

        {contacts?.telegram_url ? (
          <p className="mt-[22px] text-[14px] leading-5 text-ink-muted">
            Вопрос по заказу?{" "}
            <a
              href={contacts.telegram_url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-ink underline underline-offset-[3px] transition-colors hover:text-accent"
            >
              Написать в Telegram
            </a>
          </p>
        ) : null}
      </div>
    </div>
  );
}
