"use client";

/**
 * «Сколько нужно торта» (008b, кадр списка custom-cakes.png): гости → вес, ярусы,
 * ориентир «от X ₽».
 *
 * Формулы здесь нет: её единственный источник — `services/custom_cakes.py`, сюда
 * результат приходит из `GET /custom-cakes/estimate`. Первое значение считает
 * сервер при рендере страницы, поэтому ничего не мигает. Ввод — с задержкой 300 мс,
 * предыдущий запрос отменяется; ошибка API — строкой под полем, прошлый результат
 * остаётся на месте. Выбора оформления в кадре нет — расчёт по классическому, как
 * у «Своего дизайна» в заявке.
 */

import { useId, useState } from "react";
import { GuestsStepper, MAX_GUESTS } from "@/components/custom-cakes/guests-stepper";
import { formatKg as kg, useEstimate } from "@/components/custom-cakes/use-estimate";
import { LinkButton } from "@/components/ui";
import { formatPrice, type CakeEstimate } from "@/lib/api";
import { pluralRu, typograf } from "@/lib/format";

export function Calculator({
  initial,
  intro,
  note,
}: {
  initial: CakeEstimate;
  /** «Считаем около 150 г на гостя. Точный вес…» — граммы из настроек, текст из контента */
  intro: string;
  note: string | null;
}) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const [text, setText] = useState(String(initial.guests));
  const guests = Number.parseInt(text, 10);
  const valid = Number.isInteger(guests) && guests >= 1 && guests <= MAX_GUESTS;
  // Расчёт — общий хук (008c): тот же, что у страницы дизайна и окна заявки
  const { result: counted, error } = useEstimate({ guests: valid ? guests : null, initial });
  const result = counted ?? initial;
  const message = !valid ? "Гостей — от 1 до 1000" : error;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 bg-photo px-6 py-10 md:px-14 md:pt-[61px] md:pb-[52px] lg:grid-cols-[minmax(0,1fr)_576px] lg:gap-x-16">
      <div>
        <h2
          id="calculator-title"
          className="font-display text-[44px] leading-[1.1] text-ink max-sm:text-[34px]"
        >
          Сколько нужно торта
        </h2>
        <p className="mt-[20px] max-w-[540px] text-[17px] leading-7 text-ink-muted">
          {typograf(intro)}
        </p>
      </div>

      <div>
        <label htmlFor={inputId} className="block text-[14px] leading-5 text-ink-subtle">
          Гостей на празднике
        </label>
        <GuestsStepper
          id={inputId}
          value={text}
          onChange={setText}
          invalid={Boolean(message)}
          describedBy={message ? errorId : undefined}
          className="mt-[11px]"
        />
        {message ? (
          <p id={errorId} className="mt-[7px] text-[13px] leading-5 text-accent">
            {message}
          </p>
        ) : null}

        <dl
          aria-live="polite"
          className="mt-[28px] grid grid-cols-[minmax(0,175fr)_minmax(0,200fr)_minmax(0,200fr)] border-y border-line [&>div+div]:border-l [&>div+div]:border-line"
        >
          <div className="py-[18px] pr-4">
            <dt className="text-[13px] leading-5 text-ink-subtle">Вес</dt>
            <dd className="mt-[6px] font-display text-[26px] leading-8 text-ink max-sm:text-[19px]">
              {kg(result.weight_kg)}
            </dd>
          </div>
          <div className="py-[18px] pl-6 pr-4 max-sm:pl-3 max-sm:pr-2">
            <dt className="text-[13px] leading-5 text-ink-subtle">Ярусы</dt>
            <dd className="mt-[6px] font-display text-[26px] leading-8 text-ink max-sm:text-[19px]">
              {result.tiers} {pluralRu(result.tiers, ["ярус", "яруса", "ярусов"])}
            </dd>
          </div>
          <div className="py-[18px] pl-6 max-sm:pl-3">
            <dt className="text-[13px] leading-5 text-ink-subtle">Ориентир</dt>
            <dd className="mt-[6px] font-display text-[26px] leading-8 text-ink max-sm:text-[19px] sm:whitespace-nowrap">
              от {formatPrice(String(result.price_from))}
            </dd>
          </div>
        </dl>
        {note ? (
          <p className="mt-[19px] text-[13px] leading-5 text-ink-subtle">{typograf(note)}</p>
        ) : null}
        <LinkButton
          href={`/custom-cakes?request=1&guests=${result.guests}`}
          scroll={false}
          size="md-tight"
          className="mt-[25px] w-[294px] max-sm:w-full"
        >
          Оставить заявку с этим расчётом
        </LinkButton>
      </div>
    </div>
  );
}
