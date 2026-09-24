"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/components/cart-context";
import {
  Breadcrumbs,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  Input,
  LinkButton,
  Price,
  Textarea,
} from "@/components/ui";
import { ApiError, apiFetch, type OrderCreate } from "@/lib/api";
import { formatDate } from "@/lib/format";

type FormState = {
  customer_name: string;
  customer_phone: string;
  delivery_method: "pickup" | "delivery";
  delivery_address: string;
  desired_date: string;
  customer_comment: string;
  consent_pd: boolean;
  website: string;
};

const INITIAL: FormState = {
  customer_name: "",
  customer_phone: "",
  delivery_method: "pickup",
  delivery_address: "",
  desired_date: "",
  customer_comment: "",
  // Галочка согласия снята по умолчанию — предпроставленное согласие
  // не считается осознанным по 152-ФЗ
  consent_pd: false,
  website: "",
};

const DELIVERY_OPTIONS = [
  { value: "pickup", title: "Самовывоз", hint: "Заберёте сами в согласованное время" },
  { value: "delivery", title: "Доставка", hint: "Привезём по адресу" },
] as const;

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, loading, refresh } = useCart();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [commonError, setCommonError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Самая ранняя дата считается сервером: срок изготовления самой долгой позиции
  // от сегодняшнего дня по Москве. Клиент её не пересчитывает, а только подсказывает.
  const earliestDate = cart?.earliest_date ?? "";
  // Позицию под заказ без даты бэкенд не примет — просим дату сразу
  const dateRequired = cart?.items.some((item) => item.lead_time_days > 0) ?? false;

  function earlyDateMessage(date: string): string {
    return `Выберите дату не раньше ${formatDate(date)}`;
  }

  /** Клиентская проверка — для быстрой обратной связи; сервер валидирует всё заново. */
  function validate(): boolean {
    const next: Record<string, string> = {};
    if (form.customer_name.trim().length < 2) next.customer_name = "Укажите имя";
    if (!/^\+?[\d\s\-()]{7,20}$/.test(form.customer_phone.trim()))
      next.customer_phone = "Укажите телефон в формате +7 900 000-00-00";
    if (form.delivery_method === "delivery" && !form.delivery_address.trim())
      next.delivery_address = "При доставке адрес обязателен";
    if (dateRequired && !form.desired_date) next.desired_date = earlyDateMessage(earliestDate);
    // Строки YYYY-MM-DD сравниваются лексикографически так же, как даты
    else if (form.desired_date && earliestDate && form.desired_date < earliestDate)
      next.desired_date = earlyDateMessage(earliestDate);
    if (!form.consent_pd) next.consent_pd = "Без согласия заказ оформить нельзя";

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setCommonError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload: OrderCreate = {
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
        delivery_method: form.delivery_method,
        delivery_address: form.delivery_method === "delivery" ? form.delivery_address.trim() : null,
        desired_date: form.desired_date || null,
        customer_comment: form.customer_comment.trim() || null,
        consent_pd: form.consent_pd,
        website: form.website || null,
      };
      const result = await apiFetch<{ order_number: string }>("/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await refresh();
      router.push(`/order/${result.order_number}`);
    } catch (error) {
      const serverEarliest = error instanceof ApiError ? error.data?.earliest_date : undefined;
      if (typeof serverEarliest === "string") {
        // Сервер знает дату точнее: корзина могла открыться вчера, а сейчас уже новый день
        setErrors({ desired_date: earlyDateMessage(serverEarliest) });
        setCommonError(error instanceof ApiError ? error.message : null);
      } else if (error instanceof ApiError && error.fieldErrors) {
        setErrors(error.fieldErrors);
        setCommonError(error.message);
      } else {
        setCommonError(
          error instanceof ApiError ? error.message : "Не удалось оформить заказ, попробуйте позже",
        );
      }
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="container-page py-10 md:py-14">
        <div className="h-96 animate-pulse rounded-lg bg-surface-sunken" />
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="container-page py-10 md:py-14">
        <h1 className="text-3xl">Оформление заказа</h1>
        <div className="mt-10">
          <EmptyState
            title="Корзина пуста"
            description="Сначала выберите товары — потом вернёмся к оформлению."
            action={<LinkButton href="/catalog">В каталог</LinkButton>}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-10 md:py-14">
      <Breadcrumbs
        items={[
          { href: "/catalog", label: "Каталог" },
          { href: "/cart", label: "Корзина" },
          { label: "Оформление" },
        ]}
      />
      <h1 className="mt-4 text-3xl">Оформление заказа</h1>

      <form
        onSubmit={handleSubmit}
        className="mt-10 grid gap-8 md:grid-cols-12 md:gap-10"
        noValidate
      >
        <div className="space-y-8 md:col-span-7">
          <fieldset className="space-y-5">
            <legend className="eyebrow mb-4">Контактные данные</legend>

            <Field label="Имя" required error={errors.customer_name}>
              <Input
                value={form.customer_name}
                onChange={(e) => update("customer_name", e.target.value)}
                autoComplete="name"
              />
            </Field>

            <Field label="Телефон" required error={errors.customer_phone}>
              <Input
                value={form.customer_phone}
                onChange={(e) => update("customer_phone", e.target.value)}
                autoComplete="tel"
                inputMode="tel"
                placeholder="+7 900 000-00-00"
              />
            </Field>
          </fieldset>

          <fieldset>
            <legend className="eyebrow mb-4">Способ получения</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {DELIVERY_OPTIONS.map((option) => {
                const selected = form.delivery_method === option.value;
                return (
                  <label
                    key={option.value}
                    className={`cursor-pointer rounded-md p-4 transition-[box-shadow,background-color] duration-150 ${
                      selected
                        ? "bg-accent-soft ring-1 ring-inset ring-accent/35"
                        : "bg-surface shadow-raised hover:bg-surface-sunken"
                    }`}
                  >
                    <input
                      type="radio"
                      name="delivery_method"
                      value={option.value}
                      checked={selected}
                      onChange={() => update("delivery_method", option.value)}
                      className="sr-only"
                    />
                    <span className="block text-sm font-medium">{option.title}</span>
                    <span className="mt-1 block text-xs text-ink-muted">{option.hint}</span>
                  </label>
                );
              })}
            </div>

            {form.delivery_method === "delivery" ? (
              <div className="mt-5">
                <Field label="Адрес доставки" required error={errors.delivery_address}>
                  <Input
                    value={form.delivery_address}
                    onChange={(e) => update("delivery_address", e.target.value)}
                    autoComplete="street-address"
                    placeholder="Город, улица, дом, квартира"
                  />
                </Field>
              </div>
            ) : null}
          </fieldset>

          <fieldset className="space-y-5">
            <legend className="eyebrow mb-4">Детали заказа</legend>

            <Field
              label="Желаемая дата получения"
              required={dateRequired}
              error={errors.desired_date}
            >
              <Input
                type="date"
                min={earliestDate || undefined}
                value={form.desired_date}
                onChange={(e) => update("desired_date", e.target.value)}
              />
            </Field>

            <Field label="Комментарий" error={errors.customer_comment}>
              <Textarea
                value={form.customer_comment}
                onChange={(e) => update("customer_comment", e.target.value)}
                placeholder="Пожелания к оформлению, время звонка"
              />
            </Field>
          </fieldset>

          {/* Honeypot: скрыт от человека, но заполняется ботами */}
          <div className="hidden" aria-hidden="true">
            <input
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(e) => update("website", e.target.value)}
            />
          </div>

          <Checkbox
            checked={form.consent_pd}
            onChange={(e) => update("consent_pd", e.target.checked)}
            error={errors.consent_pd}
            label={
              <>
                Согласен на обработку персональных данных в соответствии с{" "}
                <a
                  href="/privacy"
                  className="text-accent underline underline-offset-2"
                  target="_blank"
                  rel="noreferrer"
                >
                  политикой конфиденциальности
                </a>
                <span className="text-accent"> *</span>
              </>
            }
          />
        </div>

        <aside className="md:col-span-5">
          <Card className="p-6 md:sticky md:top-24">
            <p className="eyebrow mb-4">Ваш заказ</p>

            <ul className="space-y-2.5 text-sm">
              {cart.items.map((item) => (
                <li key={item.product_id} className="flex justify-between gap-3">
                  <span className="min-w-0 text-ink-muted">
                    <span className="block truncate">{item.name}</span>
                    <span className="tnum text-xs text-ink-subtle">× {item.quantity}</span>
                  </span>
                  <Price value={item.line_total} className="shrink-0" />
                </li>
              ))}
            </ul>

            <div className="mt-5 flex items-baseline justify-between border-t border-line pt-4">
              <span className="text-sm">Итого</span>
              <Price value={cart.total_price} className="text-xl font-medium" />
            </div>

            {commonError ? (
              <p
                role="alert"
                className="mt-4 rounded-sm bg-accent-soft px-3 py-2 text-xs text-danger"
              >
                {commonError}
              </p>
            ) : null}

            <Button type="submit" disabled={submitting} className="mt-6 w-full">
              {submitting ? "Отправляем…" : "Подтвердить заказ"}
            </Button>
            <p className="mt-4 text-xs leading-relaxed text-ink-subtle">
              Оплата при получении или по договорённости. После оформления мы перезвоним для
              подтверждения деталей.
            </p>
          </Card>
        </aside>
      </form>
    </div>
  );
}
