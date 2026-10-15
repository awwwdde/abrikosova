"use client";

/**
 * Поля форм публичной части — общие для оформления заказа (007b) и окна заявки на
 * торт (008c): текстовое поле с ошибкой под ним, чекбокс, «таблетки» radiogroup.
 * Ошибка — красная рамка и текст под полем, связь — aria-invalid / aria-describedby.
 * У полей классы NO_RECORD: Вебвизор не записывает ввод (ПДн).
 */

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { NO_RECORD } from "@/lib/metrika";

export type TextFieldProps = Omit<React.ComponentProps<"input">, "name"> & {
  label: string;
  name: string;
  error?: string;
  multiline?: boolean;
  wide?: boolean;
  /** Префикс id: «checkout-email», «request-email» */
  idPrefix?: string;
};

export function TextField({
  label,
  name,
  error,
  multiline = false,
  wide = false,
  className = "",
  idPrefix = "checkout",
  ref,
  ...props
}: TextFieldProps) {
  const id = `${idPrefix}-${name.replaceAll("_", "-")}`;
  const control = `w-full border bg-surface px-[14px] text-[15px] text-ink placeholder:text-ink-subtle focus:outline-none ${NO_RECORD} ${
    error ? "border-accent" : "border-line focus:border-ink"
  }`;
  return (
    <div className={`${wide ? "sm:col-span-2" : ""} ${className}`}>
      <label htmlFor={id} className="block text-[14px] leading-5 text-ink-subtle">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          name={name}
          rows={3}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${control} mt-[6px] h-24 resize-y py-[12px] leading-[22px]`}
          ref={ref as React.Ref<HTMLTextAreaElement>}
          {...(props as React.ComponentProps<"textarea">)}
        />
      ) : (
        <input
          id={id}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${control} mt-[6px] h-12`}
          ref={ref}
          {...props}
        />
      )}
      {error ? (
        <p id={`${id}-error`} className="mt-[7px] text-[13px] leading-5 text-accent">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Check({
  id,
  checked,
  onChange,
  onBlur,
  error,
  className = "",
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  onBlur?: () => void;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label className="flex cursor-pointer items-center gap-3 text-[15px] leading-5 text-ink">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={[
            "peer grid size-5 shrink-0 appearance-none place-content-center border bg-surface transition-colors duration-150",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            "before:h-[5px] before:w-[9px] before:-translate-y-px before:-rotate-45 before:border-b-[1.5px] before:border-l-[1.5px] before:border-white before:opacity-0 checked:before:opacity-100",
            checked ? "border-accent bg-accent" : error ? "border-accent" : "border-line-strong",
          ].join(" ")}
        />
        <span>{children}</span>
      </label>
      {error ? (
        <p id={`${id}-error`} className="mt-[7px] text-[13px] leading-5 text-accent">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export type Option = { value: string; label: string; disabled?: boolean };

/** Переключатель «таблетками»: radiogroup, стрелки выбирают соседний доступный. */
export function RadioPills({
  id,
  label,
  visibleLabel = false,
  value,
  options,
  onChange,
  error,
  className = "",
  compact = false,
}: {
  id?: string;
  label: string;
  visibleLabel?: boolean;
  /** Окно заявки (008c): таблетки 14 px, чтобы пять поводов уместились в две строки */
  compact?: boolean;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  error?: string;
  className?: string;
}) {
  const labelId = `${id ?? label}-label`.replace(/\s+/g, "-");
  return (
    <div className={className}>
      <p
        id={labelId}
        className={visibleLabel ? "text-[14px] leading-5 text-ink-subtle" : "sr-only"}
      >
        {label}
      </p>
      <RadioGroup
        id={id}
        labelId={labelId}
        error={error}
        value={value}
        options={options}
        onChange={onChange}
        className={`flex flex-wrap gap-2 ${visibleLabel ? "mt-[13px]" : ""}`}
        render={(option, selected) => (
          <span
            className={`flex h-[38px] items-center border whitespace-nowrap transition-colors duration-150 ${
              compact ? "px-[13px] text-[14px]" : "px-[14px] text-[15px]"
            } ${
              selected
                ? "border-accent bg-accent text-canvas"
                : option.disabled
                  ? "border-line text-ink-subtle/60"
                  : "border-line text-ink group-hover:border-accent"
            }`}
          >
            {option.label}
          </span>
        )}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-[7px] text-[13px] leading-5 text-accent">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function RadioGroup({
  id,
  labelId,
  value,
  options,
  onChange,
  error,
  className,
  render,
}: {
  id?: string;
  labelId: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  error?: string;
  className: string;
  render: (option: Option, selected: boolean) => ReactNode;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.filter((option) => !option.disabled);
  // В порядок Tab попадает выбранная или первая доступная — как у нативных radio
  const focusable = options.some((option) => option.value === value && !option.disabled)
    ? value
    : enabled[0]?.value;

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!step || enabled.length === 0) return;
    event.preventDefault();
    for (let shift = 1; shift <= options.length; shift++) {
      const next = (index + step * shift + options.length) % options.length;
      if (!options[next]!.disabled) {
        onChange(options[next]!.value);
        buttons.current[next]?.focus();
        return;
      }
    }
  }

  return (
    <div
      id={id}
      role="radiogroup"
      aria-labelledby={labelId}
      aria-invalid={error ? true : undefined}
      aria-describedby={error && id ? `${id}-error` : undefined}
      tabIndex={-1}
      className={`${className} focus:outline-none`}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={option.disabled || undefined}
            tabIndex={option.value === focusable ? 0 : -1}
            onClick={() => !option.disabled && onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`group relative shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              option.disabled ? "cursor-not-allowed" : ""
            }`}
          >
            {render(option, selected)}
          </button>
        );
      })}
    </div>
  );
}
