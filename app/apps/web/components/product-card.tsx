"use client";

/**
 * Карточка товара по макету: фото 4:5 на подложке `photo`, метки ограничений
 * столбиком в правом верхнем углу, название Forum 32, короткий состав, строка
 * «подкатегория · вес · порции», линия, цена и круглая «+». Одна карточка
 * на главную и каталог; различается только серая строка — параметр `meta`
 * (правила — lib/product-meta.ts).
 *
 * Состояния: обычная; hover — название бордо и «+» залит; «в корзине» —
 * галочка и подпись; товар под заказ — вместо «+» срок готовности капсом
 * («БУДЕТ ЗАВТРА», для 2+ дней «ЧЕРЕЗ N ДНЕЙ» — на макете такого нет, сделано
 * по аналогии). Позицию под заказ из карточки в корзину не кладём: дата
 * получения выбирается при оформлении, а срок покупатель должен увидеть.
 *
 * «+» кладёт в корзину, только если выбирать нечего: один вариант и без
 * надписи. Иначе это ссылка на страницу товара — выбрать вес и надпись (005b).
 *
 * Без фото — название серым по центру бежевой подложки, как на макете каталога.
 * Нижняя часть прижата к низу, текстовый блок — не ниже двух строк названия:
 * длинное название в две строки не сдвигает ряд цен (находка 004, макет каталога).
 */

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/cart-context";
import { Picture, PlusButton, PlusIcon, Price, Tag } from "@/components/ui";
import { DIETARY_LABELS, type ProductListItem } from "@/lib/api";
import { formatReadyIn, typograf } from "@/lib/format";
import { cardMetaParts, hasPriceRange, needsChoice, type CardMeta } from "@/lib/product-meta";

export type ProductCardState = "hover" | "in-cart";

export function ProductCard({
  product,
  meta = "home",
  forceState,
  sizes = "(min-width: 1024px) 336px, (min-width: 640px) 45vw, 80vw",
  priority = false,
}: {
  product: ProductListItem;
  /** Серая строка: «фирменная позиция · 1200 г» (главная) или «пироги · 1,2 кг» (каталог). */
  meta?: CardMeta;
  /** Для витрины компонентов: показать hover или «в корзине» без взаимодействия. */
  forceState?: ProductCardState;
  sizes?: string;
  /** Первый ряд сетки: фото — LCP-элемент страницы, грузим без lazy и с высоким приоритетом (009) */
  priority?: boolean;
}) {
  const { cart, addItem } = useCart();
  const [busy, setBusy] = useState(false);
  const inCart =
    forceState === "in-cart" || Boolean(cart?.items.some((item) => item.product_id === product.id));
  const hovered = forceState === "hover";
  const readyIn = formatReadyIn(product.lead_time_days);
  const href = `/product/${product.slug}`;
  const variant = product.variants[0];
  const choose = needsChoice(product);
  const parts = cardMetaParts(product, meta);

  async function handleAdd() {
    if (!variant) return;
    setBusy(true);
    try {
      await addItem(variant.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="group/card flex h-full flex-col">
      <Link href={href} className="relative block" tabIndex={-1} aria-hidden="true">
        <Picture
          storageKey={product.main_image}
          alt=""
          ratio="4/5"
          sizes={sizes}
          priority={priority}
          placeholderLabel={product.name}
        />
        {product.dietary.length > 0 ? (
          // На узкой карточке длинная метка («СНИЖЕННЫЙ САХАР») не помещалась (004,
          // находка 5): ниже 640 метки уже и с меньшей разрядкой
          <div className="absolute top-2 right-2 flex max-w-[calc(100%-1rem)] flex-col items-end gap-1.5 sm:top-3 sm:right-3">
            {product.dietary.map((tag) => (
              <Tag key={tag}>{typograf(DIETARY_LABELS[tag])}</Tag>
            ))}
          </div>
        ) : null}
      </Link>

      {/* Текстовый блок не ниже двух строк названия: линия и цена у карточек ряда
          стоят на одной высоте, и название в две строки ряд не раздвигает — запас
          под вторую строку берётся из отступа над линией (макет каталога, 005b) */}
      {/* 122,8 — ровно прежняя высота одной строки названия с составом и мета на
          главной (главная не должна сдвинуться); в каталоге 123 — по макету каталога */}
      <div
        className={`mt-[18px] max-sm:mt-3 ${meta === "catalog" ? "sm:min-h-[123px]" : "sm:min-h-[122.8px]"}`}
      >
        {/* В каталоге названия бывают в две строки: межстрочный 36 вместо 36,8,
            чтобы две строки уложились в блок и не раздвинули ряд (на главной
            названия в одну строку, там высота как была) */}
        <h3 className={`text-item max-sm:text-xl ${meta === "catalog" ? "sm:leading-9" : ""}`}>
          <Link
            href={href}
            className={`transition-colors duration-150 ease-out-soft ${
              hovered ? "text-accent" : "text-ink group-hover/card:text-accent"
            }`}
          >
            {typograf(product.name)}
          </Link>
        </h3>
        {product.card_ingredients ? (
          <p className="mt-0.5 text-meta text-ink-muted max-sm:text-xs max-sm:leading-5">
            {typograf(product.card_ingredients)}
          </p>
        ) : null}
        {parts.length > 0 ? (
          <p className="text-meta font-light text-ink-subtle max-sm:text-xs max-sm:leading-5">
            {typograf(parts.join(" · "))}
          </p>
        ) : null}
      </div>

      <div className="mt-auto pt-2 max-sm:pt-5">
        <div className="flex items-center justify-between gap-3 border-t border-line pt-4 max-sm:pt-3">
          <div className="flex min-h-10 flex-col justify-center">
            <span className="text-price font-bold tracking-price text-ink max-sm:text-lg">
              {hasPriceRange(product.variants) ? "от " : null}
              <Price value={product.price_from} />
            </span>
            {inCart ? <span className="text-xs font-light text-accent">В корзине</span> : null}
          </div>

          {readyIn ? (
            <span className="text-right text-caps font-medium tracking-ready text-ink-subtle uppercase max-sm:text-2xs">
              {typograf(readyIn)}
            </span>
          ) : choose ? (
            <Link
              href={href}
              aria-label={`Выбрать вес — ${product.name}`}
              className={[
                "inline-flex size-10 shrink-0 origin-right items-center justify-center rounded-full",
                "transition-[background-color,border-color,color,scale] duration-150 ease-out-soft",
                hovered
                  ? "scale-110 border border-accent bg-accent text-white"
                  : "border border-line text-accent hover:scale-110 hover:border-accent hover:bg-accent hover:text-white group-hover/card:scale-110 group-hover/card:border-accent group-hover/card:bg-accent group-hover/card:text-white",
              ].join(" ")}
            >
              <PlusIcon />
            </Link>
          ) : (
            <PlusButton
              added={inCart}
              forceState={hovered ? "hover" : undefined}
              disabled={busy || inCart || !product.is_available}
              onClick={handleAdd}
              aria-label={
                inCart ? `«${product.name}» уже в корзине` : `Добавить «${product.name}» в корзину`
              }
            />
          )}
        </div>
      </div>
    </article>
  );
}
