"use client";

/**
 * Мобильное меню ниже 1024 по кадрам new/design/pages/home.png (014): 390
 * (телефон) и 834 (планшет). На весь экран, тёмный бордо, сверху логотип,
 * корзина и крестик; пункты Forum с разделителями; «Каталог» и «Торты на заказ»
 * раскрываются на месте («таблетки» подразделов, карточки поводов); низ —
 * телефон, Telegram, адрес и кремовая «Заказать торт».
 *
 * Доступность: role="dialog" aria-modal, фокус заперт внутри и возвращается
 * на бургер, Esc закрывает, прокрутка страницы остановлена (Lenis stop +
 * overflow: hidden), меню прокручивается само. Переход по ссылке закрывает меню.
 */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useLenis } from "@/components/lenis-provider";
import { Logo } from "@/components/logo";
import { NAV_LINKS } from "@/components/nav-links";
import { imageUrl } from "@/lib/api";
import { typograf } from "@/lib/format";
import { BagIcon, Chevron } from "./icons";
import {
  CAKES_LINKS,
  QUICK_LINKS,
  menuCategories,
  menuLinks,
  type HeaderMenuData,
} from "./menu-data";

const PILL =
  "inline-flex h-[45px] items-center border border-on-accent/30 px-4 text-[15px] text-on-accent transition-colors duration-150 hover:border-on-accent sm:h-11";
const ROW =
  "flex w-full items-center justify-between border-b-2 border-on-accent/10 sm:border-b sm:border-on-accent/20 font-display text-2xl text-on-accent sm:text-[33px]";

