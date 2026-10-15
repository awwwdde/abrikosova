"use client";

/**
 * Фильтр-меню (011d): мягкая кнопка с иконкой и текущим значением, по клику —
 * список вариантов. Высота 44, как у кнопок и полей кита (011g): в концепте 42, но
 * фильтры стоят в одном ряду с кнопкой «Добавить…» и полем поиска, и разница в 2px
 * видна. Паттерн ARIA menu button с `menuitemradio`: стрелки ходят
 * по пунктам, Enter/пробел выбирает, Esc закрывает и возвращает фокус на кнопку.
 */

import { CaretDown, Check } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

export function FilterMenu<T extends string>({
  label,
  icon,
  value,
  options,
  onChange,
}: {
  /** Что фильтруем — для скринридера: «Дата получения» */
  label: string;
  icon?: ReactNode;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();
  const current = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const selected = Math.max(
      0,
      options.findIndex((option) => option.value === value),
    );
    itemsRef.current[selected]?.focus();
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, options, value]);

  function onMenuKey(event: KeyboardEvent<HTMLDivElement>) {
    const items = itemsRef.current.filter(Boolean) as HTMLButtonElement[];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`${label}: ${current?.label ?? ""}`}
        onClick={() => setOpen((shown) => !shown)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="inline-flex h-11 items-center gap-2 rounded-admin-control bg-admin-card px-3.5 text-[13.5px] font-bold whitespace-nowrap text-admin-ink shadow-admin-card transition-[background-color,transform] duration-150 hover:bg-admin-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-side active:translate-y-px motion-reduce:transition-none"
      >
        {icon ? <span aria-hidden="true">{icon}</span> : null}
        {current?.label}
        <CaretDown aria-hidden="true" size={14} weight="bold" className="text-admin-muted" />
      </button>
      <div
        id={menuId}
        role="menu"
        aria-label={label}
        hidden={!open}
        onKeyDown={onMenuKey}
        className="absolute top-[calc(100%+6px)] right-0 z-40 min-w-48 rounded-admin-card bg-admin-card p-1.5 shadow-admin-hover"
      >
        {options.map((option, index) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value || "any"}
              ref={(node) => {
                itemsRef.current[index] = node;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              tabIndex={-1}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
                buttonRef.current?.focus();
              }}
              className={`flex w-full items-center justify-between gap-3 rounded-admin-small px-3 py-2 text-left text-[13.5px] font-semibold hover:bg-admin-soft focus-visible:bg-admin-soft focus-visible:outline-none ${
                selected ? "text-admin-side" : "text-admin-ink"
              }`}
            >
              {option.label}
              {selected ? <Check aria-hidden="true" size={15} weight="bold" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
