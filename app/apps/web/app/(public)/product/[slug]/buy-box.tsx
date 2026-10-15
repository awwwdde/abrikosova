"use client";

/**
 * Покупка на странице товара (макет 09.10, product-frames/f0-1 … f5-1, 006b): вес,
 * «Хватит на …», надпись на табличке, срок, цена, количество и «В корзину».
 *
 * - **Вес** — `radiogroup`, стрелки переключают. Выбранный вариант — в адресе
 *   (`?v=<id>`): по ссылке открывается тот же вес. Блок показан у тортов всегда
 *   (один вес — одна выбранная кнопка, «Три шоколада»), у остальных — при двух весах
 *   и больше (`showsWeightPicker`). У пирожного вес — строкой под составом.
 * - **Надпись** — чекбокс «+300 ₽» (цена из настроек); отмечен — плавно раскрывается
 *   поле и под ним «До 24 знаков». Отмечена, но пусто — «В корзину» показывает
 *   ошибку у поля, а не кладёт товар без надписи.
 * - **Срок** — цвет первой строки по состоянию: бордо — забрать сегодня/завтра,
 *   тёмный — под заказ, серый — закончилось сегодня. Закончилось — кнопка
 *   «Заказать на завтра», она кладёт товар в корзину (срок «завтра» считает бэкенд).
 * - **После добавления** — кнопка тёмная, под блоком доставки плашка «Медовик целый,
 *   1 кг в корзине · Оформить заказ». Сменили вес или надпись — это уже другая строка
 *   корзины: плашка пропадает, кнопка снова бордовая.
 * - **Цена** = вариант + надпись, `tabular-nums` — ширина не прыгает при смене веса.
 * - Ниже 640, пока цена ушла за экран, внизу липкая панель «цена + В корзину»
 *   (после добавления — плашка «в корзине»); пока вводят надпись, панели нет.
 */

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useCart } from "@/components/cart-context";
import { OptionRow, Price } from "@/components/ui";
import type { ProductDetail } from "@/lib/api";
import { typograf } from "@/lib/format";
import {
  INSCRIPTION_MAX,
  availabilityText,
  formatPeople,
  inscriptionError,
  pickVariant,
  unitPrice,
} from "@/lib/product-page";

const MAX_QUANTITY = 20;

const TONE = { accent: "text-accent", ink: "text-ink", muted: "text-ink-subtle" } as const;

/** Строка корзины: тот же вариант с другой надписью — уже другая строка. */
function lineKey(variantId: number, withInscription: boolean, text: string): string {
  return `${variantId}|${withInscription ? text.trim() : ""}`;
}

