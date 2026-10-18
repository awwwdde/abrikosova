/**
 * Кнопки.
 *
 * Размеры по макету (components.png): большая 304×74 с текстом 20 капсом
 * («ОТКРЫТЬ ВИТРИНУ»), средняя 182×52 с текстом 16/600 («Вся витрина»).
 * Кнопки прямоугольные, без теней. Размер `sm` — прежняя компактная кнопка
 * для форм и админки, её внешний вид макет не задаёт.
 *
 * Каждое состояние описано дважды: псевдоклассом (hover:, active:) для жизни
 * и обычным классом для `forceState` — витрина компонентов показывает hover
 * и нажатие статически, без наведения мыши.
 */

import Link from "@/components/page-transition";
import type { ComponentProps } from "react";

export type ForceState = "hover" | "pressed";

/**
 * У каждого варианта полный набор цветов на каждое состояние. Состояния не
 * накладываются друг на друга: иначе, например, светлая рамка обычного
 * состояния спорила бы с бордо-рамкой hover, и победитель зависел бы от
 * порядка классов в собранном CSS.
 */
type VariantStyle = { frame: string; idle: string; hover: string; pressed: string; live: string };

const VARIANTS = {
  // Заливка бордо: большая кнопка героя, основное действие в формах
  primary: {
    frame: "",
    idle: "bg-accent text-canvas",
    hover: "bg-accent-pressed text-canvas",
    pressed: "bg-accent-pressed text-canvas",
    live: "hover:bg-accent-pressed active:bg-accent-pressed",
  },
  // Кремовая кнопка — для тёмного фона и фото
  cream: {
    frame: "",
    idle: "bg-cream text-ink",
    hover: "bg-on-accent text-ink",
    pressed: "bg-on-accent text-ink",
    live: "hover:bg-on-accent active:bg-on-accent",
  },
  // Обводка бордо → hover заливка → нажата тёмный бордо («Вся витрина»)
  outline: {
    frame: "border",
    idle: "border-accent text-accent",
    hover: "border-accent bg-accent text-white",
    pressed: "border-accent-pressed bg-accent-pressed text-white",
    live: "hover:bg-accent hover:text-white active:border-accent-pressed active:bg-accent-pressed",
  },
  // Обводка и текст цвета логотипа на бордо («Подробнее о кондитерской» в блоке Елены)
  "outline-on-accent": {
    frame: "border",
    idle: "border-on-accent text-on-accent",
    hover: "border-on-accent bg-on-accent text-accent",
    pressed: "border-on-accent bg-cream text-accent",
    live: "hover:bg-on-accent hover:text-accent active:bg-cream",
  },
  // Светлая обводка цвета разделителя на бордо — «Заказать свой дизайн» в плашке «Работ» (009)
  "outline-line-on-accent": {
    frame: "border",
    idle: "border-line text-line",
    hover: "border-on-accent bg-on-accent text-accent",
    pressed: "border-on-accent bg-cream text-accent",
    live: "hover:border-on-accent hover:bg-on-accent hover:text-accent active:bg-cream",
  },
  // Та же средняя кнопка на тёмном фоне: светлая обводка
  "outline-dark": {
    frame: "border",
    idle: "border-line text-line",
    hover: "border-accent bg-accent text-white",
    pressed: "border-accent-pressed bg-accent-pressed text-white",
    live: "hover:border-accent hover:bg-accent hover:text-white active:border-accent-pressed active:bg-accent-pressed",
  },
  // Белая обводка поверх фото («Заказать похожий» на карточке работы)
  "outline-white": {
    frame: "border",
    idle: "border-white text-white",
    hover: "border-white bg-white text-ink",
    pressed: "border-white bg-white text-ink",
    live: "hover:bg-white hover:text-ink",
  },
  // Второстепенная кнопка форм и админки
  secondary: {
    frame: "border",
    idle: "border-line-strong bg-surface text-ink",
    hover: "border-ink bg-surface text-ink",
    pressed: "border-ink bg-surface-sunken text-ink",
    live: "hover:border-ink active:bg-surface-sunken",
  },
  ghost: {
    frame: "",
    idle: "text-ink-muted",
    hover: "bg-surface-sunken text-ink",
    pressed: "bg-surface-sunken text-ink",
    live: "hover:bg-surface-sunken hover:text-ink",
  },
  danger: {
    frame: "border",
    idle: "border-accent bg-surface text-danger",
    hover: "border-accent bg-accent-soft text-danger",
    pressed: "border-accent bg-accent-soft text-danger",
    live: "hover:bg-accent-soft",
  },
} satisfies Record<string, VariantStyle>;

const SIZES = {
  // 304×74: 58px полей + 1px рамки даёт ширину макета при тексте «ОТКРЫТЬ ВИТРИНУ»
  lg: "h-[74px] px-[58px] text-button-lg font-normal uppercase",
  // 182×52: 40px полей + 1px рамки при тексте «Вся витрина»
  md: "h-13 px-10 text-button font-semibold",
  // Та же кнопка с полями 24px — низ главной: «Построить маршрут», «Читать все отзывы»
  "md-tight": "h-13 px-6 text-button font-semibold",
  // Она же обычным начертанием — плашка «Не нашли похожий?» (works.png)
  "md-tight-regular": "h-13 px-6 text-button font-normal",
  sm: "min-h-10 px-4 text-sm font-medium",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

export function buttonClass({
  variant = "primary",
  size = "sm",
  forceState,
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  forceState?: ForceState;
  className?: string;
}) {
  const style: VariantStyle = VARIANTS[variant];
  const state = forceState ? style[forceState] : `${style.idle} ${style.live}`;
  return [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "transition-[background-color,border-color,color] duration-150 ease-out-soft",
    "disabled:pointer-events-none disabled:opacity-45",
    SIZES[size],
    style.frame,
    state,
    className,
  ].join(" ");
}

type OwnProps = { variant?: ButtonVariant; size?: ButtonSize; forceState?: ForceState };

export function Button({
  variant,
  size,
  forceState,
  className,
  ...props
}: ComponentProps<"button"> & OwnProps) {
  return <button className={buttonClass({ variant, size, forceState, className })} {...props} />;
}

export function LinkButton({
  variant,
  size,
  forceState,
  className,
  ...props
}: ComponentProps<typeof Link> & OwnProps) {
  return <Link className={buttonClass({ variant, size, forceState, className })} {...props} />;
}
