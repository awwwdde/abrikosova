"use client";

/**
 * «Настройки → Торты на заказ» (008a): цены за кг по оформлению, минимальный вес,
 * срок, граммы на гостя, ярусы калькулятора и дополнения окна заявки. Из этих
 * цифр сервер считает «от X ₽» у каждого дизайна и ориентир в заявке.
 *
 * Своё состояние и проверка; общий «Сохранить» страницы забирает значения через
 * `collect()` — так настройки по-прежнему уходят одним PUT целиком.
 */

import { Cake, Plus, X } from "@phosphor-icons/react";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import {
  Card,
  CardHeader,
  ChipToggle,
  Field,
  IconButton,
  Input,
  Skeleton,
} from "@/components/admin/ui";
import type { BakerySettings } from "@/lib/api";
import { typograf } from "@/lib/format";

type CakeFields = Pick<
  BakerySettings,
  | "cake_price_classic"
  | "cake_price_cream_drawing"
  | "cake_price_multi_tier"
  | "cake_min_weight_kg"
  | "cake_lead_days"
  | "cake_grams_per_guest"
  | "cake_tiers"
  | "cake_extras"
>;

export type CakeSettingsHandle = {
  /** Значения для PUT или null, если в разделе есть ошибки (они уже показаны). */
  collect: () => CakeFields | null;
};

type Row = { a: string; b: string; from?: boolean };

const PRICES = [
  {
    key: "cake_price_classic",
    label: "Классическое оформление",
    hint: "Крем, свежие ягоды, шоколадный декор",
  },
  {
    key: "cake_price_cream_drawing",
    label: "Рисунок кремом",
    hint: "Рисунок, надпись, цветы из крема",
  },
  {
    key: "cake_price_multi_tier",
    label: "Многоярусный",
    hint: "Два яруса и больше, опоры, сборка",
  },
] as const;

const int = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value) : null);
const kg = (value: string) => {
  const number = Number(value.trim().replace(",", "."));
  return value.trim() && Number.isFinite(number) && (number * 2) % 1 === 0 ? number : null;
};
const kgText = (value: number) => String(value).replace(".", ",");

export const CakeSettings = forwardRef<
  CakeSettingsHandle,
  { data: BakerySettings | null; loading: boolean }
