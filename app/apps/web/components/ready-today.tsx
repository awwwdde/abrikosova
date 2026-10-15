/**
 * Секция «Готово сегодня» — карусель витрины. Одна на главной и на странице 404
 * (010b): тот же заголовок, подзаголовок, стрелки и «Вся витрина», тексты из блока
 * `ready_today` контента главной.
 */

import { Carousel } from "@/components/carousel";
import { ProductCard } from "@/components/product-card";
import { LinkButton } from "@/components/ui";
import type { HomeContent, ProductListItem } from "@/lib/api";
import { typograf } from "@/lib/format";

/** Тексты макета, если блок в админке ещё не заполнен: витрина без заголовка не остаётся. */
export const READY_TODAY_DEFAULTS = {
  title: "Готово сегодня",
  subtitle: "Витрина обновляется каждое утро. Забрать на Гжатской или привезём по Москве",
  cta: { label: "Вся витрина", href: "/catalog?availability=today" },
} satisfies Required<HomeContent>["ready_today"];

/** Запрос товаров для секции: порядок — поле order из админки. */
export const READY_TODAY_QUERY =
  "/catalog/products?availability=today&is_featured=true&page_size=12";

export function ReadyToday({
  content,
  items,
}: {
  content: HomeContent["ready_today"] | null | undefined;
  items: ProductListItem[];
}) {
  if (items.length === 0) return null;
  const block = content ?? READY_TODAY_DEFAULTS;
  return (
    <Carousel
      title={block.title}
      subtitle={block.subtitle}
      itemClassName="w-[78vw] sm:w-[336px]"
      action={
        <LinkButton href={block.cta.href} variant="outline" size="md">
          {typograf(block.cta.label)}
        </LinkButton>
      }
    >
      {items.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </Carousel>
  );
}
