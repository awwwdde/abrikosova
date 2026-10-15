"use client";

/**
 * «К торту часто берут» (007b, кадры «Корзина» и «Допродажа»): до четырёх карточек
 * из `GET /cart/upsell` — фото 219×164, название, короткий состав, цена и круглая «+».
 *
 * Список берётся один раз, когда страница открылась: иначе положенный товар сразу
 * исчезал бы из предложения (сервер не предлагает то, что уже в корзине). Положенный —
 * бордовый круг с галочкой; повторное нажатие ничего не делает, убрать — «Удалить»
 * в списке выше, и «+» вернётся. Пустой ответ (в корзине нет торта) — блока нет.
 */

import Image from "next/image";
import { useEffect, useState } from "react";
import { useCart } from "@/components/cart-context";
import { ApiError, apiFetch, imageUrl, type ProductListItem } from "@/lib/api";
import { typograf } from "@/lib/format";

const money = (value: string) =>
  `${Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`;

export function Upsell({
  initialItems,
  inCart,
  hasCake,
  onMessage,
}: {
  /** Список с сервера; null — сервер его не получил, запрашиваем из браузера */
  initialItems: ProductListItem[] | null;
  /** id товаров в корзине: у них галочка вместо «+» */
  inCart: Set<number>;
  /** В корзине есть торт: без него блок не нужен, и запрос не делаем */
  hasCake: boolean;
  onMessage: (text: string) => void;
}) {
  const { addItem } = useCart();
  const [items, setItems] = useState<ProductListItem[]>(initialItems ?? []);
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    // Пустой ответ сервера — тоже ответ: повторно не спрашиваем
    if (!hasCake || items.length > 0 || initialItems) return;
    let cancelled = false;
    apiFetch<ProductListItem[]>("/cart/upsell")
      .then((list) => !cancelled && setItems(list))
      .catch(() => {
        // Допродажа — не главное на странице: без неё оформить заказ можно
      });
    return () => {
      cancelled = true;
    };
  }, [hasCake, items.length, initialItems]);

  if (!hasCake || items.length === 0) return null;

  async function add(product: ProductListItem) {
    const variant = product.variants[0];
    if (!variant || inCart.has(product.id)) return;
    setBusy(product.id);
    try {
      await addItem(variant.id);
    } catch (error) {
      onMessage(error instanceof ApiError ? error.message : "Не удалось добавить");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="upsell-title" className="mt-[34px]">
      <h2 id="upsell-title" className="text-[14px] leading-5 font-medium text-ink-subtle">
        К торту часто берут
      </h2>
      <ul className="mt-[13px] grid grid-cols-2 gap-x-3 gap-y-6 lg:grid-cols-4">
        {items.map((product) => {
          const src = imageUrl(product.main_image);
          const added = inCart.has(product.id);
          return (
            <li key={product.id} className="flex flex-col">
              <div className="relative aspect-[219/164] overflow-hidden bg-photo">
                {src ? (
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 219px, 45vw"
                    className="object-cover"
                  />
                ) : null}
              </div>
              <h3 className="mt-[6px] text-[14px] leading-5 font-semibold text-ink">
                {typograf(product.name)}
              </h3>
              {product.card_ingredients ? (
                <p className="mt-[7px] truncate border-b border-line pb-[6px] text-[12px] leading-4 text-ink-subtle">
                  {typograf(product.card_ingredients)}
                </p>
              ) : null}
              <div className="mt-[9px] flex items-center justify-between">
                <span className="text-[16px] font-bold text-ink tabular-nums">
                  {money(product.price_from)}
                </span>
                <button
                  type="button"
                  onClick={() => void add(product)}
                  disabled={busy === product.id}
                  aria-pressed={added}
                  aria-label={
                    added ? `«${product.name}» в корзине` : `Добавить «${product.name}» в корзину`
                  }
                  className={`flex size-10 items-center justify-center rounded-full border transition-colors duration-150 ${
                    added
                      ? "cursor-default border-accent bg-accent text-canvas"
                      : "border-line text-accent hover:border-accent hover:bg-accent hover:text-canvas"
                  }`}
                >
                  {added ? (
                    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4">
                      <path
                        d="M3 8.5l3 3 7-7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />
                    </svg>
                  ) : (
                    <span aria-hidden="true" className="text-[15px] leading-none">
                      +
                    </span>
                  )}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
