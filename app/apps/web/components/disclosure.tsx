"use client";

/**
 * Раскрывающийся блок: вопросы на главной (004e) и блоки страницы товара (006).
 * Вынесен из «Вопросов», чтобы аккордеон был один.
 *
 * Заголовок — кнопка с `aria-expanded` и `aria-controls` внутри заголовка нужного
 * уровня; содержимое — `region`, подписанный заголовком. Свёрнутое содержимое
 * остаётся в разметке (для поисковиков), но недоступно скринридеру и фокусу
 * (`inert`). Раскрытие — переход высоты через grid-template-rows: без замера
 * в JS и без прыжка соседних блоков.
 */

import { useEffect, useId, useState, type ReactNode } from "react";

/**
 * «+» / «−» бордо справа: вертикальная черта схлопывается при раскрытии.
 * Размер: вопросы главной — 14px, блоки страницы товара — 20px (по макетам).
 */
export function DisclosureIcon({
  open,
  size = 14,
  className = "",
}: {
  open: boolean;
  size?: number;
  className?: string;
}) {
  const middle = size / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      className={`shrink-0 text-accent ${className}`}
    >
      <path d={`M0 ${middle + 0.5}h${size}`} stroke="currentColor" />
      <path
        d={`M${middle} 0v${size}`}
        stroke="currentColor"
        className={`origin-center transition-transform duration-300 ease-out-soft ${
          open ? "scale-y-0" : ""
        }`}
      />
    </svg>
  );
}

export function Disclosure({
  title,
  open,
  onToggle,
  heading: Heading = "h3",
  headingClassName = "",
  buttonClassName = "",
  icon,
  panelClassName = "",
  children,
}: {
  title: ReactNode;
  open: boolean;
  onToggle: () => void;
  /** Уровень заголовка: вопросы главной — h3, блоки страницы товара — h2 */
  heading?: "h2" | "h3";
  headingClassName?: string;
  buttonClassName?: string;
  /** Значок «+» / «−»; по умолчанию — справа в строке заголовка */
  icon?: ReactNode;
  panelClassName?: string;
  children: ReactNode;
}) {
  const id = useId();
  const buttonId = `${id}-button`;
  const panelId = `${id}-panel`;
  // Без JS свернуть обратно нечем — поэтому свёрнутое состояние включается только
  // при `html.js` (класс ставит загрузочный скрипт до первой отрисовки, без мигания),
  // а inert — после гидратации. Без JS ответы раскрыты и читаются (008b)
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  return (
    <>
      <Heading className={headingClassName}>
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className={`group flex w-full items-start justify-between gap-6 text-left ${buttonClassName}`}
        >
          {title}
          {icon ?? <DisclosureIcon open={open} />}
        </button>
      </Heading>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        inert={hydrated && !open}
        className={`grid transition-[grid-template-rows] duration-300 ease-out-soft motion-reduce:transition-none ${
          open ? "grid-rows-[1fr]" : "grid-rows-[1fr] [.js_&]:grid-rows-[0fr]"
        } ${panelClassName}`}
      >
        <div className="min-h-0 overflow-hidden">{children}</div>
      </div>
    </>
  );
}
