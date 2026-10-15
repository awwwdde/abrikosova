/**
 * Карточка админки: фон #FFFDF9, скругление 14, мягкая тень (README «Токены»).
 * `interactive` — для строк-ссылок: тень растёт при наведении.
 */

import type { ComponentProps, ReactNode } from "react";

export function Card({
  as: Tag = "section",
  interactive = false,
  padding = "md",
  className = "",
  ...props
}: Omit<ComponentProps<"section">, "ref"> & {
  as?: "section" | "div" | "article" | "li";
  interactive?: boolean;
  padding?: "none" | "sm" | "md";
}) {
  const paddings = { none: "", sm: "px-4 py-3.5", md: "px-6 py-[22px]" };
  return (
    <Tag
      className={`rounded-admin-card bg-admin-card shadow-admin-card ${paddings[padding]} ${
        interactive
          ? "transition-shadow duration-150 hover:shadow-admin-hover motion-reduce:transition-none"
          : ""
      } ${className}`}
      {...props}
    />
  );
}

/** Заголовок блока 17/700 и действие справа («Все заказы», переключатель периода). */
export function CardHeader({
  title,
  action,
  id,
  as: Heading = "h2",
  className = "",
}: {
  title: ReactNode;
  action?: ReactNode;
  id?: string;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <div
      className={`flex min-h-[38px] flex-wrap items-center justify-between gap-x-3 gap-y-2 ${className}`}
    >
      <Heading id={id} className="font-sans text-[17px] leading-tight font-bold text-admin-ink">
        {title}
      </Heading>
      {action}
    </div>
  );
}

/** Подпись колонки: 11.5/700, капс, разрядка 0.1em. */
export function ColumnLabel({ className = "", ...props }: ComponentProps<"span">) {
  return (
    <span
      className={`text-[11.5px] font-bold tracking-[0.1em] text-admin-muted uppercase ${className}`}
      {...props}
    />
  );
}
