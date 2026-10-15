"use client";

/**
 * «Настройки» (011c, только владелец): пороги «крупного» заказа и события.
 * Главная по ним ставит пометку «крупный» у дня и выбирает события для календаря.
 * С 005a — цена надписи на шоколадной табличке: одна на весь сайт, её видят
 * покупатели на странице товара («+300 ₽»).
 * С 007a — доставка: цена, порог бесплатной, текст под «Доставка» в корзине, окна
 * курьера и часы, когда отвечаем на заказы («пришёл ночью — позвоним утром»).
 * С 008a — «Торты на заказ»: цены за кг, минимальный вес, срок, ярусы, дополнения
 * (components/admin/settings/cake-settings.tsx).
 *
 * Сохранение отправляет настройки целиком: чего нет в запросе, бэкенд взял бы
 * по умолчанию, и правка одного поля сбрасывала бы остальные.
 * Проверку «целое больше нуля» делает и форма, и бэкенд (422) — форма лишь
 * подсказывает раньше.
 */

import { GearSix, Truck } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import { CakeSettings, type CakeSettingsHandle } from "@/components/admin/settings/cake-settings";
import { useAdminData } from "@/components/admin/use-admin-data";
import {
  Button,
  Card,
  CardHeader,
  ChipToggle,
  Field,
  Input,
  Notice,
  Skeleton,
  Textarea,
  useToast,
} from "@/components/admin/ui";
import { intervalLabel } from "@/lib/admin-dashboard";
import { ApiError, type BakerySettings as Settings } from "@/lib/api";
import { typograf } from "@/lib/format";

type Interval = Settings["delivery_intervals"][number];
const ALL_INTERVALS: Interval[] = ["09-12", "12-15", "15-18", "18-21"];

/** Целое число от нуля: надпись может быть и бесплатной. */
function parseNonNegative(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  return Number(value);
}

function parsePositive(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const number = Number(value);
  return number > 0 ? number : null;
}

type Errors = Partial<
  Record<
    | "total"
    | "guests"
    | "inscription"
    | "cutoff"
    | "deliveryPrice"
    | "freeFrom"
    | "note"
    | "intervals"
    | "hours"
    | "form",
    string
  >
>;

