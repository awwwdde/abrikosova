/**
 * Поля форм. В макете форм пока нет (они появятся в заданиях 006–007),
 * поэтому здесь только перевод на токены: прямоугольные поля, линия `line`,
 * фокус — бордо.
 */

import type { ComponentProps, ReactNode } from "react";
import { pluralRu, typograf } from "@/lib/format";
import { NO_RECORD } from "@/lib/metrika";

export const inputClass =
  "min-h-10 w-full border border-line-strong bg-surface px-3 text-sm text-ink " +
  "transition-[border-color,box-shadow] duration-150 placeholder:text-ink-subtle " +
  "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

// NO_RECORD: Вебвизор Метрики не записывает нажатия и скрывает содержимое полей —
// имя, телефон и адрес клиента в запись сессии не попадают (012, 152-ФЗ)
export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${inputClass} ${NO_RECORD} ${props.className ?? ""}`} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      className={`${inputClass} ${NO_RECORD} min-h-28 py-2 ${props.className ?? ""}`}
    />
  );
}

export function Select(props: ComponentProps<"select">) {
  return (
    <select {...props} className={`${inputClass} ${NO_RECORD} pr-8 ${props.className ?? ""}`} />
  );
}

export function Field({
  label,
  error,
  required,
  hint,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">
        {label}
        {required ? <span className="text-accent"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs text-ink-subtle">{hint}</span> : null}
      {error ? (
        <span role="alert" className="mt-1.5 block text-xs text-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function Checkbox({
  label,
  error,
  ...props
}: ComponentProps<"input"> & { label: ReactNode; error?: string }) {
  return (
    <div>
      {/* py-1 расширяет зону нажатия до 40px, хотя сам квадратик 16px */}
      <label className="flex cursor-pointer items-start gap-2.5 py-1 text-sm text-ink">
        <input
          type="checkbox"
          {...props}
          className="mt-0.5 size-4 shrink-0 rounded-sm border-line-strong accent-accent"
        />
        <span className="leading-snug">{label}</span>
      </label>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Строка выбора в панели фильтров каталога (макет 02-filters-open.png):
 * квадрат 20px или круг 20px, подпись 15px и справа число из `count`.
 * Нативный `input` (клавиатура, скринридер, отправка формы без JS) с собственной
 * отрисовкой: в выбранном состоянии — бордовая заливка с галочкой или точкой.
 *
 * Значение с нулём — бледное и неактивное, кроме уже выбранного: выбранное
 * всегда можно снять, иначе человек застрял бы в пустой выдаче.
 */
export function OptionRow({
  type,
  label,
  count,
  checked,
  onChange,
  name,
  value,
  aside,
}: {
  type: "checkbox" | "radio";
  label: string;
  count?: number;
  /** Вместо числа справа — своё содержимое («+300 ₽» у надписи на странице товара) */
  aside?: ReactNode;
  checked: boolean;
  onChange: () => void;
  name: string;
  value: string;
}) {
  const disabled = count === 0 && !checked;
  return (
    <label
      className={`flex h-10 items-center gap-3 text-[15px] ${
        disabled ? "pointer-events-none text-ink-subtle/50" : "cursor-pointer text-ink"
      }`}
    >
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className={[
          "peer grid size-5 shrink-0 appearance-none place-content-center border",
          "transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          type === "radio" ? "rounded-full" : "rounded-[2px]",
          disabled
            ? "border-line"
            : checked
              ? type === "radio"
                ? "border-accent"
                : "border-accent bg-accent"
              : "border-line-strong hover:border-accent",
          // Галочка и точка — псевдоэлементом: без лишних узлов в доступном дереве
          type === "radio"
            ? "before:size-2 before:rounded-full before:bg-accent before:opacity-0 checked:before:opacity-100"
            : "before:h-[5px] before:w-[9px] before:-translate-y-px before:-rotate-45 before:border-b-[1.5px] before:border-l-[1.5px] before:border-white before:opacity-0 checked:before:opacity-100",
        ].join(" ")}
      />
      <span className="min-w-0 flex-1 leading-tight">{typograf(label)}</span>
      {aside !== undefined ? (
        <span className="tnum text-sm text-ink-subtle">{aside}</span>
      ) : count === undefined ? null : (
        <span className="tnum text-sm text-ink-subtle">
          {count}
          <span className="sr-only"> {pluralRu(count, ["товар", "товара", "товаров"])}</span>
        </span>
      )}
    </label>
  );
}
