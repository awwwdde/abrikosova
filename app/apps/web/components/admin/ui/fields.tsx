"use client";

/**
 * Поля админки. Подпись — над полем, подсказка и ошибка — под ним; placeholder
 * подпись не заменяет (README «Правила»). `Field` сам связывает подпись, поле,
 * подсказку и ошибку через id и `aria-describedby`, поэтому каждое поле
 * передаётся функцией: `<Field label="Цена">{(a11y) => <Input {...a11y} />}</Field>`.
 */

import { CaretDown } from "@phosphor-icons/react";
import { useId } from "react";
import type { ComponentProps, ReactNode } from "react";

export type FieldA11y = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

export function Field({
  label,
  hint,
  error,
  children,
  className = "",
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: (a11y: FieldA11y) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={id} className="text-[13.5px] font-bold text-admin-ink">
        {label}
      </label>
      {children({
        id,
        "aria-describedby": describedBy,
        ...(error ? { "aria-invalid": true as const } : {}),
      })}
      {error ? (
        <p id={errorId} className="text-[13px] font-semibold text-admin-side">
          {error}
        </p>
      ) : null}
      {hint ? (
        <div id={hintId} className="text-[13px] text-admin-muted">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

const CONTROL =
  "w-full rounded-admin-control border border-admin-field bg-admin-card text-admin-ink transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-admin-muted/70 focus:border-admin-side focus:shadow-admin-focus aria-invalid:border-admin-side disabled:cursor-not-allowed disabled:bg-admin-panel disabled:text-admin-disabled-ink motion-reduce:transition-none";

/**
 * Поле ввода: иконка слева (декоративная), справа — суффикс («₽», «г») или кнопка.
 * `size="lg"` — 52px, как на входе; по умолчанию 44.
 */
export function Input({
  icon,
  suffix,
  size = "md",
  className = "",
  ...props
}: Omit<ComponentProps<"input">, "size"> & {
  icon?: ReactNode;
  suffix?: ReactNode;
  size?: "md" | "lg";
}) {
  const heights = { md: "h-11 text-sm", lg: "h-[52px] text-[15.5px] font-medium" };
  const iconTop = { md: "top-3", lg: "top-[15px]" };
  return (
    <span className="relative block">
      {icon ? (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute left-[15px] text-admin-muted ${iconTop[size]}`}
        >
          {icon}
        </span>
      ) : null}
      <input
        className={`${CONTROL} ${heights[size]} ${icon ? "pl-[46px]" : "pl-4"} ${
          suffix ? (size === "lg" ? "pr-[54px]" : "pr-12") : "pr-4"
        } ${className}`}
        {...props}
      />
      {suffix ? (
        <span className="absolute inset-y-0 right-[5px] flex items-center text-sm text-admin-muted">
          {typeof suffix === "string" ? <span className="pr-3">{suffix}</span> : suffix}
        </span>
      ) : null}
    </span>
  );
}

export function Select({ className = "", children, ...props }: ComponentProps<"select">) {
  return (
    <span className="relative block">
      <select
        className={`${CONTROL} h-11 appearance-none pr-10 pl-4 text-sm ${className}`}
        {...props}
      >
        {children}
      </select>
      <CaretDown
        aria-hidden="true"
        size={16}
        className="pointer-events-none absolute top-[14px] right-4 text-admin-muted"
      />
    </span>
  );
}

export function Textarea({ className = "", rows = 4, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      rows={rows}
      className={`${CONTROL} resize-y px-4 py-3 text-sm leading-relaxed ${className}`}
      {...props}
    />
  );
}

/**
 * Переключатель «вкл/выкл» — `role="switch"`, подпись рядом и кликабельна.
 *
 * Раскладка без абсолютных координат (011g): дорожка — flex с внутренним отступом,
 * бегунок — обычный элемент, выровненный по центру. Размеры — переменные
 * (`--switch-w/h/pad`), размер бегунка и его ход считаются из них. Раньше бегунок
 * стоял на `top-[3px]`, и любая разница высоты дорожки (дробный масштаб, другой
 * размер шрифта браузера) вытаскивала его за край.
 */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  hideLabel = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  /** В строке таблицы подпись только для скринридера: «На сайте: Медовик» */
  hideLabel?: boolean;
}) {
  const id = useId();
  return (
    // Без видимой подписи — по центру строки; с подписью — по первой строке текста:
    // высота строки подписи (24) равна высоте дорожки, отступ сверху не нужен
    <div className={`flex gap-3 ${hideLabel ? "items-center" : "items-start"}`}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-d` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`flex h-(--switch-h) w-(--switch-w) shrink-0 items-center rounded-full p-(--switch-pad) transition-colors duration-150 [--switch-h:24px] [--switch-pad:3px] [--switch-w:42px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-side disabled:opacity-50 motion-reduce:transition-none ${
          checked
            ? "bg-admin-side enabled:hover:bg-admin-hover"
            : "bg-admin-field enabled:hover:bg-admin-dash"
        }`}
      >
        <span
          aria-hidden="true"
          className={`size-[calc(var(--switch-h)-2*var(--switch-pad))] shrink-0 rounded-full bg-admin-card shadow-[0_1px_2px_rgb(80_40_30/0.25)] transition-transform duration-150 motion-reduce:transition-none ${
            checked ? "translate-x-[calc(var(--switch-w)-var(--switch-h))]" : ""
          }`}
        />
      </button>
      <span className={`flex flex-col gap-0.5 ${hideLabel ? "sr-only" : ""}`}>
        <label
          htmlFor={id}
          className="cursor-pointer text-sm leading-6 font-semibold text-admin-ink"
        >
          {label}
        </label>
        {description ? (
          <span id={`${id}-d`} className="text-[13px] text-admin-muted">
            {description}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/** Вариант-карточка из группы радиокнопок (способ получения, роль сотрудника). */
export function RadioCard({
  name,
  value,
  checked,
  onChange,
  title,
  description,
  icon,
  disabled,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-admin-control border px-4 py-3.5 transition-[background-color,border-color] duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-admin-side has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 motion-reduce:transition-none ${
        checked
          ? "border-admin-side bg-admin-soft"
          : "border-admin-field bg-admin-card hover:border-admin-muted"
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 ${
          checked ? "border-admin-side" : "border-admin-field"
        }`}
      >
        {checked ? <span className="size-2 rounded-full bg-admin-side" /> : null}
      </span>
      {icon ? (
        <span aria-hidden="true" className="text-admin-side">
          {icon}
        </span>
      ) : null}
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-bold text-admin-ink">{title}</span>
        {description ? <span className="text-[13px] text-admin-muted">{description}</span> : null}
      </span>
    </label>
  );
}

/** Чип-переключатель фильтра: `aria-pressed`, пилюля. */
export function ChipToggle({
  pressed,
  onChange,
  className = "",
  children,
  ...props
}: Omit<ComponentProps<"button">, "onChange"> & {
  pressed: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onChange(!pressed)}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-bold transition-[background-color,color,border-color,transform] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-side active:translate-y-px disabled:opacity-50 motion-reduce:transition-none ${
        pressed
          ? "border-admin-side bg-admin-side text-admin-card"
          : "border-admin-field bg-admin-card text-admin-ink hover:border-admin-side hover:text-admin-side"
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