>(function CakeSettings({ data, loading }, ref) {
  const [prices, setPrices] = useState<Record<(typeof PRICES)[number]["key"], string>>({
    cake_price_classic: "",
    cake_price_cream_drawing: "",
    cake_price_multi_tier: "",
  });
  const [minWeight, setMinWeight] = useState("");
  const [leadDays, setLeadDays] = useState("");
  const [grams, setGrams] = useState("");
  const [tiers, setTiers] = useState<Row[]>([]);
  const [extras, setExtras] = useState<Row[]>([]);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    if (!data) return;
    setPrices({
      cake_price_classic: String(data.cake_price_classic),
      cake_price_cream_drawing: String(data.cake_price_cream_drawing),
      cake_price_multi_tier: String(data.cake_price_multi_tier),
    });
    setMinWeight(kgText(data.cake_min_weight_kg ?? 2));
    setLeadDays(String(data.cake_lead_days));
    setGrams(String(data.cake_grams_per_guest));
    setTiers(
      (data.cake_tiers ?? []).map((step) => ({ a: kgText(step.from_kg), b: String(step.tiers) })),
    );
    setExtras(
      (data.cake_extras ?? []).map((extra) => ({
        a: extra.name,
        b: String(extra.price),
        from: extra.price_from ?? false,
      })),
    );
  }, [data]);

  useImperativeHandle(ref, () => ({
    collect() {
      const next: Record<string, string | undefined> = {};
      const parsedPrices = Object.fromEntries(
        PRICES.map(({ key }) => {
          const value = int(prices[key]);
          if (!value) next[key] = "Целое число рублей больше нуля";
          return [key, value];
        }),
      );
      const weight = kg(minWeight);
      if (!weight) next.minWeight = "Шаг 0,5 кг: 2 или 2,5";
      const days = int(leadDays);
      if (!days || days > 90) next.leadDays = "Целое число дней от 1 до 90";
      const perGuest = int(grams);
      if (!perGuest || perGuest < 50 || perGuest > 1000) next.grams = "От 50 до 1000 г";
      const steps = tiers.map((row) => ({ from_kg: kg(row.a), tiers: int(row.b) }));
      const tiersOk =
        steps.length > 0 &&
        steps.every((step) => step.from_kg !== null && step.tiers && step.tiers <= 10) &&
        steps.some((step) => step.from_kg === 0) &&
        new Set(steps.map((step) => step.from_kg)).size === steps.length;
      if (!tiersOk)
        next.tiers = "Первая строка — от 0 кг, вес с шагом 0,5 без повторов, ярусов от 1 до 10";
      const items = extras.map((row) => ({
        name: row.a.trim(),
        price: int(row.b),
        price_from: Boolean(row.from),
      }));
      if (items.some((item) => !item.name || item.price === null))
        next.extras = "У каждого дополнения — название и целая цена";
      setErrors(next);
      if (Object.values(next).some(Boolean)) return null;
      return {
        ...(parsedPrices as Record<(typeof PRICES)[number]["key"], number>),
        cake_min_weight_kg: weight as number,
        cake_lead_days: days as number,
        cake_grams_per_guest: perGuest as number,
        cake_tiers: steps
          .map((step) => ({ from_kg: step.from_kg as number, tiers: step.tiers as number }))
          .sort((x, y) => x.from_kg - y.from_kg),
        cake_extras: items.map((item) => ({ ...item, price: item.price as number })),
      };
    },
  }));

  const table = (
    rows: Row[],
    setRows: (rows: Row[]) => void,
    labels: { a: string; b: string; bSuffix: string; aSuffix?: string; from?: boolean },
  ) => (
    <ul className="flex flex-col gap-2">
      {rows.map((row, index) => (
        <li key={index} className="flex items-center gap-2">
          <Input
            aria-label={`${labels.a}, строка ${index + 1}`}
            value={row.a}
            inputMode={labels.aSuffix ? "decimal" : undefined}
            suffix={labels.aSuffix}
            onChange={(event) =>
              setRows(
                rows.map((item, i) => (i === index ? { ...item, a: event.target.value } : item)),
              )
            }
          />
          <Input
            aria-label={`${labels.b}, строка ${index + 1}`}
            value={row.b}
            inputMode="numeric"
            suffix={labels.bSuffix}
            className="w-32 shrink-0"
            onChange={(event) =>
              setRows(
                rows.map((item, i) => (i === index ? { ...item, b: event.target.value } : item)),
              )
            }
          />
          {labels.from ? (
            <ChipToggle
              pressed={Boolean(row.from)}
              aria-label={`Цена «от», строка ${index + 1}`}
              onChange={(on) =>
                setRows(rows.map((item, i) => (i === index ? { ...item, from: on } : item)))
              }
            >
              от
            </ChipToggle>
          ) : null}
          <IconButton
            label={`Убрать строку ${index + 1}`}
            size="sm"
            onClick={() => setRows(rows.filter((_, i) => i !== index))}
          >
            <X size={14} />
          </IconButton>
        </li>
      ))}
    </ul>
  );

  return (
    <Card aria-labelledby="cakes-title" className="flex max-w-xl flex-col gap-5">
      <CardHeader
        id="cakes-title"
        title={
          <span className="inline-flex items-center gap-2">
            <Cake aria-hidden="true" size={20} className="text-admin-side" />
            Торты на заказ
          </span>
        }
      />
      {loading && !data ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-admin-muted">
            {typograf(
              "Из этих цифр сайт считает «от X ₽» у каждого дизайна: гости × граммы на гостя, вверх до 0,5 кг, не меньше минимального веса, × цена за кг оформления",
            )}
          </p>
          {PRICES.map(({ key, label, hint }) => (
            <Field key={key} label={`${label}, за кг`} hint={hint} error={errors[key]}>
              {(a11y) => (
                <Input
                  {...a11y}
                  inputMode="numeric"
                  value={prices[key]}
                  onChange={(event) => setPrices({ ...prices, [key]: event.target.value })}
                  suffix="₽/кг"
                />
              )}
            </Field>
          ))}
          <div className="grid gap-4 adm-sm:grid-cols-3">
            <Field label="Минимальный вес" error={errors.minWeight}>
              {(a11y) => (
                <Input
                  {...a11y}
                  inputMode="decimal"
                  value={minWeight}
                  onChange={(event) => setMinWeight(event.target.value)}
                  suffix="кг"
                />
              )}
            </Field>
            <Field label="Срок, от" error={errors.leadDays}>
              {(a11y) => (
                <Input
                  {...a11y}
                  inputMode="numeric"
                  value={leadDays}
                  onChange={(event) => setLeadDays(event.target.value)}
                  suffix="дней"
                />
              )}
            </Field>
            <Field label="На гостя" error={errors.grams}>
              {(a11y) => (
                <Input
                  {...a11y}
                  inputMode="numeric"
                  value={grams}
                  onChange={(event) => setGrams(event.target.value)}
                  suffix="г"
                />
              )}
            </Field>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-[13.5px] font-bold">Ярусы по весу</legend>
            <p className="text-[12.5px] text-admin-muted">
              {typograf(
                "«От 6 кг — 3 яруса». Калькулятор берёт последнюю строку, до которой дотягивает вес",
              )}
            </p>
            {table(tiers, setTiers, { a: "От, кг", aSuffix: "кг", b: "Ярусов", bSuffix: "яр." })}
            <button
              type="button"
              onClick={() => setTiers([...tiers, { a: "", b: "" }])}
              className="inline-flex items-center gap-1.5 self-start text-[13.5px] font-bold text-admin-side"
            >
              <Plus aria-hidden="true" size={15} /> Строка
            </button>
            {errors.tiers ? (
              <p role="alert" className="text-[12.5px] text-admin-side">
                {errors.tiers}
              </p>
            ) : null}
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-[13.5px] font-bold">Дополнения в заявке</legend>
            <p className="text-[12.5px] text-admin-muted">
              {typograf(
                "Свечи, топпер, открытка — в окне заявки галочками. «от» — цена зависит от выбора",
              )}
            </p>
            {table(extras, setExtras, { a: "Название", b: "Цена", bSuffix: "₽", from: true })}
            <button
              type="button"
              onClick={() => setExtras([...extras, { a: "", b: "", from: false }])}
              className="inline-flex items-center gap-1.5 self-start text-[13.5px] font-bold text-admin-side"
            >
              <Plus aria-hidden="true" size={15} /> Дополнение
            </button>
            {errors.extras ? (
              <p role="alert" className="text-[12.5px] text-admin-side">
                {errors.extras}
              </p>
            ) : null}
          </fieldset>
        </div>
      )}
    </Card>
  );
});
