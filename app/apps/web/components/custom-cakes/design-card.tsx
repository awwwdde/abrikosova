/**
 * Карточка дизайна торта на заказ (008b, кадры «список» и «состояния»):
 * фото «Целиком» 4:5, метка повода, название Forum, «3 яруса · от 40 гостей»,
 * линия, «от 27 000 ₽» и контурная «Заказать».
 *
 * Вся карточка — ссылка на `/custom-cakes/<slug>`: название растянуто на карточку
 * (after:inset-0), так у ссылки короткое имя — название дизайна. «Заказать» — та же
 * ссылка поверх растяжки: у неё своё состояние наведения (заливка), но для
 * клавиатуры и скринридера она дубль, поэтому tabIndex -1 и aria-hidden.
 * Наведение на карточку красит название в бордо (кадр «состояния»).
 */

import Link from "next/link";
import { Picture, buttonClass } from "@/components/ui";
import { formatPrice, type CustomCakeCard } from "@/lib/api";
import { formatDesignMeta, typograf } from "@/lib/format";

export function DesignCard({
  card,
  priority = false,
}: {
  card: CustomCakeCard;
  priority?: boolean;
}) {
  const href = `/custom-cakes/${card.slug}`;
  return (
    <article className="group/design relative">
      <Picture
        storageKey={card.image_key}
        alt=""
        ratio="4/5"
        sizes="(min-width: 1280px) 336px, (min-width: 1024px) 30vw, (min-width: 640px) 46vw, 92vw"
        priority={priority}
        placeholderLabel={card.title}
      />
      <p className="mt-[18px] text-caps font-semibold tracking-caps text-accent uppercase">
        {typograf(card.occasion_label)}
      </p>
      <h3 className="mt-[5px] font-display text-[28px] leading-[34px] text-ink transition-colors duration-150 ease-out-soft group-focus-within/design:text-accent group-hover/design:text-accent">
        <Link
          href={href}
          className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-accent"
        >
          {typograf(card.title)}
        </Link>
      </h3>
      <p className="mt-[4px] text-[14px] leading-5 font-light text-ink-muted">
        {typograf(formatDesignMeta(card.tiers, card.min_guests))}
      </p>
      <div className="mt-[19px] flex items-center justify-between gap-3 border-t border-line pt-[14px]">
        <p className="text-[18px] leading-6 font-semibold text-ink tabular-nums">
          от {formatPrice(card.price_from)}
        </p>
        <Link
          href={href}
          tabIndex={-1}
          aria-hidden="true"
          className={buttonClass({
            variant: "outline",
            size: "sm",
            className: "relative z-10 h-10 min-h-10 w-[97px] px-0 text-[14px] font-normal",
          })}
        >
          Заказать
        </Link>
      </div>
    </article>
  );
}

/** Первая ячейка сетки — бордовая «Торт по вашей идее» со ссылкой на окно заявки (008c). */
export function IdeaCard({ text }: { text: string | null }) {
  return (
    <article className="flex h-full min-h-[420px] flex-col bg-accent-pressed p-8 text-canvas xl:min-h-[593px]">
      <h3 className="font-display text-[30px] leading-9">Торт по вашей идее</h3>
      {text ? (
        <p className="mt-[16px] text-[14px] leading-6 text-canvas/75">{typograf(text)}</p>
      ) : null}
      <Link
        href="/custom-cakes?request=1"
        scroll={false}
        className="mt-auto inline-flex h-[52px] w-fit items-center bg-on-accent px-[16px] text-[15px] font-medium text-accent transition-colors duration-150 hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-accent"
      >
        Заказать свой дизайн
      </Link>
    </article>
  );
}
