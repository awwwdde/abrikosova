"use client";

/**
 * Сортировка каталога (макет): «Сначала **готовое сегодня** ⌄» — подпись серым,
 * значение тёмным полужирным. По клику — свой выпадающий список, а не нативный
 * `<select>`: нативный нельзя оформить как на макете.
 *
 * Доступность — шаблон listbox из WAI-ARIA: кнопка с `aria-haspopup`, список
 * с `aria-activedescendant`, стрелки/Home/End двигают выбор, Enter и пробел
 * выбирают, Esc и клик вне закрывают и возвращают фокус на кнопку.
 */

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { SORT_LABELS, SORTS, type Sort } from "@/lib/catalog-query";

export function SortMenu({ value, onChange }: { value: Sort; onChange: (sort: Sort) => void }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(SORTS.indexOf(value));
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setActive(SORTS.indexOf(value));
    list.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, value]);

  function close() {
    setOpen(false);
    button.current?.focus();
  }

  function choose(index: number) {
    const next = SORTS[index];
    close();
    if (next && next !== value) onChange(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const last = SORTS.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(active + 1, last),
      ArrowUp: Math.max(active - 1, 0),
      Home: 0,
      End: last,
    };
    if (event.key in moves) {
      event.preventDefault();
      setActive(moves[event.key]!);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(active);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="flex h-10 items-center gap-[7px] text-sm whitespace-nowrap text-ink max-sm:h-11 max-sm:w-full max-sm:justify-center max-sm:border max-sm:border-line max-sm:px-2"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          aria-hidden="true"
          className="shrink-0 sm:hidden"
        >
          <path
            d="M5 14V3m0 0L2 6m3-3 3 3M13 4v11m0 0 3-3m-3 3-3-3"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="text-ink-muted max-sm:hidden">Сначала</span>
        <span className="font-semibold max-sm:font-normal max-sm:first-letter:uppercase">
          {SORT_LABELS[value]}
        </span>
        <svg
          width="11"
          height="9"
          viewBox="0 0 11 9"
          fill="none"
          aria-hidden="true"
          className={`transition-transform duration-150 max-sm:hidden ${open ? "rotate-180" : ""}`}
        >
          <path d="M0.5 0.5L5.5 8L10.5 0.5" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
      {open ? (
        <ul
          ref={list}
          id={`${id}-list`}
          role="listbox"
          tabIndex={-1}
          aria-label="Сортировка"
          aria-activedescendant={`${id}-${SORTS[active]}`}
          onKeyDown={onKeyDown}
          className="absolute top-full right-0 z-30 mt-2 min-w-[220px] border border-line bg-canvas py-2 shadow-[0_12px_32px_rgb(26_18_16/0.08)] focus:outline-none"
        >
          {SORTS.map((sort, index) => (
            <li
              key={sort}
              id={`${id}-${sort}`}
              role="option"
              aria-selected={sort === value}
              onPointerEnter={() => setActive(index)}
              onClick={() => choose(index)}
              className={`flex cursor-pointer items-center justify-between gap-4 px-4 py-2.5 text-sm ${
                index === active ? "bg-photo" : ""
              } ${sort === value ? "font-semibold text-ink" : "text-ink-muted"}`}
            >
              Сначала {SORT_LABELS[sort]}
              {sort === value ? (
                <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true">
                  <path d="M1 5l4 4 8-8" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
