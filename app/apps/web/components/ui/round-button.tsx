/**
 * Круглые кнопки: «+» в карточке товара и стрелки карусели.
 *
 * Размеры по макету: «+» — 40px с обводкой `line`, в hover и «в корзине»
 * круг заливается бордо и вырастает до 44px. Рост сделан через scale, а не
 * через размер: соседние элементы карточки не сдвигаются. Стрелки — 52px.
 */

import type { ComponentProps } from "react";
import type { ForceState } from "./button";

export function PlusIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M5 0.5v9M0.5 5h9" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function CheckIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M3.5 9.5l3.5 3.5 7.5-8.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ArrowIcon({ direction }: { direction: "prev" | "next" }) {
  return (
    <svg
      width="14"
      height="10"
      viewBox="0 0 14 10"
      fill="none"
      aria-hidden="true"
      style={direction === "prev" ? { transform: "scaleX(-1)" } : undefined}
    >
      <path d="M0 5h13M9 1l4 4-4 4" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/**
 * Кнопка «+» в карточке. `added` — товар уже в корзине: заливка и галочка.
 */
export function PlusButton({
  added = false,
  forceState,
  className = "",
  ...props
}: ComponentProps<"button"> & { added?: boolean; forceState?: Extract<ForceState, "hover"> }) {
  const filled = added || forceState === "hover";
  return (
    <button
      type="button"
      className={[
        // Растёт до 44px влево от правого края, как на макете, — не вылезает за карточку
        "inline-flex size-10 shrink-0 origin-right items-center justify-center rounded-full",
        "transition-[background-color,border-color,color,scale] duration-150 ease-out-soft",
        "disabled:pointer-events-none",
        filled
          ? "scale-110 border border-accent bg-accent text-white"
          : "border border-line text-accent hover:scale-110 hover:border-accent hover:bg-accent hover:text-white group-hover/card:scale-110 group-hover/card:border-accent group-hover/card:bg-accent group-hover/card:text-white",
        className,
      ].join(" ")}
      {...props}
    >
      {added ? <CheckIcon /> : <PlusIcon />}
    </button>
  );
}

const ARROW_TONES = {
  // Светлый фон сайта: обводка line, стрелка тёмная; неактивная — почти прозрачная
  light: {
    idle: "border-line text-ink",
    disabled: "border-line/50 text-line",
  },
  // Тёмный фон: светлая обводка; неактивная — бордо (как на components.png)
  dark: {
    idle: "border-[#efe8dc] text-[#efe8dc]",
    disabled: "border-accent text-accent",
  },
} as const;

export function ArrowButton({
  direction,
  tone = "light",
  forceState,
  disabled,
  className = "",
  ...props
}: ComponentProps<"button"> & {
  direction: "prev" | "next";
  tone?: keyof typeof ARROW_TONES;
  forceState?: Extract<ForceState, "hover">;
}) {
  const colors = ARROW_TONES[tone];
  const state = disabled
    ? colors.disabled
    : forceState === "hover"
      ? "border-accent bg-accent text-white"
      : `${colors.idle} hover:border-accent hover:bg-accent hover:text-white`;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={direction === "prev" ? "Назад" : "Вперёд"}
      className={[
        "inline-flex size-13 shrink-0 items-center justify-center rounded-full border",
        "transition-[background-color,border-color,color] duration-150 ease-out-soft",
        "disabled:cursor-default",
        state,
        className,
      ].join(" ")}
      {...props}
    >
      <ArrowIcon direction={direction} />
    </button>
  );
}
