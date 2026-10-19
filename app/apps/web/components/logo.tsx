/**
 * Логотип «ELENA ABRIKOSOVA» с венчиком — инлайн-SVG (задание 014).
 *
 * Раньше это был PNG через `mask-image`: браузер узнавал о картинке только после
 * загрузки CSS, и Lighthouse называл логотип элементом LCP с задержкой отрисовки.
 * Единственный контур находится в корневом layout; use рисуется без отдельного
 * запроса и не повторяет длинный путь в шапке, подвале и клиентском JavaScript.
 *
 * Цвет — `currentColor`: один знак работает в бордовой, светлой и прозрачной
 * шапке и в подвале. Контур — components/logo-path.ts (трассировка PNG из
 * new/design/logo.svg, см. комментарий там). Размер 160×44,46 — как в макете.
 */

export function Logo({
  className = "",
  fit = "contain",
}: {
  className?: string;
  /**
   * `fill` растягивает знак на заданные ширину и высоту. Нужен подвалу: там
   * на макете логотип 159×41 — ниже, чем пропорция знака (161×44,5 в шапке).
   */
  fit?: "contain" | "fill";
}) {
  return (
    <svg
      role="img"
      aria-label="Елена Абрикосова"
      viewBox="0 0 160 44.4588"
      preserveAspectRatio={fit === "fill" ? "none" : "xMinYMid meet"}
      className={`block w-40 ${fit === "contain" ? "aspect-[160/44.4588] h-auto" : ""} ${className}`}
    >
      <use href="#site-logo-path" fill="currentColor" />
    </svg>
  );
}
