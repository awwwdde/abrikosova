/**
 * Значки шапки (014). Цвет — currentColor: работают в бордовой, светлой
 * и прозрачной шапке и в мобильном меню.
 */

/** «⌄» у пунктов-раскрывашек (открыто — повёрнута вверх) или «›» (`side`). */
export function Chevron({
  open = false,
  side = false,
  large = false,
  className = "",
}: {
  open?: boolean;
  side?: boolean;
  /** Мобильное меню: 13 px вместо 7 */
  large?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 8 5"
      aria-hidden="true"
      fill="none"
      className={`${large ? "h-2 w-[13px]" : "h-[4.5px] w-[7px]"} shrink-0 transition-transform duration-200 ease-out-soft ${
        side ? "-rotate-90" : open ? "rotate-180" : ""
      } ${className}`}
    >
      <path d="M.5.5 4 4 7.5.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/** Сумка — корзина в шапке и меню на телефоне (макет 390). */
export function BagIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="18"
      height="20"
      viewBox="0 0 18 20"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <path d="M1.5 6h15l-1 13h-13l-1-13Z" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6 8V4.5a3 3 0 0 1 6 0V8" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
