/**
 * Строка карточки товара «подкатегория · вес · порции» и цена «от» (005a, 005b).
 *
 * Две подачи — явным параметром карточки, а не условием по адресу:
 * - `catalog` (макет каталога): название подкатегории строчными, вес от 1000 г —
 *   в килограммах с запятой: «пироги · 1,2 кг · 10–12 порций»;
 * - `home` (макет главной): `card_label`, если задан («фирменная позиция»), вес
 *   в граммах: «фирменная позиция · 1200 г · 10–12 порций».
 *
 * У товара с несколькими весами — диапазоны по всем включённым вариантам
 * (их и отдаёт API): «1–2 кг · 8–20 порций». Порции — по тем вариантам,
 * у которых они есть.
 */

import type { ProductListItem } from "./api";
import { pluralRu } from "./format";

export type CardMeta = "home" | "catalog";

type Variant = Pick<
  ProductListItem["variants"][number],
  "price" | "weight_grams" | "portions_min" | "portions_max"
>;

/** 1000 → «1», 1200 → «1,2», 1250 → «1,25». */
function kilos(grams: number): string {
  return String(Math.round(grams) / 1000).replace(".", ",");
}

/**
 * Диапазон весов. В граммах (главная) — «450–900 г»; в каталоге от 1000 г —
 * килограммы: «1–2 кг», «1,2 кг», а смешанный — «450 г – 1,2 кг».
 */
export function formatWeightRange(grams: number[], mode: CardMeta): string | null {
  const list = grams.filter((value) => value > 0);
  if (list.length === 0) return null;
  const low = Math.min(...list);
  const high = Math.max(...list);
  const kg = (value: number) => mode === "catalog" && value >= 1000;
  const one = (value: number) => (kg(value) ? `${kilos(value)} кг` : `${value} г`);
  if (low === high) return one(low);
  if (kg(low) && kg(high)) return `${kilos(low)}–${kilos(high)} кг`;
  if (!kg(low) && !kg(high)) return `${low}–${high} г`;
  return `${one(low)} – ${one(high)}`;
}

/** «8–20 порций» по всем вариантам с порциями; «1 порция»; нет порций — null. */
export function formatPortionsRange(variants: Variant[]): string | null {
  const withPortions = variants.filter(
    (variant) => variant.portions_min != null && variant.portions_max != null,
  );
  if (withPortions.length === 0) return null;
  const low = Math.min(...withPortions.map((variant) => variant.portions_min!));
  const high = Math.max(...withPortions.map((variant) => variant.portions_max!));
  const range = low === high ? `${low}` : `${low}–${high}`;
  return `${range} ${pluralRu(high, ["порция", "порции", "порций"])}`;
}

/** Части серой строки карточки, без пустых. Склеивает их « · » карточка. */
export function cardMetaParts(
  product: Pick<ProductListItem, "card_label" | "subcategory" | "variants">,
  mode: CardMeta,
): string[] {
  const label =
    mode === "home" && product.card_label
      ? product.card_label
      : product.subcategory.name.toLocaleLowerCase("ru-RU");
  const weights = product.variants
    .map((variant) => variant.weight_grams)
    .filter((value): value is number => value != null);
  return [label, formatWeightRange(weights, mode), formatPortionsRange(product.variants)].filter(
    (part): part is string => Boolean(part),
  );
}

/** Цены вариантов различаются — цена пишется «от 2 400 ₽». */
export function hasPriceRange(variants: readonly Pick<Variant, "price">[]): boolean {
  return new Set(variants.map((variant) => Number(variant.price))).size > 1;
}

/**
 * Что делает «+» в карточке: кладёт в корзину, если выбирать нечего (один вариант
 * и без надписи), иначе ведёт на страницу товара выбрать вес и надпись.
 */
export function needsChoice(product: Pick<ProductListItem, "variants" | "allows_inscription">) {
  return product.variants.length !== 1 || product.allows_inscription;
}
