"use client";

/**
 * «Таблетки» подразделов (005b) с «Ещё ⌄» (006b, кадр catalog.png (120, 10896)).
 *
 * С 1024: если «таблетки» не помещаются в строку, последние уходят в выпадающий
 * список под кнопкой «Ещё». Выбран подраздел из списка — кнопка показывает его
 * название бордовой заливкой со стрелкой. Ниже 1024 — горизонтальная прокрутка,
 * как раньше: на телефоне «Ещё» только мешало бы.
 *
 * Без мигания: сервер рисует все «таблетки» (без JS — обычная прокручиваемая
 * строка ссылок). После гидрации ширины меряются (ResizeObserver на строке —
 * поворот, смена шрифта), лишние прячутся `visibility: hidden` и остаются на своих
 * местах в потоке — строка не прыгает, а «Ещё» встаёт на место первой спрятанной.
 *
 * Список — шаблон disclosure (как мега-меню 014): `button aria-expanded`, внутри
 * обычные ссылки, без role="menu". Esc и клик мимо закрывают.
 */

import Link from "@/components/page-transition";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { typograf } from "@/lib/format";

export type Pill = { slug: string | null; name: string; href: string };

/** Промежуток между «таблетками» (gap-2). */
const GAP = 8;
/** С какой ширины окна «Ещё» вместо прокрутки — брейкпоинт lg. */
const MORE_FROM = "(min-width: 1024px)";

const pillClass = (selected: boolean) =>
  `flex h-[38px] items-center rounded-[2px] border px-[15px] text-sm whitespace-nowrap transition-colors duration-150 ${
    selected
      ? "border-accent bg-accent text-canvas"
      : "border-line text-ink hover:border-accent hover:text-accent"
  }`;

function Chevron({ up }: { up: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 10 6" className="ml-[9px] h-[6px] w-[10px] shrink-0">
      <path
        d={up ? "M1 5l4-4 4 4" : "M1 1l4 4 4-4"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  );
}

export function SubcategoryPills({
  label,
  items,
  active,
  className = "",
}: {
  /** Подпись навигации: «Подразделы: Десерты» */
  label: string;
  items: Pill[];
  active: string | null;
  /** Поля строки и прокрутка ниже 1024 — от страницы */
  className?: string;
}) {
  const nav = useRef<HTMLElement>(null);
  const pills = useRef<(HTMLLIElement | null)[]>([]);
  const ghostMore = useRef<HTMLSpanElement>(null);
  const ghostActive = useRef<HTMLSpanElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  // Сколько «таблеток» видно; null — не мерили (сервер, ниже 1024): видны все
  const [fit, setFit] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const activeIndex = items.findIndex((item) => item.slug === active);
  const hiddenItems = fit === null ? [] : items.slice(fit);
  const activeHidden = fit !== null && activeIndex >= fit;
  const moreLabel = activeHidden ? items[activeIndex]!.name : "Ещё";

  const measure = useCallback(() => {
    const row = nav.current;
    if (!row || !window.matchMedia(MORE_FROM).matches) {
      setFit(null);
      return;
    }
    const widths = pills.current.map((pill) => pill?.offsetWidth ?? 0);
    const total = widths.reduce((sum, width) => sum + width, 0) + GAP * (widths.length - 1);
    const available = row.clientWidth;
    if (total <= available) {
      setFit(null);
      return;
    }
    const countWith = (more: number) => {
      let used = 0;
      let count = 0;
      for (const width of widths) {
        const next = used + (count ? GAP : 0) + width;
        if (next + GAP + more > available) break;
        used = next;
        count += 1;
      }
      return Math.max(1, count);
    };
    // Кнопка «Ещё»; если выбранный подраздел сам ушёл в список — кнопка с его
    // названием, она шире: пересчитываем по ней
    let count = countWith(ghostMore.current?.offsetWidth ?? 80);
    if (activeIndex >= count) count = countWith(ghostActive.current?.offsetWidth ?? 160);
    setFit(count);
  }, [activeIndex]);

  useLayoutEffect(() => {
    measure();
    const row = nav.current;
    if (!row) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(row);
    // Шрифт догрузился — ширины «таблеток» другие
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [measure, items]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!nav.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      moreRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Левый край «Ещё» — там, где начинается первая спрятанная «таблетка»
  const moreLeft = fit === null ? 0 : (pills.current[fit]?.offsetLeft ?? 0);

  return (
    // После замера с 1024 строка не прокручивается: иначе выпадающий список
    // обрезался бы по её краю. Спрятанные «таблетки» за краем режет сам список
    <nav
      ref={nav}
      aria-label={label}
      className={`relative ${className} ${fit === null ? "" : "lg:overflow-visible"}`}
    >
      <ul className={`flex w-max gap-2 ${fit === null ? "" : "lg:w-full lg:overflow-hidden"}`}>
        {items.map((item, index) => {
          const hidden = fit !== null && index >= fit;
          return (
            <li
              key={item.slug ?? "all"}
              ref={(element) => {
                pills.current[index] = element;
              }}
              // Спрятанные остаются в потоке: строка не перестраивается
              className={`shrink-0 ${hidden ? "invisible" : ""}`}
              aria-hidden={hidden || undefined}
            >
              <Link
                href={item.href}
                tabIndex={hidden ? -1 : undefined}
                aria-current={item.slug === active ? "page" : undefined}
                className={pillClass(item.slug === active)}
              >
                {typograf(item.name)}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Невидимые образцы кнопки — по ним меряется её ширина */}
      {[ghostMore, ghostActive].map((ref, index) => (
        <span
          key={index}
          ref={ref}
          aria-hidden="true"
          className="pointer-events-none invisible absolute top-0 left-0 flex h-[38px] items-center border px-[15px] text-sm whitespace-nowrap"
        >
          {typograf(index === 0 || activeIndex < 0 ? "Ещё" : items[activeIndex]!.name)}
          <Chevron up={false} />
        </span>
      ))}

      {hiddenItems.length > 0 ? (
        <div className="absolute top-0 max-lg:hidden" style={{ left: moreLeft }}>
          <button
            ref={moreRef}
            type="button"
            aria-expanded={open}
            aria-controls="subcategories-more"
            aria-current={activeHidden ? "page" : undefined}
            onClick={() => setOpen((current) => !current)}
            className={`flex h-[38px] items-center rounded-[2px] border px-[15px] text-sm whitespace-nowrap transition-colors duration-150 ${
              activeHidden
                ? "border-accent bg-accent text-canvas hover:bg-accent-pressed"
                : open
                  ? "border-ink text-ink"
                  : "border-line text-ink hover:border-accent hover:text-accent"
            }`}
          >
            {typograf(moreLabel)}
            <Chevron up={open} />
          </button>
          <ul
            id="subcategories-more"
            hidden={!open}
            className="absolute top-[calc(100%+6px)] left-0 z-20 w-[220px] border border-line bg-surface py-[9px]"
          >
            {hiddenItems.map((item) => (
              <li key={item.slug ?? "all"}>
                <Link
                  href={item.href}
                  aria-current={item.slug === active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`flex h-10 items-center px-[18px] text-sm transition-colors duration-150 hover:text-accent ${
                    item.slug === active ? "font-semibold text-accent" : "text-ink"
                  }`}
                >
                  {typograf(item.name)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </nav>
  );
}
