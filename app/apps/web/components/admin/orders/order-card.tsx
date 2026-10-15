"use client";

/**
 * Карточка заказа справа (011d, концепт Orders.dc.html): бордовая шапка с этапами,
 * клиент с кнопкой «Позвонить», получение, состав с фото, комментарий, кнопка
 * следующего шага и «Отменить» через диалог с причиной.
 *
 * Смена статуса — оптимистичная: карточка и строка списка меняются сразу,
 * при ошибке откатываются, а тост объясняет, что случилось (например, 409:
 * заказ уже выдан в другой вкладке).
 */

import {
  ArrowRight,
  ChatCircle,
  Check,
  Envelope,
  MapPin,
  MoonStars,
  Phone,
  User,
} from "@phosphor-icons/react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import {
  Avatar,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Notice,
  Skeleton,
  StatusBadge,
  Textarea,
  useToast,
} from "@/components/admin/ui";
import { intervalLabel } from "@/lib/admin-dashboard";
import { ORDER_STEPS, isFinal, nextStep, stepIndex } from "@/lib/admin-orders";
import {
  ApiError,
  formatPrice,
  imageUrl,
  type OrderAdminDetail,
  type OrderStatus,
} from "@/lib/api";
import { formatDayShort, formatPhone, typograf } from "@/lib/format";

const money = (value: string | number) => formatPrice(value).replace(" ₽", " ₽");

const MONTHS = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

/** «2026-10-01T17:53:00+03:00» → «1 октября, 17:53»: время уже по часам кондитерской. */
function createdLabel(iso: string): string {
  const [day, time] = [iso.slice(0, 10), iso.slice(11, 16)];
  const [, month, date] = day.split("-").map(Number) as [number, number, number];
  return `${date} ${MONTHS[month - 1]}, ${time}`;
}

