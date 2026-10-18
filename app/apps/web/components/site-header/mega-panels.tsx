"use client";

/**
 * Содержимое мега-меню шапки на 1024+ (макет new/design/pages/home.png, кадры
 * «Каталог» и «Торты на заказ» 1512×982, задание 014). Открытие, анимацию
 * и закрытие ведёт шапка (components/layout.tsx), здесь — только раскладка.
 *
 * Размеры на 1512 сняты с кадров: панель «Каталог» — пять колонок с шагом 219
 * и плашка 336 справа, разделитель, «Быстрый выбор» и «Весь каталог»;
 * «Торты на заказ» — четыре карточки 216×270 с шагом 240 и колонка ссылок.
 */

import Image from "next/image";
import Link from "@/components/page-transition";
import { imageUrl } from "@/lib/api";
import { typograf } from "@/lib/format";
import {
  CAKES_LINKS,
  QUICK_LINKS,
  menuCategories,
  menuLinks,
  type HeaderMenuData,
} from "./menu-data";

const LINK = "transition-colors duration-150 hover:text-accent";

export function CatalogPanel({
  categories,
  onNavigate,
}: {
  categories: HeaderMenuData["categories"];
  onNavigate: () => void;
}) {
  return (
    <div className="container-page pt-10 pb-8">
      <div className="grid grid-cols-[repeat(4,minmax(0,195px))_minmax(0,1fr)_336px] gap-x-6 max-xl:grid-cols-[repeat(5,minmax(0,1fr))_260px]">
        {menuCategories(categories).map((category) => (
          <div key={category.slug}>
            {/* Без типографа и уже колонки: в макете «Десерты и / пирожные»,
                «Печенье и / конфеты» — предлог остаётся в первой строке */}
            <h2 className="min-h-14 max-w-[172px] text-[22px] leading-7 text-ink">
              <Link href={`/catalog/${category.slug}`} onClick={onNavigate} className={LINK}>
                {category.name}
              </Link>
            </h2>
            <ul className="mt-3">
              {menuLinks(category).map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={onNavigate}
                    className={`block text-[15px] leading-8 text-ink-muted ${LINK}`}
                  >
                    {typograf(link.label)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="col-start-6 row-start-1 flex h-[382px] flex-col self-start bg-accent px-7 pt-[27px] pb-7 text-on-accent">
          <p className="max-w-[140px] font-display text-[30px] leading-[37px]">
            Торт под ваш повод
          </p>
          {/* Без типографа: в макете «праздник в / офисе» */}
          <p className="mt-3 max-w-[255px] text-[13px] leading-[22px] text-on-accent/75">
            Свадьба, день рождения, праздник в офисе. Соберём вес под число гостей
          </p>
          <Link
            href="/custom-cakes?request=1"
            onClick={onNavigate}
            className="mt-auto flex h-12 items-center justify-center bg-canvas text-[15px] font-medium text-accent transition-colors duration-150 hover:bg-on-accent"
          >
            Заказать торт
          </Link>
        </div>
      </div>

      <div className="mt-[26px] flex items-center justify-between gap-6 border-t border-line pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-0.5 text-sm text-ink-subtle">Быстрый выбор:</span>
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              className="inline-flex h-[38px] items-center border border-line px-[14px] text-sm text-ink transition-colors duration-150 hover:border-accent hover:text-accent"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <Link
          href="/catalog"
          onClick={onNavigate}
          className="inline-flex h-13 w-[188px] shrink-0 items-center justify-center border border-accent text-button font-semibold text-accent transition-colors duration-150 hover:bg-accent hover:text-white"
        >
          Весь каталог
        </Link>
      </div>
    </div>
  );
}

export function CakesPanel({
  cakes,
  onNavigate,
}: {
  cakes: HeaderMenuData["cakes"];
  onNavigate: () => void;
}) {
  const cards = cakes?.cards ?? [];
  return (
    <div className="container-page flex gap-6 pt-10 pb-8">
      {cards.length > 0 ? (
        <ul className="grid flex-1 grid-cols-4 gap-6 xl:max-w-[936px]">
          {cards.map((card) => {
            const src = imageUrl(card.image_key);
            return (
              <li key={card.occasion}>
                <Link
                  href={`/custom-cakes?occasion=${card.occasion}`}
                  onClick={onNavigate}
                  className="group block"
                >
                  <span className="relative block aspect-[4/5] overflow-hidden bg-photo">
                    {src ? (
                      <Image
                        src={src}
                        alt=""
                        fill
                        sizes="(min-width: 1280px) 216px, 20vw"
                        className="object-cover transition-transform duration-500 ease-out-soft group-hover:scale-[1.03]"
                      />
                    ) : null}
                  </span>
                  <span className="mt-[13px] block font-display text-[22px] leading-7 text-ink transition-colors duration-150 group-hover:text-accent">
                    {typograf(card.label)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="w-[280px] shrink-0 pl-px">
        {cakes?.facts ? (
          <p className="text-[13px] leading-5 text-ink-subtle">{typograf(cakes.facts)}</p>
        ) : null}
        <ul className="mt-5">
          {CAKES_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={onNavigate}
                className={`block text-[17px] leading-[38px] text-ink ${LINK}`}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/custom-cakes?request=1"
          onClick={onNavigate}
          className="mt-[25px] inline-flex h-13 items-center justify-center bg-accent px-6 text-[15px] font-semibold text-white transition-colors duration-150 hover:bg-accent-pressed"
        >
          Заказать свой дизайн
        </Link>
      </div>
    </div>
  );
}
