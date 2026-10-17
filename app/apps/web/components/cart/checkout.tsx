"use client";

/**
 * Оформление заказа на странице корзины (007b, кадры cart-checkout.png): слева —
 * строки корзины, допродажа и три шага формы, справа — липкий «Ваш заказ».
 *
 * - Форма — React Hook Form + Zod (`lib/checkout.ts`), правила те же, что у
 *   `OrderCreate`. Проверка при отправке, после первой — при уходе с поля.
 *   Первое поле с ошибкой получает фокус, страница прокручивается к нему Lenis-ом.
 *   Серверные 422 раскладываются по полям; «слишком рано» — в блок даты.
 * - Переключатели (способ, дата, окно, «как связаться») — `radiogroup`: Tab
 *   заходит в группу, стрелки выбирают.
 * - Черновик (кроме согласия) — в sessionStorage: после «Изменить» или ухода на товар
 *   форма не теряется. Читается после гидрации — разметка сервера и клиента совпадает.
 * - Двойное нажатие «Отправить заказ» не создаёт два заказа: кнопка выключена на время
 *   запроса, а заголовок `Idempotency-Key` (один на попытку) сервер помнит 10 минут.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Controller, useForm, useWatch, type FieldErrors } from "react-hook-form";
import { useCart } from "@/components/cart-context";
import { FloatingActionBar } from "@/components/floating-action-bar";
import { Check, RadioGroup, RadioPills, TextField } from "@/components/form-fields";
import { useLenis } from "@/components/lenis-provider";
import { ApiError, apiFetch, type Cart, type OrderCreated } from "@/lib/api";
import {
  EMPTY_CHECKOUT,
  checkoutSchema,
  clearDraft,
  dayLong,
  dayShort,
  earliestReasonText,
  formatPhoneInput,
  intervalText,
  keepInterval,
  loadDraft,
  positionsText,
  saveDraft,
  toOrderPayload,
  type CheckoutValues,
  type Method,
} from "@/lib/checkout";
import { typograf } from "@/lib/format";
import { reachGoal } from "@/lib/metrika";

const money = (value: number | string) =>
  `${Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`;

/** Порядок полей на странице — для фокуса на первом поле с ошибкой. */
const FIELD_ORDER: (keyof CheckoutValues)[] = [
  "delivery_address",
  "address_apartment",
  "address_entrance",
  "address_floor",
  "courier_comment",
  "desired_date",
  "delivery_interval",
  "customer_name",
  "customer_phone",
  "customer_email",
  "recipient_name",
  "recipient_phone",
  "customer_comment",
  "consent_pd",
];

const fieldId = (name: string) => `checkout-${name.replaceAll("_", "-")}`;

export type PickupInfo = {
  /** «на Гжатской, 5к8» */
  place: string | null;
  /** «Каждый день с 9:00 до 21:00» */
  hours: string | null;
  routeUrl: string | null;
};

