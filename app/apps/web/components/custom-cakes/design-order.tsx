"use client";

/**
 * Правая колонка страницы дизайна (008c, кадр «страница дизайна»): гости со
 * степпером (не меньше минимума дизайна), вес и ярусы, начинка, срок, ориентир
 * «от X ₽» и «Оставить заявку».
 *
 * Расчёт — общий `useEstimate` (`GET /custom-cakes/estimate?guests=&design=`), первое
 * значение посчитал сервер. «Оставить заявку» — ссылка на окно заявки этой же
 * страницы: `?request=1&design=<slug>&guests=N&filling=<id>`; состояние окна живёт
 * в адресе, без JS это обычная ссылка с минимумом гостей.
 */

import Link from "@/components/page-transition";
import { useId, useState } from "react";
import { GuestsStepper, MAX_GUESTS } from "@/components/custom-cakes/guests-stepper";
import { formatKg, useEstimate } from "@/components/custom-cakes/use-estimate";
import { buttonClass } from "@/components/ui";
import { formatPrice, type CakeFilling, type CustomCakeDetail } from "@/lib/api";
import { pluralRu, typograf } from "@/lib/format";
import { formatDayMonth } from "@/lib/product-page";

export function requestHref(
  slug: string,
  guests: number,
  filling: string,
  base = `/custom-cakes/${slug}`,
): string {
  const query = new URLSearchParams({ request: "1", design: slug, guests: String(guests) });
  if (filling) query.set("filling", filling);
  return `${base}?${query}`;
}

export function DesignOrder({
  design,
  fillings,
}: {
  design: CustomCakeDetail;
  fillings: CakeFilling[];
}) {
  const guestsId = useId();
  const fillingId = useId();
  const hintId = `${guestsId}-hint`;
  const [text, setText] = useState(String(design.min_guests));
  const [filling, setFilling] = useState("");
  const guests = Number.parseInt(text, 10);
  const valid = Number.isInteger(guests) && guests >= design.min_guests && guests <= MAX_GUESTS;
  const { result: counted, error } = useEstimate({
    guests: valid ? guests : null,
    design: design.slug,
    initial: design.estimate,
  });
  const result = counted ?? design.estimate;
  const message = !valid
    ? `Для этого дизайна — от ${design.min_guests} ${pluralRu(design.min_guests, ["гостя", "гостей", "гостей"])}`
    : error;

  return (
    <>
      <label htmlFor={guestsId} className="mt-[33px] block text-[14px] leading-5 text-ink-subtle">
        Гостей
      </label>
      <GuestsStepper
        id={guestsId}
        value={text}
        onChange={setText}
        min={design.min_guests}
        invalid={Boolean(message)}
        describedBy={hintId}
        className="mt-[13px]"
      />
      <p id={hintId} aria-live="polite" className="mt-[19px] text-[15px] leading-5 text-ink-muted">
        {message ? (
          <span className="text-accent">{message}</span>
        ) : (
          <>
            Вес <b className="font-semibold text-ink">{formatKg(result.weight_kg)}</b> ·{" "}
            {result.tiers} {pluralRu(result.tiers, ["ярус", "яруса", "ярусов"])} · минимум для этого
            дизайна {design.min_guests} {pluralRu(design.min_guests, ["гость", "гостя", "гостей"])}
          </>
        )}
      </p>

      <label htmlFor={fillingId} className="mt-[33px] block text-[14px] leading-5 text-ink-subtle">
        Начинка
      </label>
      <div className="relative mt-[11px] max-w-[420px]">
        <select
          id={fillingId}
          value={filling}
          onChange={(event) => setFilling(event.target.value)}
          className="h-12 w-full appearance-none border border-line bg-white pr-10 pl-[13px] text-[15px] text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          <option value="">Помогите выбрать</option>
          {fillings.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 12 8"
          className="pointer-events-none absolute top-1/2 right-[15px] h-2 w-3 -translate-y-1/2 text-ink"
        >
          <path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </div>

      <hr className="mt-[32px] border-line" />
      <p className="mt-[35px] text-[15px] leading-5 font-semibold text-ink">
        Под заказ от {design.lead_days} {pluralRu(design.lead_days, ["дня", "дней", "дней"])}
      </p>
      <p className="mt-[4px] text-[15px] leading-5 text-ink-muted">
        ближайшая дата {formatDayMonth(design.earliest_date)}
      </p>

      <div className="mt-[37px] flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-[32px] leading-9 font-semibold text-ink tabular-nums">
            от {formatPrice(result.price_from)}
          </p>
          <p className="mt-[2px] text-[13px] leading-5 text-ink-subtle">
            {typograf("ориентир, итог назовём после заявки")}
          </p>
        </div>
        <Link
          href={requestHref(design.slug, valid ? guests : design.min_guests, filling)}
          scroll={false}
          className={buttonClass({ size: "md-tight", className: "w-[170px]" })}
        >
          Оставить заявку
        </Link>
      </div>
    </>
  );
}
