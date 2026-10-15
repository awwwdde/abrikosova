"use client";

/**
 * Кнопки админки (концепт new/design/admin/, README «Правила»).
 *
 * У сайта кнопки прямоугольные, у админки — скруглённые 10–12 и с другой шкалой
 * размеров, поэтому отдельный компонент, а не вариант `components/ui/button`.
 * Нажатие — сдвиг на 1px вниз (только transform), фокус — бордовая обводка 2px.
 * `loading` блокирует кнопку: повторный клик во время запроса ничего не отправит.
 */

import { CircleNotch } from "@phosphor-icons/react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export type ButtonVariant = "primary" | "soft" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "relative inline-flex shrink-0 items-center justify-center gap-2 font-bold whitespace-nowrap select-none transition-[background-color,color,box-shadow,transform] duration-150 ease-out-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-side active:translate-y-px motion-reduce:transition-none disabled:pointer-events-none aria-disabled:pointer-events-none";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-admin-side text-admin-card shadow-admin-button hover:bg-admin-hover disabled:bg-admin-disabled disabled:text-admin-disabled-ink disabled:shadow-none",
  soft: "bg-admin-card text-admin-ink shadow-admin-card hover:bg-admin-soft disabled:text-admin-disabled-ink",
  outline:
    "border border-admin-disabled bg-admin-card text-admin-ink hover:border-admin-side hover:bg-admin-soft disabled:text-admin-disabled-ink",
  ghost:
    "text-admin-ink hover:bg-admin-soft hover:text-admin-side disabled:text-admin-disabled-ink",
  danger:
    "bg-admin-soft text-admin-side hover:bg-admin-side hover:text-admin-card disabled:bg-admin-disabled disabled:text-admin-disabled-ink",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 rounded-admin-small px-3 text-[12.5px]",
  md: "h-11 rounded-admin-control px-[18px] text-sm",
  lg: "h-[54px] rounded-admin-control px-6 text-[15.5px]",
};

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra = "",
): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

type Own = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Иконка слева от текста (Phosphor) */
  icon?: ReactNode;
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  loading = false,
  disabled,
  className = "",
  children,
  type = "button",
  ...props
}: ComponentProps<"button"> & Own) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, className)}
      {...props}
    >
      {loading ? (
        <CircleNotch
          aria-hidden="true"
          size={18}
          weight="bold"
          className="animate-spin motion-reduce:animate-none"
        />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}

/** Ссылка в виде кнопки — для переходов («Все заказы», «Новый товар»). */
export function ButtonLink({
  variant = "primary",
  size = "md",
  icon,
  className = "",
  children,
  ...props
}: ComponentProps<typeof Link> & Omit<Own, "loading">) {
  return (
    <Link className={buttonClass(variant, size, className)} {...props}>
      {icon}
      {children}
    </Link>
  );
}

/** Квадратная кнопка-иконка. Подпись обязательна — иначе скринридер прочтёт «кнопка». */
export function IconButton({
  label,
  size = "md",
  tone = "ghost",
  className = "",
  children,
  type = "button",
  ...props
}: Omit<ComponentProps<"button">, "aria-label"> & {
  label: string;
  size?: "sm" | "md";
  tone?: "ghost" | "soft" | "round";
}) {
  const sizes = { sm: "size-8", md: "size-10" };
  const tones = {
    ghost: "rounded-admin-small text-admin-muted hover:bg-admin-soft hover:text-admin-side",
    soft: "rounded-admin-small bg-admin-card text-admin-ink shadow-admin-card hover:bg-admin-soft",
    round: "rounded-full text-admin-ink hover:bg-admin-soft hover:text-admin-side",
  };
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`${BASE} ${sizes[size]} ${tones[tone]} disabled:text-admin-disabled-ink ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
