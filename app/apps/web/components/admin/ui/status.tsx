"use client";

/**
 * Метки, статусы, изменения и аватары.
 *
 * Статусы заказа и заявки — одна карта `kind:status → подпись и цвет`
 * (README, таблица «Статусы заказа»). Текст на метке виден всегда: цвет
 * подсказывает, но не несёт смысл в одиночку.
 */

import { CaretDown, CaretUp } from "@phosphor-icons/react";
import type { ComponentProps, ReactNode } from "react";
import type { ConsultationStatus, OrderStatus } from "@/lib/api";

export type BadgeTone = "accent" | "amber" | "blue" | "green" | "grey";

const TONES: Record<BadgeTone, string> = {
  accent: "bg-admin-soft text-admin-side",
  amber: "bg-admin-amber-soft text-admin-amber",
  blue: "bg-admin-blue-soft text-admin-blue",
  green: "bg-admin-green-soft text-admin-green",
  grey: "bg-admin-grey-soft text-admin-muted",
};

export function Badge({
  tone = "grey",
  className = "",
  ...props
}: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={`inline-flex h-[26px] items-center gap-1.5 rounded-full px-[11px] text-[12.5px] font-bold whitespace-nowrap ${TONES[tone]} ${className}`}
      {...props}
    />
  );
}

export const STATUS_VIEW = {
  order: {
    new: { label: "Новый", tone: "accent" },
    confirmed: { label: "Подтверждён", tone: "amber" },
    in_progress: { label: "Готовится", tone: "blue" },
    ready: { label: "Готов к выдаче", tone: "green" },
    completed: { label: "Выдан", tone: "grey" },
    cancelled: { label: "Отменён", tone: "grey" },
  },
  consultation: {
    new: { label: "Новая", tone: "accent" },
    contacted: { label: "В работе", tone: "amber" },
    completed: { label: "Завершена", tone: "grey" },
  },
} as const satisfies {
  order: Record<OrderStatus, { label: string; tone: BadgeTone }>;
  consultation: Record<ConsultationStatus, { label: string; tone: BadgeTone }>;
};

export function StatusBadge(
  props:
    { kind: "order"; status: OrderStatus } | { kind: "consultation"; status: ConsultationStatus },
) {
  const view =
    props.kind === "order"
      ? STATUS_VIEW.order[props.status]
      : STATUS_VIEW.consultation[props.status];
  return <Badge tone={view.tone}>{view.label}</Badge>;
}

/**
 * Изменение к прошлому периоду: «↑ 12 %». `positive` — что считать хорошим:
 * для отмен рост — плохо, и метка становится бордовой.
 */
export function Delta({
  value,
  suffix = "",
  positive = "up",
  label,
}: {
  value: number;
  suffix?: string;
  positive?: "up" | "down";
  /** Полный текст для скринридера: «на 12 % больше, чем на прошлой неделе» */
  label?: string;
}) {
  const good = value === 0 ? null : value > 0 === (positive === "up");
  const tone = good === null ? TONES.grey : good ? TONES.green : TONES.accent;
  const Icon = value > 0 ? CaretUp : value < 0 ? CaretDown : null;
  return (
    <span
      className={`inline-flex h-[22px] items-center gap-0.5 rounded-full pr-[7px] pl-[5px] text-xs font-bold tabular-nums whitespace-nowrap ${tone} ${
        Icon ? "" : "pl-[7px]"
      }`}
    >
      {Icon ? <Icon aria-hidden="true" size={14} weight="bold" /> : null}
      <span aria-hidden={label ? true : undefined}>
        {Math.abs(value)}
        {suffix}
      </span>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}

/** Инициалы: «Мария Смирнова» → «МС», «elena» → «EL». */
export function initials(name: string): string {
  const words = name
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (words.length >= 2) return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
  return (words[0] ?? "?").slice(0, 2).toUpperCase();
}

export function Avatar({
  name,
  size = "md",
  tone = "cream",
  className = "",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  tone?: "cream" | "side";
  className?: string;
}) {
  const sizes = {
    sm: "size-[34px] text-xs",
    md: "size-[38px] text-[13px]",
    lg: "size-10 text-[15px]",
  };
  const tones = { cream: "bg-admin-cream text-admin-side", side: "bg-admin-side text-admin-cream" };
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${sizes[size]} ${tones[tone]} ${className}`}
    >
      {initials(name)}
    </span>
  );
}

/** Круглый счётчик в меню: 22px, кремовый на бордо. */
export function CountPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-admin-cream px-[7px] text-xs font-bold text-admin-side tabular-nums">
      {children}
    </span>
  );
}
