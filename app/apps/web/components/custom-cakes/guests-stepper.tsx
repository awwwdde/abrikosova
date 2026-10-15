"use client";

/**
 * Степпер «Гостей» (кадры custom-cakes.png): «− 40 +» 116 × 52 в тонкой рамке.
 * Общий для калькулятора (008b), страницы дизайна и окна заявки (008c). Ввод с
 * клавиатуры — цифрами в поле, ↑/↓ меняют на единицу; ниже `min` «−» выключен.
 */

import { Minus, Plus } from "@phosphor-icons/react";
import type { KeyboardEvent } from "react";

export const MAX_GUESTS = 1000;

export function GuestsStepper({
  id,
  value,
  onChange,
  min = 1,
  invalid = false,
  describedBy,
  className = "",
}: {
  id: string;
  /** Текст поля: пока человек печатает, число может быть неполным */
  value: string;
  onChange: (value: string) => void;
  min?: number;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}) {
  const number = Number.parseInt(value, 10);
  const current = Number.isInteger(number) ? number : min;
  const set = (next: number) => onChange(String(Math.min(Math.max(next, min), MAX_GUESTS)));

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      set(current + (event.key === "ArrowUp" ? 1 : -1));
    }
  }

  return (
    <div
      className={`inline-flex h-[52px] w-[116px] items-center justify-between border ${
        invalid ? "border-accent" : "border-ink"
      } ${className}`}
    >
      <button
        type="button"
        onClick={() => set(current - 1)}
        disabled={current <= min}
        aria-label="Меньше гостей"
        className="flex h-full w-10 items-center justify-center text-ink disabled:text-ink-subtle/50"
      >
        <Minus aria-hidden="true" size={14} />
      </button>
      <input
        id={id}
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 4))}
        onKeyDown={onKeyDown}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="w-9 bg-transparent text-center text-[16px] font-medium text-ink tabular-nums outline-none focus-visible:outline-2 focus-visible:outline-accent"
      />
      <button
        type="button"
        onClick={() => set(current + 1)}
        aria-label="Больше гостей"
        className="flex h-full w-10 items-center justify-center text-ink"
      >
        <Plus aria-hidden="true" size={14} />
      </button>
    </div>
  );
}
