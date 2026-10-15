/**
 * Карточка работы («Сделано на заказ») по макету: фото 4:5 (456×570 на 1512),
 * подпись капсом бордо «ПОВОД · МЕСЯЦ ГОД», название Forum 32 и строка
 * «ярусы · вес · гости».
 *
 * Hover: второй кадр («срез или деталь») проявляется поверх первого, снизу
 * градиент и кнопка «Заказать похожий» с белой обводкой, название — бордо.
 * Второй кадр необязателен (`detail_image_key`): без него фото в hover не
 * меняется, остальное работает так же. Подпись повода — из `GET /catalog/filters`
 * (`occasionLabel`), без неё — из локального справочника.
 *
 * Наведение — только на устройствах с hover (`hover:` в Tailwind 4 сам обёрнут
 * в `@media (hover: hover)`); фокус клавиатуры на карточке показывает то же.
 * На телефоне и планшете (`touchLink`, страница «Работ», 009) «Заказать похожий» —
 * текстовой ссылкой под характеристиками, а оверлей с кнопкой не показывается.
 */

import Link from "next/link";
import { Picture, buttonClass } from "@/components/ui";
import { OCCASION_LABELS, type Occasion } from "@/lib/api";
import { formatMonthYear, formatWorkMeta } from "@/lib/format";
import { typograf } from "@/lib/format";

export function WorkCard({
  title,
  image,
  secondImage,
  occasion,
  occasionLabel,
  madeIn,
  tiers,
  weightGrams,
  guests,
  orderHref = "/custom-cakes",
  forceState,
  sizes = "(min-width: 1024px) 456px, 80vw",
  titleClassName = "text-item",
  placeholderLabel,
  touchLink = false,
  priority = false,
}: {
  title: string;
  image: string | null;
  secondImage?: string | null;
  occasion?: Occasion | null;
  /** Подпись повода из справочника API; если нет — локальная */
  occasionLabel?: string | null;
  madeIn?: string | null;
  tiers?: number | null;
  weightGrams?: number | null;
  guests?: number | null;
  orderHref?: string;
  forceState?: "hover";
  sizes?: string;
  /** Кегль названия: на главной Forum 32, в «Работах» по своему макету */
  titleClassName?: string;
  /** Подпись бежевой плашки без фото (как в каталоге) */
  placeholderLabel?: string;
  /** Без hover — «Заказать похожий» ссылкой под карточкой (009) */
  touchLink?: boolean;
  /** Первый ряд «Работ»: фото — LCP-элемент, грузим без lazy (009) */
  priority?: boolean;
}) {
  const hovered = forceState === "hover";
  const caption = [
    occasionLabel ?? (occasion ? OCCASION_LABELS[occasion] : null),
    madeIn ? formatMonthYear(madeIn) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const meta = formatWorkMeta(tiers, weightGrams, guests);

  return (
    <article className="group/work">
      <div className="relative">
        <Picture
          storageKey={image}
          alt={title}
          ratio="4/5"
          sizes={sizes}
          priority={priority}
          placeholderLabel={placeholderLabel}
        />
        {secondImage ? (
          <div
            className={`absolute inset-0 transition-opacity duration-300 ease-out-soft ${
              hovered
                ? "opacity-100"
                : "opacity-0 group-focus-within/work:opacity-100 group-hover/work:opacity-100"
            }`}
          >
            <Picture storageKey={secondImage} alt="" ratio="4/5" sizes={sizes} />
          </div>
        ) : null}

        {/* Градиент и кнопка: снизу ~30% высоты, затемнение до трети — по макету */}
        <div
          className={`absolute inset-x-0 bottom-0 flex h-[30%] items-end justify-center bg-linear-to-b from-transparent to-night/35 pb-6 transition-opacity duration-300 ease-out-soft ${
            touchLink ? "[@media(hover:none)]:hidden" : ""
          } ${
            hovered
              ? "opacity-100"
              : "opacity-0 group-focus-within/work:opacity-100 group-hover/work:opacity-100"
          }`}
        >
          <Link
            href={orderHref}
            aria-label={`Заказать похожий: ${title}`}
            className={buttonClass({
              variant: "outline-white",
              className: "h-12 px-6 text-base font-medium",
            })}
          >
            {typograf("Заказать похожий")}
          </Link>
        </div>
      </div>

      {caption ? (
        <p className="mt-[19px] text-caps font-semibold tracking-caps text-accent uppercase">
          {typograf(caption)}
        </p>
      ) : null}
      {/* Название в одну строку: иначе длинное название в две строки делает всю
          ленту выше (высота flex-ленты — по самой высокой карточке). Полное название —
          в title, у фото в alt и в aria-label кнопки заказа. */}
      <h3
        title={title}
        className={`mt-[10px] line-clamp-1 transition-colors duration-150 ease-out-soft ${titleClassName} ${
          hovered
            ? "text-accent"
            : "text-ink group-focus-within/work:text-accent group-hover/work:text-accent"
        }`}
      >
        {typograf(title)}
      </h3>
      {meta ? (
        <p className="mt-[7px] text-meta font-light text-ink-muted">{typograf(meta)}</p>
      ) : null}
      {touchLink ? (
        // Видна ровно одна из двух ссылок: без hover оверлей скрыт (display: none),
        // с hover — эта ссылка; поэтому для скринридера и клавиатуры дублей нет
        <Link
          href={orderHref}
          aria-label={`Заказать похожий: ${title}`}
          className="mt-2 hidden text-sm font-medium text-accent underline underline-offset-4 [@media(hover:none)]:inline-block"
        >
          {typograf("Заказать похожий")}
        </Link>
      ) : null}
    </article>
  );
}
