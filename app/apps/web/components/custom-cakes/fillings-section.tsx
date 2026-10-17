"use client";

/**
 * «Начинки» страницы «Торты на заказ» (008b, кадр списка): сетка 4 колонки,
 * плашка «Дегустационный сет» в последней ячейке второго ряда, «Показать все начинки».
 *
 * Все начинки сервер кладёт в разметку сразу: без JS видно всё, а кнопки нет.
 * С JS (класс `html.js` ставит загрузочный скрипт) остальные свёрнуты в строку
 * сетки нулевой высоты; кнопка раскрывает их на месте плавно (без анимации при
 * prefers-reduced-motion) и переводит фокус на первую новую карточку.
 *
 * «Заказать сет» кладёт товар сета в корзину; если он уже там — кнопка
 * «В корзине» ведёт в корзину, как плашка на странице товара.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/cart-context";
import { FillingCard } from "@/components/filling-card";
import { RevealGroup } from "@/components/motion";
import { Button, buttonClass } from "@/components/ui";
import { ApiError, formatPrice, type CakeFilling, type CustomCakesInfo } from "@/lib/api";
import { typograf } from "@/lib/format";

type TastingSet = NonNullable<CustomCakesInfo["tasting_set"]>;

const GRID = "grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-y-[42px]";

function TastingSetCard({ set }: { set: TastingSet }) {
  const { cart, addItem } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inCart = cart?.items.some((item) => item.variant_id === set.variant_id) ?? false;

  async function add() {
    setBusy(true);
    setError(null);
    try {
      await addItem(set.variant_id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось добавить сет");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="tasting-set-title"
      className="flex aspect-square flex-col bg-accent-pressed p-7 text-canvas max-lg:aspect-auto max-lg:min-h-[336px]"
    >
      <h3 id="tasting-set-title" className="font-display text-[26px] leading-8">
        {typograf(set.name)}
      </h3>
      <p className="mt-[14px] text-[14px] leading-[22px] text-canvas/75">{set.description}</p>
      <p className="mt-auto text-[18px] leading-6 font-medium tabular-nums">
        {formatPrice(set.price)}
      </p>
      {inCart ? (
        <Link
          href="/cart"
          className={buttonClass({
            variant: "outline-on-accent",
            size: "sm",
            className: "mt-[13px] h-11 w-fit px-[18px]",
          })}
        >
          В корзине
        </Link>
      ) : (
        <Button
          variant="outline-on-accent"
          size="sm"
          disabled={busy}
          onClick={() => void add()}
          className="mt-[13px] h-11 w-fit px-[18px]"
        >
          Заказать сет
        </Button>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-[13px] text-canvas">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export function FillingsSection({
  fillings,
  tastingSet,
}: {
  /** Все доступные начинки по порядку (`GET /custom-cakes/fillings`) */
  fillings: CakeFilling[];
  tastingSet: TastingSet | null;
}) {
  // Первый экран блока — два ряда по четыре: с сетом 7 начинок + сет, без — 8
  const visible = tastingSet ? 7 : 8;
  const first = fillings.slice(0, visible);
  const rest = fillings.slice(visible);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const firstNew = useRef<HTMLLIElement>(null);
  const firstMobileNew = useRef<HTMLLIElement>(null);

  useEffect(() => setHydrated(true), []);

  function expand() {
    setOpen(true);
    // Фокус — после того, как строка раскрылась и стала доступной
    window.requestAnimationFrame(() => {
      const target =
        tastingSet && window.matchMedia("(max-width: 639px)").matches
          ? firstMobileNew.current
          : firstNew.current;
      target?.focus({ preventScroll: true });
    });
  }

  return (
    <>
      <RevealGroup
        as="ul"
        data-mobile-fillings-limit={tastingSet && rest.length > 0 ? 6 : 8}
        data-fillings-expanded={open}
        className={`mt-10 lg:mt-[47px] ${GRID}`}
      >
        {first.map((filling, index) => (
          <li
            key={filling.id}
            ref={index === 6 ? firstMobileNew : undefined}
            tabIndex={index === 6 ? -1 : undefined}
            className="outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            <FillingCard filling={filling} priority={index < 4} />
          </li>
        ))}
        {tastingSet ? (
          <li>
            <TastingSetCard set={tastingSet} />
          </li>
        ) : null}
      </RevealGroup>

      {rest.length > 0 ? (
        <>
          <div
            className={`grid transition-[grid-template-rows] duration-500 ease-out-soft motion-reduce:transition-none ${
              open ? "grid-rows-[1fr]" : "[.js_&]:grid-rows-[0fr]"
            }`}
          >
            <div className="overflow-hidden">
              <ul
                aria-label="Остальные начинки"
                inert={hydrated && !open ? true : undefined}
                className={`pt-10 lg:pt-[42px] ${GRID}`}
              >
                {rest.map((filling, index) => (
                  <li
                    key={filling.id}
                    ref={index === 0 ? firstNew : undefined}
                    tabIndex={index === 0 ? -1 : undefined}
                    className="outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                  >
                    <FillingCard filling={filling} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {open ? null : (
            // Только с JS: без него все начинки уже видны. Обёртка, а не класс кнопки:
            // базовый inline-flex кнопки перебил бы hidden
            <div className="mt-[39px] hidden [.js_&]:block">
              <Button
                variant="outline"
                size="md-tight"
                onClick={expand}
                aria-expanded={false}
                className="w-[218px]"
              >
                Показать все начинки
              </Button>
            </div>
          )}
        </>
      ) : null}
    </>
  );
}
