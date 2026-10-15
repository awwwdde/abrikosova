/**
 * Метки и чипы.
 *
 * Метка ограничения («БЕЗ ГЛЮТЕНА») по макету: капс 11px с трекингом 0.12em,
 * обводка бордо 1px, высота 29px, без заливки и скругления.
 * Чип фильтра — 42px в высоту; выбранный и нажатый заливаются и получают
 * скругление 4px — так нарисовано на components.png.
 */

import type { ComponentProps, ReactNode } from "react";
import type { ForceState } from "./button";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  /** `outline` — метка ограничения с макета; neutral/accent — прежние плашки */
  tone?: "neutral" | "accent" | "outline";
}) {
  if (tone === "outline") return <Tag>{children}</Tag>;
  const tones = {
    neutral: "bg-canvas/90 text-ink-muted",
    accent: "bg-accent text-canvas",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-tag font-medium tracking-tag uppercase ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Метка ограничения в питании: капс, обводка бордо. Ниже 640 — компактнее:
 * «СНИЖЕННЫЙ САХАР» должна помещаться в карточку двухколоночной сетки на 375 (005b). */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-[29px] items-center border border-accent px-3 text-tag font-medium tracking-tag whitespace-nowrap text-accent uppercase max-sm:h-6 max-sm:px-1.5 max-sm:text-[10px] max-sm:tracking-[0.06em]">
      {children}
    </span>
  );
}

export type ChipState = "default" | "outline" | "pressed" | "selected";

const CHIP_STATES: Record<ChipState, string> = {
  default: "border border-line text-ink",
  outline: "border border-accent text-accent",
  pressed: "rounded-sm border border-accent-pressed bg-accent-pressed text-white",
  selected: "rounded-sm border border-accent bg-accent text-white",
};

/**
 * Чип фильтра каталога. Четыре состояния с макета: пустой (обводка line),
 * наведён (обводка бордо), нажат (тёмный бордо), выбран (бордо).
 */
export function Chip({
  selected = false,
  forceState,
  className = "",
  ...props
}: ComponentProps<"button"> & { selected?: boolean; forceState?: ForceState }) {
  const state: ChipState = selected
    ? "selected"
    : forceState === "pressed"
      ? "pressed"
      : forceState === "hover"
        ? "outline"
        : "default";
  const live =
    selected || forceState
      ? ""
      : "hover:border-accent hover:text-accent active:rounded-sm active:border-accent-pressed active:bg-accent-pressed active:text-white";
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={[
        "inline-flex h-[42px] items-center px-[18px] text-button font-semibold whitespace-nowrap",
        "transition-[background-color,border-color,color] duration-150 ease-out-soft",
        CHIP_STATES[state],
        live,
        className,
      ].join(" ")}
      {...props}
    />
  );
}
