/**
 * Данные меню шапки (014): что показывают мега-меню «Каталог» и «Торты на заказ»
 * и мобильное меню. Без "use client" — собирается на сервере в PublicShell.
 */

import type { CakesHeaderMenu, Category } from "@/lib/api";

export type HeaderMenuData = {
  /** Разделы с подразделами и числом товаров (005b); пустые подразделы скрываются */
  categories: Category[];
  /** Блок «Меню в шапке» страницы «Торты на заказ»; нет — меню без карточек */
  cakes: CakesHeaderMenu | null;
  telegram: string | null;
  /** «Гжатская улица, 5к8 · каждый день с 9:00 до 21:00» — низ мобильного меню */
  addressLine: string | null;
};

/** «Быстрый выбор» мега-меню — фильтры каталога из 005b. */
export const QUICK_LINKS = [
  { href: "/catalog?availability=today", label: "Готово сегодня" },
  { href: "/catalog?dietary=gluten_free", label: "Без глютена" },
  { href: "/catalog?dietary=lactose_free", label: "Без лактозы" },
  { href: "/catalog?dietary=low_sugar", label: "Сниженный сахар" },
] as const;

/** Ссылки справа в «Тортах на заказ» — якоря будущей страницы 008. */
export const CAKES_LINKS = [
  { href: "/custom-cakes", label: "Все дизайны" },
  { href: "/custom-cakes#fillings", label: "Начинки" },
  { href: "/custom-cakes#prices", label: "Цены" },
  { href: "/custom-cakes#how", label: "Как заказать" },
] as const;

/** Подразделы для меню: только с товарами, первым — «Все …» раздела. */
export function menuLinks(category: Category): { href: string; label: string }[] {
  return [
    { href: `/catalog/${category.slug}`, label: category.all_label || "Все" },
    ...category.subcategories
      .filter((sub) => sub.product_count > 0)
      .map((sub) => ({ href: `/catalog/${category.slug}/${sub.slug}`, label: sub.name })),
  ];
}

/** Разделы, в которых есть что показать. */
export function menuCategories(categories: Category[]): Category[] {
  return categories.filter((category) => category.product_count > 0);
}