export default function AdminSettingsPage() {
  const { authFetch } = useAdminAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useAdminData<Settings>("/admin/settings");
  const [total, setTotal] = useState("");
  const [guests, setGuests] = useState("");
  const [inscription, setInscription] = useState("");
  const [cutoff, setCutoff] = useState("");
  const [deliveryPrice, setDeliveryPrice] = useState("");
  const [freeFrom, setFreeFrom] = useState("");
  const [note, setNote] = useState("");
  const [intervals, setIntervals] = useState<Interval[]>([]);
  const [hoursFrom, setHoursFrom] = useState("");
  const [hoursTo, setHoursTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const cakes = useRef<CakeSettingsHandle>(null);

  useEffect(() => {
    if (!data) return;
    setTotal(String(data.large_order_total));
    setGuests(String(data.large_event_guests));
    setInscription(String(data.inscription_price));
    setCutoff(String(data.slot_cutoff_minutes));
    setDeliveryPrice(String(data.delivery_price));
    setFreeFrom(String(data.free_delivery_from));
    setNote(data.delivery_note);
    setIntervals(data.delivery_intervals);
    setHoursFrom(String(data.work_hours_start));
    setHoursTo(String(data.work_hours_end));
  }, [data]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const largeOrder = parsePositive(total);
    const largeEvent = parsePositive(guests);
    const inscriptionPrice = parseNonNegative(inscription);
    const cutoffMinutes = parseNonNegative(cutoff);
    const cutoffOk = cutoffMinutes !== null && cutoffMinutes <= 240;
    const delivery = parseNonNegative(deliveryPrice);
    const free = parseNonNegative(freeFrom);
    const start = parseNonNegative(hoursFrom);
    const end = parseNonNegative(hoursTo);
    const hoursOk = start !== null && end !== null && start < end && end <= 24;
    const next: Errors = {
      total: largeOrder ? undefined : "Целое число рублей больше нуля",
      guests: largeEvent ? undefined : "Целое число гостей больше нуля",
      inscription: inscriptionPrice === null ? "Целое число рублей, 0 — бесплатно" : undefined,
      cutoff: cutoffOk ? undefined : "Целое число минут от 0 до 240",
      deliveryPrice: delivery === null ? "Целое число рублей, 0 — бесплатно" : undefined,
      freeFrom: free === null ? "Целое число рублей" : undefined,
      note: note.trim() ? undefined : "Напишите, куда возите и что за МКАД",
      intervals: intervals.length ? undefined : "Отметьте хотя бы одно окно",
      hours: hoursOk ? undefined : "Часы от 0 до 24, начало раньше конца",
    };
    setErrors(next);
    const cakeValues = cakes.current?.collect() ?? null;
    if (Object.values(next).some(Boolean) || !data || !cakeValues) return;
    setSaving(true);
    try {
      await authFetch("/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          ...data,
          large_order_total: largeOrder,
          large_event_guests: largeEvent,
          inscription_price: inscriptionPrice,
          slot_cutoff_minutes: cutoffMinutes,
          delivery_price: delivery,
          free_delivery_from: free,
          delivery_note: note.trim(),
          delivery_intervals: intervals,
          work_hours_start: start,
          work_hours_end: end,
          ...cakeValues,
        }),
      });
      toast.success("Настройки сохранены. Сайт и главная учтут их в течение минуты");
      await reload();
    } catch (err) {
      setErrors({ form: err instanceof ApiError ? err.message : "Не удалось сохранить" });
    } finally {
      setSaving(false);
    }
  }

  const skeleton = (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
    </div>
  );

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-[34px] leading-[1.05] font-normal adm-sm:text-[42px]">
          Настройки
        </h1>
        <p className="text-[15px] text-admin-muted">
          {typograf(
            "Что главная считает крупным заказом и событием, сколько стоят надпись, доставка и торты на заказ, когда закрывается окно выдачи",
          )}
        </p>
      </div>

      {error ? (
        <Notice
          role="alert"
          action={
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              Повторить
            </Button>
          }
        >
          {error}
        </Notice>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <Card aria-labelledby="limits-title" className="flex max-w-xl flex-col gap-5">
            <CardHeader
              id="limits-title"
              title={
                <span className="inline-flex items-center gap-2">
                  <GearSix aria-hidden="true" size={20} className="text-admin-side" />
                  Заказы, надпись и выдача
                </span>
              }
            />
            {loading && !data ? (
              skeleton
            ) : (
              <div className="flex flex-col gap-4">
                <Field
                  label="Крупный заказ: от какой суммы"
                  hint={typograf(
                    "Такие дни отмечаются «крупный» в блоке «Заказы по дням», заказы попадают в календарь",
                  )}
                  error={errors.total}
                >
                  {(a11y) => (
                    <Input
                      {...a11y}
                      inputMode="numeric"
                      value={total}
                      onChange={(event) => setTotal(event.target.value)}
                      suffix="₽"
                      required
                    />
                  )}
                </Field>
                <Field
                  label="Крупное событие: от скольких гостей"
                  hint={typograf(
                    "Заявки на столько гостей и больше показываются в календаре заказов",
                  )}
                  error={errors.guests}
                >
                  {(a11y) => (
                    <Input
                      {...a11y}
                      inputMode="numeric"
                      value={guests}
                      onChange={(event) => setGuests(event.target.value)}
                      suffix="гостей"
                      required
                    />
                  )}
                </Field>
                <Field
                  label="Цена надписи на табличке, ₽"
                  hint={typograf(
                    "Одна на весь сайт. Покупатель видит «+300 ₽» у товаров, где надпись можно заказать",
                  )}
                  error={errors.inscription}
                >
                  {(a11y) => (
                    <Input
                      {...a11y}
                      inputMode="numeric"
                      value={inscription}
                      onChange={(event) => setInscription(event.target.value)}
                      suffix="₽"
                      required
                    />
                  )}
                </Field>
                <Field
                  label="Закрывать окно выдачи за N минут до начала"
                  hint={typograf(
                    "Сколько нужно, чтобы собрать заказ и доехать. При 60 минутах в 14:00 окно 15:00–18:00 на сегодня уже не выбрать",
                  )}
                  error={errors.cutoff}
                >
                  {(a11y) => (
                    <Input
                      {...a11y}
                      inputMode="numeric"
                      value={cutoff}
                      onChange={(event) => setCutoff(event.target.value)}
                      suffix="мин"
                      required
                    />
                  )}
                </Field>
              </div>
            )}
          </Card>

          <Card aria-labelledby="delivery-title" className="flex max-w-xl flex-col gap-5">
            <CardHeader
              id="delivery-title"
              title={
                <span className="inline-flex items-center gap-2">
                  <Truck aria-hidden="true" size={20} className="text-admin-side" />
                  Доставка
                </span>
              }
            />
            {loading && !data ? (
              skeleton
            ) : (
              <div className="flex flex-col gap-4">
                <div className="grid gap-4 adm-sm:grid-cols-2">
                  <Field
                    label="Цена доставки"
                    hint="По Москве в пределах МКАД"
                    error={errors.deliveryPrice}
                  >
                    {(a11y) => (
                      <Input
                        {...a11y}
                        inputMode="numeric"
                        value={deliveryPrice}
                        onChange={(event) => setDeliveryPrice(event.target.value)}
                        suffix="₽"
                        required
                      />
                    )}
                  </Field>
                  <Field
                    label="Бесплатно от суммы"
                    hint="Сумма позиций без доставки"
                    error={errors.freeFrom}
                  >
                    {(a11y) => (
                      <Input
                        {...a11y}
                        inputMode="numeric"
                        value={freeFrom}
                        onChange={(event) => setFreeFrom(event.target.value)}
                        suffix="₽"
                        required
                      />
                    )}
                  </Field>
                </div>
                <Field
                  label="Текст под «Доставка» в корзине"
                  hint="Покупатель видит его, когда выбирает доставку"
                  error={errors.note}
                >
                  {(a11y) => (
                    <Textarea
                      {...a11y}
                      rows={3}
                      maxLength={300}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                    />
                  )}
                </Field>
                <fieldset>
                  <legend className="mb-2.5 text-[13.5px] font-bold">Окна доставки</legend>
                  <div className="flex flex-wrap gap-2">
                    {ALL_INTERVALS.map((interval) => {
                      const on = intervals.includes(interval);
                      return (
                        <ChipToggle
                          key={interval}
                          pressed={on}
                          className="h-[38px]"
                          onChange={(value) =>
                            setIntervals((current) =>
                              ALL_INTERVALS.filter((item) =>
                                item === interval ? value : current.includes(item),
                              ),
                            )
                          }
                        >
                          <span aria-hidden="true">{on ? "✓" : "+"}</span>
                          {intervalLabel(interval)}
                        </ChipToggle>
                      );
                    })}
                  </div>
                  <p
                    className={`mt-2 text-[12.5px] ${errors.intervals ? "text-admin-side" : "text-admin-muted"}`}
                  >
                    {errors.intervals ?? "У самовывоза — все четыре окна"}
                  </p>
                </fieldset>
                <div className="grid gap-4 adm-sm:grid-cols-2">
                  <Field label="Отвечаем на заказы с" error={errors.hours}>
                    {(a11y) => (
                      <Input
                        {...a11y}
                        inputMode="numeric"
                        value={hoursFrom}
                        onChange={(event) => setHoursFrom(event.target.value)}
                        suffix="ч"
                        required
                      />
                    )}
                  </Field>
                  <Field label="до" hint="Заказ вне этих часов — «свяжемся утром»">
                    {(a11y) => (
                      <Input
                        {...a11y}
                        inputMode="numeric"
                        value={hoursTo}
                        onChange={(event) => setHoursTo(event.target.value)}
                        suffix="ч"
                        required
                      />
                    )}
                  </Field>
                </div>
              </div>
            )}
          </Card>

          <CakeSettings ref={cakes} data={data ?? null} loading={loading} />

          {errors.form ? <Notice role="alert">{errors.form}</Notice> : null}
          <div>
            <Button type="submit" loading={saving} disabled={!data}>
              Сохранить
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