function Expandable({
  label,
  open,
  onToggle,
  bottom,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  /** Отступ под раскрытым блоком — в макете у «Каталога» и «Тортов» разный */
  bottom: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <li className={open ? "border-b-2 border-on-accent/10 sm:border-b sm:border-on-accent/20" : ""}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className={`${ROW} h-16 sm:h-[72px] ${open ? "border-b-0!" : ""}`}
      >
        {label}
        <Chevron open={open} large className="mr-0.5" />
      </button>
      <div
        id={id}
        inert={!open}
        className={`grid transition-[grid-template-rows] duration-300 ease-out-soft ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className={bottom}>{children}</div>
        </div>
      </div>
    </li>
  );
}

export function MobileMenu({
  open,
  onClose,
  tel,
  count,
  menu,
}: {
  open: boolean;
  onClose: () => void;
  tel: { display: string; href: string } | null;
  count: number;
  menu: HeaderMenuData;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const lenis = useLenis();
  const reduce = useReducedMotion();
  const [expanded, setExpanded] = useState<"catalog" | "cakes" | null>(null);

  useEffect(() => {
    if (!open) {
      setExpanded(null);
      return;
    }
    const previous = document.activeElement as HTMLElement | null;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    lenis?.stop();
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>("a, button")?.focus());
    return () => {
      root.style.overflow = overflow;
      lenis?.start();
      previous?.focus();
    };
  }, [open, lenis]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      // Свёрнутые блоки под inert — в обход фокуса, его и не считаем
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>("a, button")).filter(
        (el) => !el.closest("[inert]"),
      );
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    },
    [onClose],
  );

  const toggle = (key: "catalog" | "cakes") =>
    setExpanded((current) => (current === key ? null : key));
  const cards = menu.cakes?.cards ?? [];

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="mobile-menu"
          ref={panelRef}
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Меню"
          onKeyDown={onKeyDown}
          data-lenis-prevent
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-accent-pressed text-on-accent lg:hidden"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
          transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
        >
          <div className="flex min-h-full flex-col px-4 pb-8 sm:px-8 sm:pb-10">
            <div className="flex h-16 shrink-0 items-center justify-between sm:h-[71px]">
              <Link href="/" onClick={onClose} aria-label="Главная" className="text-on-accent">
                <Logo className="w-[102px] sm:w-[122px]" />
              </Link>
              <div className="flex items-center gap-[15px] sm:gap-[22px]">
                <Link
                  href="/cart"
                  onClick={onClose}
                  className="inline-flex items-center gap-2 text-[15px] text-on-accent sm:text-base"
                >
                  <BagIcon className="sm:hidden" />
                  <span className="max-sm:sr-only">Корзина</span>
                  <span className="tnum text-sm">{count}</span>
                  <span className="sr-only">{typograf(" — товаров в корзине")}</span>
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Закрыть меню"
                  className="-mr-2 inline-flex size-10 items-center justify-center"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M1 1l14 14M15 1L1 15" stroke="currentColor" strokeWidth="1.3" />
                  </svg>
                </button>
              </div>
            </div>

            <nav aria-label="Основное меню" className="mt-[17px] sm:mt-[41px]">
              <ul>
                <Expandable
                  label="Каталог"
                  bottom="pb-[45px]"
                  open={expanded === "catalog"}
                  onToggle={() => toggle("catalog")}
                >
                  {menuCategories(menu.categories).map((category) => (
                    <div key={category.slug} className="mt-7 first:mt-2">
                      <Link
                        href={`/catalog/${category.slug}`}
                        onClick={onClose}
                        className="font-display text-[22px] leading-7 sm:text-2xl"
                      >
                        {typograf(category.name)}
                      </Link>
                      <ul className="mt-[11px] flex flex-wrap gap-x-[9px] gap-y-[7px] sm:mt-[13px] sm:gap-y-2">
                        {menuLinks(category).map((link) => (
                          <li key={link.href}>
                            <Link href={link.href} onClick={onClose} className={PILL}>
                              {typograf(link.label)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <p className="mt-7 text-[13px] text-on-accent/60">Быстрый выбор</p>
                  <ul className="mt-[9px] flex flex-wrap gap-x-[9px] gap-y-[7px]">
                    {QUICK_LINKS.map((link) => (
                      <li key={link.href}>
                        <Link href={link.href} onClick={onClose} className={PILL}>
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/catalog"
                    onClick={onClose}
                    className="mt-[39px] inline-flex items-center gap-4 text-base font-semibold"
                  >
                    Весь каталог <Chevron side className="size-2.5" />
                  </Link>
                </Expandable>

                <Expandable
                  label="Торты на заказ"
                  bottom="pb-[31px] sm:pb-[33px]"
                  open={expanded === "cakes"}
                  onToggle={() => toggle("cakes")}
                >
                  {cards.length > 0 ? (
                    <ul className="mt-1 grid grid-cols-2 gap-x-[17px] gap-y-5 sm:mt-[9px] sm:grid-cols-4 sm:gap-x-4">
                      {cards.map((card) => {
                        const src = imageUrl(card.image_key);
                        return (
                          <li key={card.occasion}>
                            <Link
                              href={`/custom-cakes?occasion=${card.occasion}`}
                              onClick={onClose}
                              className="block"
                            >
                              <span className="relative block aspect-[4/5] bg-on-accent/15">
                                {src ? (
                                  <Image
                                    src={src}
                                    alt=""
                                    fill
                                    sizes="(min-width: 640px) 25vw, 50vw"
                                    className="object-cover"
                                  />
                                ) : null}
                              </span>
                              {/* Без типографа и уже карточки: в макете «Юбилей и / корпоратив» */}
                              <span className="mt-3 block pr-6 font-display text-lg leading-[26px]">
                                {card.label}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                  {menu.cakes?.facts ? (
                    <p className="mt-[21px] text-sm text-on-accent/60 sm:mt-[22px]">
                      {typograf(menu.cakes.facts)}
                    </p>
                  ) : null}
                  <ul className="mt-[22px] flex flex-wrap gap-x-[9px] gap-y-[7px] sm:gap-y-2">
                    {CAKES_LINKS.map((link) => (
                      <li key={link.href}>
                        <Link href={link.href} onClick={onClose} className={PILL}>
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Expandable>

                {NAV_LINKS.slice(2).map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} onClick={onClose} className={`${ROW} h-16 sm:h-[72px]`}>
                      {typograf(link.label)}
                      <Chevron side large className="mr-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="mt-auto pt-12 text-[13px] sm:pt-16 sm:text-sm">
              {tel ? (
                <a href={tel.href} className="flex items-baseline justify-between gap-4">
                  <span className="text-on-accent/60">Позвонить</span>
                  <span className="tnum text-base text-on-accent sm:text-[17px]">
                    {tel.display}
                  </span>
                </a>
              ) : null}
              {menu.telegram ? (
                <a
                  href={menu.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-[27px] flex items-baseline justify-between gap-4 sm:mt-[31px]"
                >
                  <span className="text-on-accent/60">Написать</span>
                  <span className="text-[17px] text-on-accent">Telegram</span>
                </a>
              ) : null}
              {menu.addressLine ? (
                <p className="mt-[13px] text-on-accent/60 sm:mt-[28px]">
                  {typograf(menu.addressLine)}
                </p>
              ) : null}
              <Link
                href="/custom-cakes?request=1"
                onClick={onClose}
                className="mt-[18px] flex h-14 items-center justify-center bg-on-accent sm:mt-[30px] text-base font-medium text-accent transition-colors duration-150 hover:bg-white"
              >
                Заказать торт
              </Link>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
