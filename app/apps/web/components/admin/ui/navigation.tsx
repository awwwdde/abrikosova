"use client";

/**
 * Переключатель-пилюли и пагинация.
 *
 * `SegmentedTabs` — `role="tablist"` по паттерну ARIA: в порядок Tab попадает
 * только выбранная вкладка, стрелки влево/вправо (и Home/End) переключают.
 */

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";

export type TabOption<T extends string> = { value: T; label: ReactNode };

export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  label,
  surface = "panel",
  controls,
}: {
  options: readonly TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Подпись группы для скринридера: «Период», «День» */
  label: string;
  /** На карточке фон кремовый (panel), на подложке — карточный с тенью (card) */
  surface?: "panel" | "card";
  /** id области, которую переключают вкладки */
  controls?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent, index: number) {
    const last = options.length - 1;
    const next =
      event.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : event.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={`inline-flex rounded-full p-[3px] ${
        surface === "panel" ? "bg-admin-panel" : "bg-admin-card shadow-admin-card"
      }`}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={controls}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`h-[30px] rounded-full px-[13px] text-[12.5px] font-bold whitespace-nowrap transition-[background-color,color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-side motion-reduce:transition-none ${
              selected ? "bg-admin-side text-admin-card" : "text-admin-muted hover:text-admin-ink"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Номера страниц с многоточием: 1 … 4 5 6 … 12. */
export function pageItems(page: number, pages: number): (number | "gap")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const items: (number | "gap")[] = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(pages - 1, page + 1);
  if (from > 2) items.push("gap");
  for (let i = from; i <= to; i++) items.push(i);
  if (to < pages - 1) items.push("gap");
  items.push(pages);
  return items;
}

export function Pagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  if (pages <= 1) return null;
  const arrow =
    "inline-flex size-9 items-center justify-center rounded-full text-admin-ink transition-colors duration-150 hover:bg-admin-soft hover:text-admin-side focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-side disabled:pointer-events-none disabled:text-admin-disabled-ink";
  return (
    <nav aria-label="Страницы" className="flex items-center gap-1">
      <button
        type="button"
        className={arrow}
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Предыдущая страница"
      >
        <CaretLeft aria-hidden="true" size={18} />
      </button>
      {pageItems(page, pages).map((item, index) =>
        item === "gap" ? (
          <span
            key={`gap-${index}`}
            aria-hidden="true"
            className="w-6 text-center text-admin-muted"
          >
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            aria-current={item === page ? "page" : undefined}
            className={`h-9 min-w-9 rounded-full px-2 text-[13.5px] font-bold tabular-nums transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-side ${
              item === page
                ? "bg-admin-side text-admin-card"
                : "text-admin-ink hover:bg-admin-soft hover:text-admin-side"
            }`}
          >
            {item}
          </button>
        ),
      )}
      <button
        type="button"
        className={arrow}
        onClick={() => onChange(page + 1)}
        disabled={page >= pages}
        aria-label="Следующая страница"
      >
        <CaretRight aria-hidden="true" size={18} />
      </button>
    </nav>
  );
}