export function Checkout({
  cart,
  pickup,
  children,
}: {
  cart: Cart;
  pickup: PickupInfo;
  /** Строки корзины, допродажа и «Продолжить покупки» — над шагами формы */
  children: ReactNode;
}) {
  const router = useRouter();
  const lenis = useLenis();
  const { refresh } = useCart();
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [intervalNote, setIntervalNote] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  // Один ключ на попытку оформления: повтор того же запроса вернёт тот же заказ
  const idempotency = useRef<string>("");

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    getValues,
    formState: { errors, isSubmitted },
  } = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: EMPTY_CHECKOUT,
    mode: "onSubmit",
    reValidateMode: "onBlur",
    shouldFocusError: false,
  });
  const values = useWatch({ control });
  const method = (values.delivery_method ?? "pickup") as Method;
  const date = values.desired_date ?? "";
  const days = cart.slots[method];
  const day = days.find((item) => item.date === date);

  // Черновик — после гидрации: на сервере его нет, разметка должна совпасть.
  // Сохранённые дата и окно могли устареть (вчерашний черновик) — проверяем по слотам
  useEffect(() => {
    const draft = loadDraft();
    const merged = { ...EMPTY_CHECKOUT, ...draft };
    const draftDay = cart.slots[merged.delivery_method].find(
      (item) => item.date === merged.desired_date,
    );
    if (!draftDay?.available) {
      merged.desired_date = "";
      merged.delivery_interval = "";
    } else if (
      !draftDay.intervals.some(
        (item) => item.interval === merged.delivery_interval && item.available,
      )
    ) {
      merged.delivery_interval = "";
    }
    reset(merged);
    idempotency.current = newKey();
    setHydrated(true);
    // Только при открытии страницы: дальше черновик пишет сама форма
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hydrated) saveDraft({ ...EMPTY_CHECKOUT, ...values } as CheckoutValues);
  }, [values, hydrated]);

  function chooseMethod(next: Method) {
    const current = getValues();
    setValue("delivery_method", next, { shouldValidate: isSubmitted });
    const kept = keepInterval(cart, next, current.desired_date, current.delivery_interval);
    const nextDay = cart.slots[next].find((item) => item.date === current.desired_date);
    if (current.desired_date && !nextDay?.available) {
      setValue("desired_date", "");
      setValue("delivery_interval", "");
      setIntervalNote("Эта дата недоступна для выбранного способа, выберите другую");
    } else if (kept.dropped) {
      setValue("delivery_interval", "");
      setIntervalNote(
        next === "delivery"
          ? `Доставка не возит в ${intervalText(current.delivery_interval)} — выберите другое окно`
          : "Это окно уже недоступно — выберите другое",
      );
    } else {
      setIntervalNote(null);
    }
  }

  function focusField(name: keyof CheckoutValues) {
    const element = document.getElementById(fieldId(name));
    if (!element) return;
    if (lenis) lenis.scrollTo(element, { offset: -180, duration: 0.6 });
    else element.scrollIntoView({ block: "center", behavior: "smooth" });
    element.focus({ preventScroll: true });
  }

  function onInvalid(found: FieldErrors<CheckoutValues>) {
    const first = FIELD_ORDER.find((name) => found[name]);
    if (first) focusField(first);
  }

  async function onValid(form: CheckoutValues) {
    setFormError(null);
    setSubmitting(true);
    try {
      const created = await apiFetch<OrderCreated>("/orders", {
        method: "POST",
        body: JSON.stringify(toOrderPayload(form, website)),
        headers: { "Idempotency-Key": idempotency.current },
      });
      // Цель — с суммой, без ПДн
      reachGoal("order_created", { total: Number(created.total_price) });
      clearDraft();
      await refresh();
      router.push(`/order/${created.order_number}?t=${encodeURIComponent(created.token)}`);
    } catch (error) {
      setSubmitting(false);
      applyServerError(error);
    }
  }

  function applyServerError(error: unknown) {
    if (!(error instanceof ApiError)) {
      setFormError("Не удалось отправить заказ. Проверьте интернет и попробуйте ещё раз");
      return;
    }
    const earliest = error.data?.earliest_date;
    if (typeof earliest === "string") {
      // Корзину могли открыть вчера: сервер знает ближайшую дату точнее
      setError("desired_date", {
        message: `Ближайшая дата получения — ${dayLong(earliest)}. Выберите её или позже`,
      });
      void refresh();
      focusField("desired_date");
      return;
    }
    const fields = Object.entries(error.fieldErrors ?? {}).filter(([name]) =>
      FIELD_ORDER.includes(name as keyof CheckoutValues),
    );
    for (const [name, message] of fields) {
      setError(name as keyof CheckoutValues, { message: message.replace(/^Value error, /, "") });
    }
    if (fields.length) {
      focusField(fields[0]![0] as keyof CheckoutValues);
    } else {
      setFormError(error.message.replace(/^Value error, /, ""));
    }
    if (error.status === 409 && !fields.length) {
      // Заказ уже отправляется (двойной клик) или в корзине недоступный товар
      void refresh();
    }
  }

  const delivery = method === "delivery";
  const deliveryPrice = Number(
    delivery ? cart.delivery_price_delivery : cart.delivery_price_pickup,
  );
  const total = Number(cart.subtotal) + deliveryPrice;
  const reason = earliestReasonText(cart);
  const hoursText = `с ${cart.work_hours_start}:00 до ${cart.work_hours_end}:00`;
  const pickupText = pickup.place
    ? `Кондитерская ${pickup.place}${pickup.hours ? `, ${lowerFirst(pickup.hours)}` : ""}.`
    : null;

  return (
    <form
      id="checkout"
      method="post"
      noValidate
      onSubmit={handleSubmit(onValid, onInvalid)}
      className="mt-[25px] grid gap-y-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-x-10 xl:grid-cols-[912px_432px] xl:max-[1512px]:grid-cols-[minmax(0,1fr)_432px] xl:justify-between"
    >
      <div className="min-w-0">
        {children}

        <noscript>
          <p className="mt-10 bg-photo px-[18px] py-[15px] text-[15px] text-ink">
            Для оформления включите JavaScript: форма заказа без него не работает. Или позвоните нам
            — примем заказ по телефону.
          </p>
        </noscript>

        {/* 01 Получение */}
        <Step number="01" title="Получение" className="mt-[62px]">
          <Controller
            control={control}
            name="delivery_method"
            render={({ field }) => (
              <RadioPills
                label="Способ получения"
                value={field.value}
                options={[
                  { value: "pickup", label: "Самовывоз" },
                  { value: "delivery", label: "Доставка" },
                ]}
                onChange={(next) => chooseMethod(next as Method)}
                className="mt-[22px]"
              />
            )}
          />
          {delivery ? (
            <div className="mt-[19px] flex flex-col gap-[22px]">
              <p className="text-[15px] leading-6 text-ink-muted">{typograf(cart.delivery_note)}</p>
              <TextField
                label="Улица и дом"
                placeholder="Например, Гжатская улица, 5"
                error={errors.delivery_address?.message}
                autoComplete="street-address"
                {...register("delivery_address")}
              />
              <div className="grid grid-cols-3 gap-4">
                <TextField
                  label="Квартира или офис"
                  error={errors.address_apartment?.message}
                  {...register("address_apartment")}
                />
                <TextField
                  label="Подъезд"
                  error={errors.address_entrance?.message}
                  {...register("address_entrance")}
                />
                <TextField
                  label="Этаж"
                  error={errors.address_floor?.message}
                  {...register("address_floor")}
                />
              </div>
              <TextField
                label="Комментарий курьеру"
                placeholder="Например, домофон 25"
                error={errors.courier_comment?.message}
                {...register("courier_comment")}
              />
            </div>
          ) : (
            <div className="mt-[11px] text-[15px] leading-6 text-ink-muted">
              {pickupText ? <p>{typograf(pickupText)}</p> : null}
              {pickup.routeUrl ? (
                <a
                  href={pickup.routeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-[4px] inline-block text-ink underline underline-offset-[3px] transition-colors hover:text-accent"
                >
                  Как добраться
                </a>
              ) : null}
            </div>
          )}
        </Step>

        {/* 02 Дата и время */}
        <Step number="02" title="Дата и время" className="mt-[62px]">
          {reason ? (
            <p className="mt-[22px] bg-photo px-[18px] py-[15px] text-[15px] leading-[22px] text-ink">
              {typograf(reason)}
            </p>
          ) : null}
          <Controller
            control={control}
            name="desired_date"
            render={({ field }) => (
              <RadioTiles
                id={fieldId("desired_date")}
                label="Дата"
                value={field.value}
                error={errors.desired_date?.message}
                options={days.map((item) => ({
                  value: item.date,
                  top: item.label,
                  bottom: dayShort(item.date),
                  disabled: !item.available,
                }))}
                onChange={(next) => {
                  field.onChange(next);
                  setIntervalNote(null);
                  const nextDay = days.find((item) => item.date === next);
                  const current = getValues("delivery_interval");
                  if (
                    current &&
                    !nextDay?.intervals.some((item) => item.interval === current && item.available)
                  ) {
                    setValue("delivery_interval", "");
                  }
                }}
                className="mt-[21px]"
              />
            )}
          />
          <Controller
            control={control}
            name="delivery_interval"
            render={({ field }) => (
              <RadioPills
                id={fieldId("delivery_interval")}
                label="Окно"
                visibleLabel
                value={field.value}
                error={errors.delivery_interval?.message}
                options={(day?.intervals ?? days[0]?.intervals ?? []).map((item) => ({
                  value: item.interval,
                  label: intervalText(item.interval),
                  disabled: !day || !item.available,
                }))}
                onChange={(next) => {
                  field.onChange(next);
                  setIntervalNote(null);
                }}
                className="mt-[25px]"
              />
            )}
          />
          {!day ? (
            <p className="mt-[13px] text-[14px] leading-5 text-ink">Сначала выберите дату</p>
          ) : intervalNote ? (
            <p role="status" className="mt-[14px] text-[14px] text-accent">
              {intervalNote}
            </p>
          ) : null}
        </Step>

        {/* 03 Контакты */}
        <Step number="03" title="Контакты" className="mt-[62px]">
          <div className="mt-[22px] grid gap-x-4 gap-y-4 sm:grid-cols-2">
            <TextField
              label="Имя"
              placeholder="Ваше имя"
              autoComplete="name"
              error={errors.customer_name?.message}
              {...register("customer_name")}
            />
            <Controller
              control={control}
              name="customer_phone"
              render={({ field }) => (
                <TextField
                  label="Телефон"
                  name="customer_phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+7 (900) 000-00-00"
                  error={errors.customer_phone?.message}
                  value={field.value}
                  onChange={(event) => field.onChange(formatPhoneInput(event.target.value))}
                  onBlur={field.onBlur}
                  ref={field.ref}
                />
              )}
            />
            <TextField
              label="Почта"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="name@mail.ru"
              error={errors.customer_email?.message}
              wide
              {...register("customer_email")}
            />
          </div>

          <Controller
            control={control}
            name="contact_method"
            render={({ field }) => (
              <RadioPills
                label="Как связаться для подтверждения"
                visibleLabel
                value={field.value}
                options={[
                  { value: "call", label: "Позвонить" },
                  { value: "telegram", label: "Написать в Telegram" },
                ]}
                onChange={field.onChange}
                className="mt-[25px]"
              />
            )}
          />

          <Controller
            control={control}
            name="other_recipient"
            render={({ field }) => (
              <Check
                id={fieldId("other_recipient")}
                checked={field.value}
                onChange={field.onChange}
                className="mt-[34px]"
              >
                Получит другой человек
              </Check>
            )}
          />
          {values.other_recipient ? (
            <div className="mt-[22px] grid gap-x-4 gap-y-[26px] sm:grid-cols-2">
              <TextField
                label="Имя получателя"
                autoComplete="off"
                error={errors.recipient_name?.message}
                {...register("recipient_name")}
              />
              <Controller
                control={control}
                name="recipient_phone"
                render={({ field }) => (
                  <TextField
                    label="Телефон получателя"
                    name="recipient_phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    placeholder="+7 (900) 000-00-00"
                    error={errors.recipient_phone?.message}
                    value={field.value}
                    onChange={(event) => field.onChange(formatPhoneInput(event.target.value))}
                    onBlur={field.onBlur}
                    ref={field.ref}
                  />
                )}
              />
            </div>
          ) : null}

          <TextField
            label="Комментарий к заказу"
            placeholder="Например, позвоните после 18:00"
            multiline
            error={errors.customer_comment?.message}
            className="mt-[34px]"
            {...register("customer_comment")}
          />

          <Controller
            control={control}
            name="consent_pd"
            render={({ field }) => (
              <Check
                id={fieldId("consent_pd")}
                checked={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={errors.consent_pd?.message}
                className="mt-[32px]"
              >
                Согласен на{" "}
                <a
                  href="/consent"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-[3px] transition-colors hover:text-accent"
                >
                  обработку персональных данных
                </a>{" "}
                по{" "}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-[3px] transition-colors hover:text-accent"
                >
                  политике конфиденциальности
                </a>
              </Check>
            )}
          />

          {/* Ловушка для ботов: людям не видна, бот заполнит — сервер отклонит */}
          <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
            <label>
              Сайт
              <input
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
              />
            </label>
          </div>
        </Step>
      </div>

      <aside aria-label="Ваш заказ" className="lg:self-start lg:sticky lg:top-[142px]">
        <div className="bg-photo px-6 py-8 sm:px-8">
          <h2 className="font-display text-[28px] leading-8 text-ink">Ваш заказ</h2>
          <dl className="mt-[35px] flex flex-col gap-[22px] text-[15px] leading-5 text-ink">
            <div className="flex justify-between gap-4">
              <dt>{positionsText(cart.total_items)}</dt>
              <dd className="tabular-nums">{money(cart.subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>{delivery ? "Доставка" : "Самовывоз"}</dt>
              <dd className="tabular-nums">
                {deliveryPrice > 0 ? money(deliveryPrice) : "бесплатно"}
              </dd>
            </div>
          </dl>
          {delivery && Number(cart.free_delivery_left) > 0 ? (
            <div className="mt-[18px]">
              <p id="free-delivery" className="text-[13px] text-ink-muted">
                До бесплатной доставки {money(cart.free_delivery_left)}
              </p>
              <div
                role="progressbar"
                aria-labelledby="free-delivery"
                aria-valuemin={0}
                aria-valuemax={Number(cart.free_delivery_from)}
                aria-valuenow={Number(cart.subtotal)}
                className="mt-2 h-[3px] bg-line"
              >
                <div
                  className="h-full bg-accent transition-[width] duration-300"
                  style={{
                    width: `${Math.min(100, (Number(cart.subtotal) / Number(cart.free_delivery_from)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ) : null}
          <div className="mt-[26px] flex items-baseline justify-between border-t border-line pt-[17px] text-ink">
            <span className="text-[20px] leading-7 font-semibold">Итого</span>
            <span className="text-[20px] leading-7 font-bold tabular-nums">{money(total)}</span>
          </div>
          <p className="mt-[16px] text-[14px] leading-[22px] text-ink-muted">
            {typograf(
              `Оплата после подтверждения. Мы свяжемся в течение 30 минут ${hoursText}, подтвердим состав, дату и сумму и назовём способы оплаты.`,
            )}
          </p>
          {delivery ? (
            <p className="mt-[12px] text-[14px] leading-[22px] text-ink-muted">
              {typograf(cart.delivery_note)}
            </p>
          ) : null}
          {formError ? (
            <p role="alert" className="mt-[16px] text-[14px] leading-5 text-accent">
              {formError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={!hydrated || submitting}
            className="mt-[24px] flex h-[52px] w-full items-center justify-center bg-accent text-[15px] font-medium text-canvas transition-colors duration-150 hover:bg-accent-pressed disabled:opacity-60"
          >
            {submitting ? "Отправляем…" : "Отправить заказ"}
          </button>
        </div>
      </aside>

      {/* Ниже 1024: «Ваш заказ» под формой, а итог и кнопка — липкой полосой внизу */}
      <FloatingActionBar className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-4 border-t border-line bg-canvas px-4 py-3 lg:hidden">
        <p className="text-[15px] text-ink">
          Итого <b className="tabular-nums">{money(total)}</b>
        </p>
        <button
          type="submit"
          disabled={!hydrated || submitting}
          className="h-12 bg-accent px-6 text-[15px] font-medium text-canvas disabled:opacity-60"
        >
          {submitting ? "Отправляем…" : "Отправить заказ"}
        </button>
      </FloatingActionBar>
    </form>
  );
}

function newKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function lowerFirst(text: string): string {
  return text ? text[0]!.toLowerCase() + text.slice(1) : text;
}

function Step({
  number,
  title,
  className = "",
  children,
}: {
  number: string;
  title: string;
  className?: string;
  children: ReactNode;
}) {
  const id = `step-${number}`;
  return (
    <section aria-labelledby={id} className={className}>
      <h2 id={id} className="flex items-baseline gap-[16px]">
        <span className="text-[14px] font-medium text-ink-subtle tabular-nums">{number}</span>
        <span className="font-display text-[32px] leading-10 text-ink">{title}</span>
      </h2>
      {children}
    </section>
  );
}

/** Даты 104×64: «Пт / 9 окт». Ниже 640 — лента с горизонтальной прокруткой. */
function RadioTiles({
  id,
  label,
  value,
  options,
  onChange,
  error,
  className = "",
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; top: string; bottom: string; disabled?: boolean }[];
  onChange: (value: string) => void;
  error?: string;
  className?: string;
}) {
  const labelId = `${id}-label`;
  return (
    <div className={className}>
      <p id={labelId} className="text-[14px] leading-5 text-ink-subtle">
        {label}
      </p>
      <RadioGroup
        id={id}
        labelId={labelId}
        error={error}
        value={value}
        options={options.map((option) => ({ ...option, label: `${option.top}, ${option.bottom}` }))}
        onChange={onChange}
        className="scrollbar-none mt-[13px] flex gap-2 max-sm:-mx-4 max-sm:overflow-x-auto max-sm:px-4 sm:flex-wrap"
        render={(option, selected) => {
          const tile = options.find((item) => item.value === option.value)!;
          return (
            <span
              className={`flex h-16 w-[104px] shrink-0 flex-col items-center justify-center border transition-colors duration-150 ${
                selected
                  ? "border-accent bg-accent text-canvas"
                  : option.disabled
                    ? "border-line text-ink-subtle/50"
                    : "border-line text-ink group-hover:border-accent"
              }`}
            >
              <span className="text-[15px] leading-5 font-medium">{tile.top}</span>
              {/* Имя кнопки — её текст: «Чт, 15 окт». Без запятой строки склеились бы
                  в «Чт15 окт» (Lighthouse: label-content-name-mismatch, 008a) */}
              <span className="sr-only">, </span>
              <span
                className={`text-[12px] leading-4 ${selected ? "text-canvas/80" : option.disabled ? "" : "text-ink-subtle"}`}
              >
                {tile.bottom}
              </span>
            </span>
          );
        }}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-[7px] text-[13px] leading-5 text-accent">
          {error}
        </p>
      ) : null}
    </div>
  );
}