export function OrderCard({
  orderId,
  onStatusChange,
}: {
  orderId: number;
  /** Сообщить списку о новом статусе (и о откате, если сервер отказал) */
  onStatusChange: (id: number, status: OrderStatus) => void;
}) {
  const { authFetch } = useAdminAuth();
  const toast = useToast();
  const [order, setOrder] = useState<OrderAdminDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    let cancelled = false;
    setOrder(null);
    setError(null);
    authFetch<OrderAdminDetail>(`/admin/orders/${orderId}`)
      .then((data) => !cancelled && setOrder(data))
      .catch(
        (err) =>
          !cancelled &&
          setError(err instanceof ApiError ? err.message : "Не удалось открыть заказ"),
      );
    return () => {
      cancelled = true;
    };
  }, [authFetch, orderId]);

  async function changeStatus(status: OrderStatus, cancelReason?: string) {
    if (!order) return;
    const previous = order;
    setBusy(true);
    setOrder({
      ...order,
      status,
      cancel_reason: status === "cancelled" ? cancelReason || null : order.cancel_reason,
    });
    onStatusChange(order.id, status);
    try {
      await authFetch(`/admin/orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, ...(cancelReason ? { reason: cancelReason } : {}) }),
      });
      toast.success(status === "cancelled" ? "Заказ отменён" : "Статус заказа обновлён");
      setCancelOpen(false);
      setReason("");
    } catch (err) {
      setOrder(previous);
      onStatusChange(previous.id, previous.status);
      toast.error(err instanceof ApiError ? err.message : "Не удалось изменить статус");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="p-5">
        <Notice role="alert">{error}</Notice>
      </div>
    );
  }

  if (!order) {
    return (
      <div aria-busy="true" aria-label="Загружаем заказ" className="flex flex-col">
        <div className="flex flex-col gap-3 bg-admin-side px-[22px] pt-[22px] pb-[18px]">
          <Skeleton className="h-3 w-32 bg-admin-side-ink/15" />
          <Skeleton className="h-8 w-48 bg-admin-side-ink/15" />
          <Skeleton className="h-10 w-full bg-admin-side-ink/15" />
        </div>
        <div className="flex flex-col gap-4 p-[22px]">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      </div>
    );
  }

  const phone = formatPhone(order.customer_phone);
  const current = stepIndex(order.status);
  const next = nextStep(order.status);
  const final = isFinal(order.status);
  const when = [
    order.delivery_method === "delivery" ? "Доставка" : "Самовывоз",
    order.desired_date ? formatDayShort(order.desired_date) : "дата не выбрана",
    order.delivery_interval ? intervalLabel(order.delivery_interval) : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <article aria-labelledby="order-title" className="flex flex-col">
      <header className="flex flex-col gap-2.5 bg-admin-side px-[22px] pt-[22px] pb-[18px] text-admin-side-ink">
        <div className="flex items-center justify-between gap-3">
          <span className="flex flex-wrap items-center gap-2 text-[12.5px] font-semibold text-admin-side-ink/75">
            Оформлен {createdLabel(order.created_at)}
            {order.after_hours ? (
              // Вне часов ответа (007a): покупателю обещано «свяжемся утром»
              <span className="inline-flex items-center gap-1 rounded-full bg-admin-side-ink/15 px-2 py-0.5 text-[11.5px] font-bold text-admin-side-ink">
                <MoonStars aria-hidden="true" size={13} weight="bold" />
                пришёл ночью
              </span>
            ) : null}
          </span>
          {order.status === "cancelled" ? (
            <span className="rounded-full bg-admin-side-ink/15 px-2.5 py-1 text-xs font-bold">
              Отменён
            </span>
          ) : null}
        </div>
        <h2 id="order-title" className="font-display text-[34px] leading-none font-normal">
          Заказ № {order.order_number}
        </h2>
        <ol aria-label="Этапы заказа" className="mt-1.5 grid grid-cols-5">
          {ORDER_STEPS.map((step, index) => {
            const done = current > index || order.status === "completed";
            const active = current === index && order.status !== "completed";
            return (
              <li
                key={step.status}
                aria-current={active ? "step" : undefined}
                className="flex min-w-0 flex-col items-center gap-1.5 text-center"
              >
                <span
                  aria-hidden="true"
                  className={`flex size-[26px] items-center justify-center rounded-full text-xs font-extrabold ${
                    done
                      ? "bg-admin-cream text-admin-side"
                      : active
                        ? "bg-admin-card text-admin-side shadow-[0_0_0_3px_rgb(243_229_200/0.35)]"
                        : "bg-admin-side-ink/15 text-admin-side-ink/70"
                  }`}
                >
                  {done ? <Check size={13} weight="bold" /> : index + 1}
                </span>
                <span
                  // «Подтверждён» был шире колонки шага, и подписи слипались (ревью 005a):
                  // колонки без промежутков, кегль на полпункта меньше, плотнее трекинг
                  className={`w-full text-[10.5px] leading-tight tracking-[-0.01em] hyphens-auto max-adm-2xl:text-[10px] ${active ? "font-extrabold text-admin-card" : "font-semibold text-admin-side-ink/75 max-adm-sm:sr-only"}`}
                >
                  {step.label}
                  {done ? <span className="sr-only"> (пройден)</span> : null}
                </span>
              </li>
            );
          })}
        </ol>
      </header>

      <div className="flex flex-col gap-4 px-[22px] py-[18px]">
        <div className="flex items-center gap-3">
          <Avatar name={order.customer_name} size="lg" />
          <span className="flex min-w-0 grow flex-col gap-0.5">
            <span className="truncate text-[15px] font-bold">{order.customer_name}</span>
            <span className="text-[13.5px] text-admin-muted tabular-nums">{phone.display}</span>
          </span>
          <a
            href={phone.href}
            aria-label={`Позвонить: ${phone.display}`}
            title={order.contact_method === "telegram" ? "Просили написать в Telegram" : undefined}
            className="flex size-10 shrink-0 items-center justify-center rounded-admin-control bg-admin-green-soft text-admin-green transition-transform duration-150 hover:bg-admin-green hover:text-admin-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-side active:translate-y-px"
          >
            <Phone aria-hidden="true" size={19} />
          </a>
        </div>

        {/* Оформление 007a: почта, способ связи, получатель */}
        <dl className="flex flex-col gap-1.5 text-[13.5px]">
          <div className="flex items-center gap-2">
            <dt className="sr-only">Как связаться</dt>
            <ChatCircle aria-hidden="true" size={17} className="shrink-0 text-admin-side" />
            <dd>
              {order.contact_method === "telegram"
                ? "Просили написать в Telegram"
                : order.contact_method === "call"
                  ? "Просили позвонить"
                  : "Способ связи не указан"}
            </dd>
          </div>
          {order.customer_email ? (
            <div className="flex items-center gap-2">
              <dt className="sr-only">Почта</dt>
              <Envelope aria-hidden="true" size={17} className="shrink-0 text-admin-side" />
              <dd className="min-w-0 truncate">
                <a href={`mailto:${order.customer_email}`} className="underline underline-offset-2">
                  {order.customer_email}
                </a>
              </dd>
            </div>
          ) : null}
          {order.recipient_name ? (
            <div className="flex items-center gap-2">
              <dt className="sr-only">Получатель</dt>
              <User aria-hidden="true" size={17} className="shrink-0 text-admin-side" />
              <dd>
                Получит: <b>{order.recipient_name}</b>
                {order.recipient_phone ? (
                  <a
                    href={formatPhone(order.recipient_phone).href}
                    className="ml-1.5 text-admin-muted tabular-nums underline underline-offset-2"
                  >
                    {formatPhone(order.recipient_phone).display}
                  </a>
                ) : null}
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="flex items-start gap-3 rounded-admin-control bg-admin-panel p-3.5">
          <MapPin aria-hidden="true" size={19} className="mt-px shrink-0 text-admin-side" />
          <span className="flex flex-col gap-[3px]">
            <span className="text-sm font-bold">{when}</span>
            <span className="text-[13px] text-admin-muted">
              {order.delivery_method === "delivery"
                ? [
                    order.delivery_address ?? "Адрес не указан",
                    order.address_apartment ? `кв./офис ${order.address_apartment}` : null,
                    order.address_entrance ? `подъезд ${order.address_entrance}` : null,
                    order.address_floor ? `этаж ${order.address_floor}` : null,
                  ]
                    .filter(Boolean)
                    .join(", ")
                : "Заберут из кондитерской"}
            </span>
            {order.courier_comment ? (
              <span className="text-[13px]">
                <b>Курьеру:</b> {typograf(order.courier_comment)}
              </span>
            ) : null}
          </span>
        </div>

        <div className="flex flex-col gap-2.5">
          <ul aria-label="Состав заказа" className="flex flex-col gap-2.5">
            {order.items.map((item, index) => {
              const src = imageUrl(item.image_key);
              return (
                <li
                  key={index}
                  className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2"
                >
                  <span className="h-[54px] w-11 overflow-hidden rounded-lg bg-admin-photo">
                    {src ? (
                      <Image
                        src={src}
                        alt=""
                        width={44}
                        height={54}
                        sizes="44px"
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-bold">{item.name}</span>
                    <span className="text-[12.5px] text-admin-muted">
                      {item.variant_label} · {item.quantity} шт.
                    </span>
                  </span>
                  <span className="text-sm font-bold tabular-nums">{money(item.line_total)}</span>
                  {item.inscription_text ? (
                    // Надпись пишет кондитер — крупно и дословно, без обрезки (005a)
                    <p className="col-span-3 flex flex-col gap-1 rounded-admin-control border border-admin-field px-3.5 py-2.5">
                      <span className="text-[12.5px] text-admin-muted">
                        Надпись на табличке
                        {item.inscription_price ? ` · +${money(item.inscription_price)}` : ""}
                      </span>
                      <span className="text-lg font-extrabold break-words">
                        {item.inscription_text}
                      </span>
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {Number(order.delivery_price) > 0 || order.delivery_method === "delivery" ? (
            <p className="flex justify-between border-t border-dashed border-admin-field pt-3 text-sm">
              <span>Доставка</span>
              <span className="tabular-nums">
                {Number(order.delivery_price) > 0 ? money(order.delivery_price) : "бесплатно"}
              </span>
            </p>
          ) : null}
          <p className="flex justify-between border-t border-dashed border-admin-field pt-3 text-base font-extrabold">
            <span>Итого</span>
            <span className="tabular-nums">{money(order.total_price)}</span>
          </p>
        </div>

        {order.customer_comment ? (
          <p className="rounded-admin-control bg-admin-amber-soft px-3.5 py-3 text-[13.5px] leading-[1.45] text-[#5c3a0c]">
            <b>Комментарий к заказу:</b> {typograf(order.customer_comment)}
          </p>
        ) : null}
        {order.status === "cancelled" && order.cancel_reason ? (
          <p className="rounded-admin-control bg-admin-grey-soft px-3.5 py-3 text-[13.5px] leading-[1.45] text-admin-muted">
            <b>Причина отмены:</b> {typograf(order.cancel_reason)}
          </p>
        ) : null}
      </div>

      {final ? (
        <div className="px-[22px] pb-[22px]">
          <p className="flex items-center gap-2 text-[13.5px] text-admin-muted">
            <StatusBadge kind="order" status={order.status} />
            {order.status === "completed" ? "Заказ закрыт" : "Статус больше не меняется"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2.5 px-[22px] pb-[22px]">
          {next ? (
            <Button
              size="lg"
              className="h-12"
              loading={busy && !cancelOpen}
              icon={<ArrowRight aria-hidden="true" size={18} weight="bold" />}
              onClick={() => void changeStatus(next.status)}
            >
              {next.label}
            </Button>
          ) : (
            <span />
          )}
          <Button
            variant="outline"
            size="lg"
            className="h-12 text-admin-side"
            disabled={busy}
            onClick={() => setCancelOpen(true)}
          >
            Отменить
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={cancelOpen}
        title={`Отменить заказ № ${order.order_number}?`}
        text="Клиенту нужно будет сообщить об отмене самим: по телефону из карточки."
        confirmLabel="Отменить заказ"
        cancelLabel="Не отменять"
        loading={busy}
        onConfirm={() => void changeStatus("cancelled", reason.trim())}
        onClose={() => setCancelOpen(false)}
      >
        <Field label="Причина" hint="Необязательно. Видна только в карточке заказа">
          {(a11y) => (
            <Textarea
              {...a11y}
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          )}
        </Field>
      </ConfirmDialog>
    </article>
  );
}

export function OrderCardEmpty() {
  return (
    <EmptyState
      title="Выберите заказ"
      text="Нажмите на строку слева: здесь откроются клиент, состав и кнопки статуса."
    />
  );
}