export function BuyBox({
  product,
  initialVariant,
  telegramUrl,
  showWeight,
  children,
}: {
  product: ProductDetail;
  initialVariant: number;
  telegramUrl: string | null;
  /** Блок «Вес» (`showsWeightPicker`) */
  showWeight: boolean;
  /** Строки «Самовывоз / Доставка» и «Вопрос по торту?» — плашка «в корзине» под ними */
  children?: ReactNode;
}) {
  const { addItem } = useCart();
  const [variantId, setVariantId] = useState(initialVariant);
  const [withInscription, setWithInscription] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<"idle" | "loading" | "failed">("idle");
  // Какая строка корзины добавлена с этой страницы: плашка «в корзине» — только для неё
  const [addedKey, setAddedKey] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [priceHidden, setPriceHidden] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const priceRow = useRef<HTMLDivElement>(null);
  const radios = useRef<(HTMLButtonElement | null)[]>([]);

  const variant = pickVariant(product.variants, String(variantId));
  const availability = availabilityText(product);
  const price = unitPrice(variant, product.inscription_price, withInscription);
  const people = formatPeople(variant.portions_min, variant.portions_max);
  const inscriptionPrice = Number(product.inscription_price);
  const inCart = addedKey !== null && addedKey === lineKey(variant.id, withInscription, text);
  // «Медовик целый, 1 кг в корзине»; у пирожного вес в названии не нужен
  const cartLine = `${product.name}${showWeight ? `, ${variant.label}` : ""} в корзине`;

  // Ниже 640 — липкая панель, пока строка с ценой выше экрана. По событию scroll,
  // а не IntersectionObserver: при прыжке прокрутки (якорь, быстрый флик) строка
  // проскакивает экран целиком, пересечения не случается и наблюдатель молчит
  useEffect(() => {
    const row = priceRow.current;
    if (!row) return;
    const update = () => setPriceHidden(row.getBoundingClientRect().bottom < 0);
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  function choose(id: number, focus = false) {
    setVariantId(id);
    // Вес — в адресе без перезагрузки и без лишнего запроса к серверу
    const url = new URL(window.location.href);
    if (id === product.variants[0]?.id) url.searchParams.delete("v");
    else url.searchParams.set("v", String(id));
    window.history.replaceState(window.history.state, "", url);
    if (focus) radios.current[product.variants.findIndex((item) => item.id === id)]?.focus();
  }

  function onRadioKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const count = product.variants.length;
    choose(product.variants[(index + step + count) % count]!.id, true);
  }

  async function add() {
    const problem = inscriptionError(withInscription, text);
    setError(problem);
    if (problem) {
      input.current?.focus();
      return;
    }
    setStatus("loading");
    try {
      await addItem(variant.id, quantity, withInscription ? text.trim() : undefined);
      setAddedKey(lineKey(variant.id, withInscription, text));
      setStatus("idle");
    } catch {
      setStatus("failed");
    }
  }

  const button = (className = "") => (
    <button
      type="button"
      onClick={add}
      disabled={!availability.orderable || status === "loading"}
      className={`inline-flex h-[52px] items-center justify-center px-[33px] text-[15px] font-medium whitespace-nowrap text-canvas transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45 ${
        // В корзине — тёмная (#1A1210): ещё раз нажать можно, это добавит количество
        inCart ? "bg-ink hover:bg-ink/85" : "bg-accent hover:bg-accent-pressed"
      } ${className}`}
    >
      {status === "loading" ? "Добавляем…" : availability.action}
    </button>
  );

  const checkout = (className = "") => (
    <Link
      href="/cart"
      className={`inline-flex h-[38px] shrink-0 items-center justify-center bg-on-accent px-[18px] text-[14px] font-medium whitespace-nowrap text-ink transition-colors duration-150 hover:bg-cream ${className}`}
    >
      Оформить заказ
    </Link>
  );

  return (
    <>
      {showWeight ? (
        <div className="mt-[37px]">
          <p id="weight-label" className="text-[13px] leading-none text-ink-subtle">
            Вес
          </p>
          <div
            role="radiogroup"
            aria-labelledby="weight-label"
            className="mt-[15px] flex flex-wrap gap-2"
          >
            {product.variants.map((item, index) => {
              const selected = item.id === variant.id;
              return (
                <button
                  key={item.id}
                  ref={(element) => {
                    radios.current[index] = element;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => choose(item.id)}
                  onKeyDown={(event) => onRadioKey(event, index)}
                  className={`h-[38px] min-w-24 border px-5 text-[13px] transition-colors duration-150 ${
                    selected
                      ? "border-accent bg-accent text-canvas"
                      : "border-line text-ink hover:border-accent"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {people ? (
        <p className={`text-sm text-ink-muted ${showWeight ? "mt-[13px]" : "mt-8"}`}>
          Хватит на <span className="ml-1 font-semibold text-ink">{typograf(people)}</span>
        </p>
      ) : null}

      {product.allows_inscription ? (
        <div className="mt-[30px]">
          <OptionRow
            type="checkbox"
            name="inscription"
            value="on"
            label="Надпись на шоколадной табличке"
            checked={withInscription}
            onChange={() => {
              const next = !withInscription;
              setWithInscription(next);
              setError(null);
              if (next) window.setTimeout(() => input.current?.focus(), 50);
            }}
            aside={`+${inscriptionPrice.toLocaleString("ru-RU")} ₽`}
          />
          <div
            className={`grid transition-[grid-template-rows] duration-300 ease-out-soft ${
              withInscription ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
            inert={!withInscription}
          >
            {/* Поле — под подписью чекбокса (отступ 20 + 12), как на макете */}
            <div className="min-h-0 overflow-hidden pl-8">
              <div className="pt-[2px] pb-1">
                <label htmlFor="inscription-text" className="sr-only">
                  Текст надписи на табличке
                </label>
                <input
                  ref={input}
                  id="inscription-text"
                  value={text}
                  maxLength={INSCRIPTION_MAX}
                  aria-invalid={error ? true : undefined}
                  aria-describedby="inscription-hint"
                  onChange={(event) => {
                    setText(event.target.value);
                    if (error) setError(null);
                  }}
                  onFocus={() => setTyping(true)}
                  onBlur={() => setTyping(false)}
                  className={`h-12 w-full border bg-surface px-[13px] text-[15px] text-ink focus:outline-none ${
                    error ? "border-accent" : "border-line focus:border-ink"
                  }`}
                />
                {error ? (
                  <p
                    id="inscription-hint"
                    role="alert"
                    className="mt-[9px] text-[13px] text-accent"
                  >
                    {error}
                  </p>
                ) : (
                  <p id="inscription-hint" className="mt-[9px] text-[13px] text-ink-subtle">
                    До {INSCRIPTION_MAX} знаков
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className={
          // Без веса и надписи (пирожное) срок идёт сразу под чертой шапки
          showWeight || people || product.allows_inscription
            ? "mt-[32px] border-t border-line pt-[34px]"
            : "pt-[34px]"
        }
      >
        <p className={`text-base leading-5 font-semibold ${TONE[availability.tone]}`}>
          {typograf(availability.title)}
        </p>
        {availability.detail ? (
          <p className="mt-[5px] text-sm text-ink-muted">{typograf(availability.detail)}</p>
        ) : null}
      </div>

      <div
        ref={priceRow}
        className="mt-[30px] flex flex-wrap items-center justify-between gap-4 max-sm:flex-col max-sm:items-stretch"
      >
        <Price
          value={String(price)}
          className="text-[32px] leading-none font-bold tracking-price text-ink tabular-nums"
        />
        <div className="flex items-center gap-4 max-sm:justify-between">
          <div className="flex h-[52px] w-[116px] items-center justify-between border border-line">
            <button
              type="button"
              aria-label="Меньше"
              disabled={quantity <= 1 || !availability.orderable}
              onClick={() => setQuantity((current) => Math.max(1, current - 1))}
              className="flex h-full w-10 items-center justify-center text-ink disabled:opacity-35"
            >
              −
            </button>
            <span aria-live="polite" className="tnum text-[15px] text-ink">
              <span className="sr-only">Количество: </span>
              {quantity}
            </span>
            <button
              type="button"
              aria-label="Больше"
              disabled={quantity >= MAX_QUANTITY || !availability.orderable}
              onClick={() => setQuantity((current) => Math.min(MAX_QUANTITY, current + 1))}
              className="flex h-full w-10 items-center justify-center text-ink disabled:opacity-35"
            >
              +
            </button>
          </div>
          {button("max-sm:flex-1")}
        </div>
      </div>
      {/* Ошибка добавления; удачное добавление объявляет плашка ниже */}
      <p aria-live="polite" className="min-h-0 text-right text-[13px] text-accent empty:hidden">
        {status === "failed" ? "Не удалось добавить, попробуйте ещё раз" : ""}
      </p>
      {!availability.orderable && telegramUrl ? (
        <p className="mt-2 text-right text-sm">
          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink underline underline-offset-4 hover:text-accent"
          >
            Написать Елене в Telegram
          </a>
        </p>
      ) : null}

      {children}

      {/* role="status": скринридер услышит «… в корзине» сразу после нажатия */}
      <div role="status" className="max-sm:hidden">
        {inCart ? (
          <div className="mt-[30px] inline-flex items-center gap-[25px] bg-ink py-[15px] pr-[15px] pl-[22px]">
            <span className="text-[15px] text-canvas">{typograf(cartLine)}</span>
            {checkout()}
          </div>
        ) : null}
      </div>

      {/* Липкая панель на телефоне: цена ушла за экран, а клавиатура не открыта.
          После добавления — плашка «в корзине» вместо цены */}
      {(priceHidden || inCart) && !typing && availability.orderable ? (
        <div
          className={`fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-4 border-t px-4 py-3 sm:hidden ${
            inCart ? "border-ink bg-ink" : "border-line bg-canvas"
          }`}
        >
          {inCart ? (
            <>
              <span className="min-w-0 text-sm text-canvas">{typograf(cartLine)}</span>
              {checkout()}
            </>
          ) : (
            <>
              <Price value={String(price)} className="text-xl font-bold text-ink tabular-nums" />
              {button("flex-1")}
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
