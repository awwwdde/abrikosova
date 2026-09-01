/**
 * Базовые UI-примитивы.
 *
 * Правила, которым следуют все компоненты ниже:
 * — радиусы концентричные (внешний = внутренний + padding);
 * — переходы перечисляют конкретные свойства, никакого transition-all;
 * — у нажимаемых элементов есть тактильный отклик scale(0.96);
 * — минимальная зона нажатия 40px по высоте.
 */

import Image from "next/image";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { imageUrl } from "@/lib/api";

const BUTTON_BASE =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium " +
  "transition-[background-color,color,box-shadow,scale] duration-150 ease-[cubic-bezier(0.2,0,0,1)] " +
  "active:scale-[0.96] disabled:pointer-events-none disabled:opacity-45";

const BUTTON_VARIANTS = {
  primary: "bg-accent text-white shadow-raised hover:bg-accent-hover",
  secondary: "bg-surface text-ink shadow-raised hover:bg-surface-sunken",
  ghost: "text-ink-muted hover:bg-surface-sunken hover:text-ink",
  danger: "bg-surface text-danger shadow-raised hover:bg-accent-soft",
} as const;

type Variant = keyof typeof BUTTON_VARIANTS;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return (
    <button className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${className}`} {...props} />
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return (
    <Link
      href={href}
      className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </Link>
  );
}

export const inputClass =
  "min-h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink " +
  "transition-[border-color,box-shadow] duration-150 placeholder:text-ink-subtle " +
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={`${inputClass} min-h-28 py-2 ${props.className ?? ""}`} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={`${inputClass} pr-8 ${props.className ?? ""}`} />;
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
 * Карточка: тень вместо жёсткой рамки — она мягче ложится на любой фон
 * и не режет глаз линией на стыке секций.
 */
export function Card({
  className = "",
  interactive = false,
  children,
}: {
  className?: string;
  interactive?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-lg bg-surface shadow-raised ${
        interactive
          ? "transition-[box-shadow,translate] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:-translate-y-0.5 hover:shadow-hover"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Фотография товара или работы.
 *
 * Пока изображения нет — показывает заглушку с тем же соотношением сторон,
 * поэтому сетка не «прыгает» при появлении реальных фото. Загрузка через
 * next/image с явным `sizes`: браузер скачивает вариант под свою ширину,
 * а не полноразмерный файл.
 */
export function Picture({
  storageKey,
  alt,
  ratio = "4/5",
  sizes = "(min-width: 768px) 25vw, 50vw",
  priority = false,
  className = "",
}: {
  storageKey: string | null | undefined;
  alt: string;
  ratio?: "4/5" | "1/1" | "16/9" | "3/2";
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  const src = imageUrl(storageKey);

  if (!src) return <ImagePlaceholder ratio={ratio} className={className} />;

  return (
    <div
      style={{ aspectRatio: ratio }}
      className={`img-outline relative w-full overflow-hidden bg-surface-sunken ${className}`}
    >
      <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
    </div>
  );
}

/**
 * Место под фото. Фиксированное соотношение сторон держит сетку ровной
 * ещё до того, как появятся реальные изображения.
 */
export function ImagePlaceholder({
  ratio = "4/5",
  label,
  fill = false,
  className = "",
}: {
  ratio?: "4/5" | "1/1" | "16/9" | "3/2";
  label?: string;
  /** Заполнить родителя целиком — для плиток бенто, где высоту задаёт сетка. */
  fill?: boolean;
  className?: string;
}) {
  return (
    <div
      style={fill ? undefined : { aspectRatio: ratio }}
      className={`img-outline flex items-center justify-center bg-surface-sunken ${
        fill ? "absolute inset-0" : "w-full"
      } ${className}`}
      aria-hidden="true"
    >
      {label ? <span className="text-2xs tracking-wide text-ink-subtle">{label}</span> : null}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent";
}) {
  const tones = {
    neutral: "bg-surface/90 text-ink-muted",
    accent: "bg-accent text-white",
  };
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-2xs font-medium tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong px-6 py-16 text-center">
      <p className="font-display text-lg text-ink">{title}</p>
      {description ? (
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav
      aria-label="Хлебные крошки"
      className="flex flex-wrap items-center gap-x-2 text-xs text-ink-subtle"
    >
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-x-2">
          {index > 0 ? <span aria-hidden="true">/</span> : null}
          {item.href ? (
            <Link href={item.href} className="transition-colors duration-150 hover:text-ink">
              {item.label}
            </Link>
          ) : (
            <span className="text-ink-muted">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h2 className="text-2xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function Price({ value, className = "" }: { value: string; className?: string }) {
  const number = Number.parseFloat(value);
  return (
    <span className={`tnum ${className}`}>
      {number.toLocaleString("ru-RU", { maximumFractionDigits: 0 })}&nbsp;₽
    </span>
  );
}
