/**
 * Начинка торта на заказ — общий код для «Вкуса изнутри» на главной и блока
 * «Начинки» страницы «Торты на заказ» (008b). Раскладки у блоков разные (на главной
 * нумерованный список с одним большим фото, на странице — сетка карточек), поэтому
 * общие здесь фото начинки (`FillingPhoto`) и карточка сетки (`FillingCard`).
 */

import Image from "next/image";
import { Picture, Tag } from "@/components/ui";
import { imageUrl, type CakeFilling } from "@/lib/api";
import { typograf } from "@/lib/format";

/** Фото начинки на всю площадь родителя; без фото — ничего (плашку даёт родитель). */
export function FillingPhoto({
  filling,
  sizes,
  className = "",
  decorative = false,
}: {
  filling: CakeFilling;
  sizes: string;
  className?: string;
  /** Фото в стопке, где видно одно: у скрытых пустой alt */
  decorative?: boolean;
}) {
  const src = imageUrl(filling.image_key);
  if (!src) return null;
  return (
    <Image
      src={src}
      alt={decorative ? "" : filling.name}
      fill
      sizes={sizes}
      className={`object-cover ${className}`}
    />
  );
}

/**
 * Карточка сетки «Начинки» по кадру custom-cakes.png: фото 1:1, название Forum,
 * короткое описание и метки состава («СНИЖЕННЫЙ САХАР»).
 */
export function FillingCard({
  filling,
  priority = false,
}: {
  filling: CakeFilling;
  priority?: boolean;
}) {
  return (
    <article>
      <Picture
        storageKey={filling.image_key}
        alt={filling.name}
        ratio="1/1"
        sizes="(min-width: 1280px) 336px, (min-width: 640px) 45vw, 92vw"
        priority={priority}
        placeholderLabel={filling.name}
      />
      <h3 className="mt-[14px] font-display text-[22px] leading-[30px] text-ink">
        {typograf(filling.name)}
      </h3>
      <p className="mt-[7px] text-[14px] leading-5 text-ink-muted">
        {typograf(filling.short_description)}
      </p>
      {filling.dietary_labels.length > 0 ? (
        <ul className="mt-[9px] flex flex-wrap gap-2">
          {filling.dietary_labels.map((label) => (
            <li key={label}>
              <Tag>{label}</Tag>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
