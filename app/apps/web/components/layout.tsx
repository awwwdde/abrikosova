"use client";

/**
 * Шапка публичной части (подвал — components/footer.tsx).
 *
 * Шапка — по макету (components.png, три полосы сверху; 1512.png): логотип,
 * меню из пяти пунктов, «Корзина N», телефон и кнопка «ЗАКАЗАТЬ ТОРТ».
 * Рейтинга, поиска и часов работы в макете нет — и здесь их нет.
 *
 * Высота — токены `--header-h` (130px наверху страницы) и `--header-h-compact`
 * (118px после прокрутки на 40px, вариант `light`): заказчик после ревью 003
 * опустил верхнюю высоту со 160 до 130. Наверху на главной
 * шапка прозрачная поверх героя (элемент с `data-hero`), ниже героя — `light`.
 * На всех внутренних страницах — бордовая (`accent`) и сразу 118px: так в макетах
 * каталога (005b) и во всех макетах 09.10 (010b), включая страницу товара.
 *
 * Чтобы смена высоты не двигала контент, шапка `fixed`, а место под неё
 * держит пустой блок высоты `--header-h` (на главной с героем — 0:
 * герой уходит под прозрачную шапку).
 *
 * Координаты по горизонтали сняты с макета 1512: логотип 161px от поля,
 * меню от x=300 с шагом 40px, справа «Корзина» → 32px → телефон → 32px →
 * кнопка 201×52. По вертикали всё по центру в обеих высотах.
 *
 * Мега-меню (014, кадры home.png): «Каталог ⌄» и «Торты на заказ ⌄» — шаблон
 * disclosure navigation: `button aria-expanded aria-controls`, внутри обычные
 * ссылки, без role="menu". Открываются кликом (не наведением), Enter/пробелом;
 * Esc закрывает и возвращает фокус на пункт. Пока меню открыто, шапка светлая
 * (вариант `light`), под ней затемнение страницы. Закрывают меню клик вне его,
 * переход по ссылке, Esc и прокрутка больше 80px. До гидрации (и без JS)
 * пункты — обычные ссылки на /catalog и /custom-cakes.
 *
 * Полная шапка — с 1024 (кадр 1194: без телефона, мельче), ниже — бургер
 * и мобильное меню (components/site-header/mobile-menu.tsx).
 */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/cart-context";
import { Logo } from "@/components/logo";
import { NAV_LINKS } from "@/components/nav-links";
import { BagIcon, Chevron } from "@/components/site-header/icons";
import { CakesPanel, CatalogPanel } from "@/components/site-header/mega-panels";
import type { HeaderMenuData } from "@/components/site-header/menu-data";
import { MobileMenu } from "@/components/site-header/mobile-menu";
import { formatPhone, typograf } from "@/lib/format";

export type HeaderVariant = "transparent" | "accent" | "light";

const THEMES: Record<
  HeaderVariant,
  { bar: string; logo: string; nav: string; secondary: string; button: string }
> = {
  light: {
    bar: "bg-canvas",
    logo: "text-ink",
    nav: "text-ink hover:text-accent",
    secondary: "text-ink hover:text-accent",
    button: "border-ink text-ink hover:border-accent hover:bg-accent hover:text-white",
  },
  // Пункты меню обычного начертания, текущий раздел — полужирный (005b) и
  // подчёркнутый (макеты 09.10: «О нас», «Контакты»). Страница внутри раздела
  // (товар в «Каталоге», 006b) — полужирный пункт без подчёркивания: aria-current="true"
  accent: {
    bar: "bg-accent",
    logo: "text-on-accent",
    nav: "font-normal text-white hover:text-on-accent aria-[current=page]:font-semibold aria-[current=page]:text-white aria-[current=page]:underline aria-[current=page]:underline-offset-2 aria-[current=true]:font-semibold aria-[current=true]:text-white",
    secondary: "font-normal text-on-accent hover:text-white",
    button: "border-on-accent text-on-accent hover:bg-on-accent hover:text-accent",
  },
  transparent: {
    bar: "bg-transparent",
    // Ниже 1280 — кремовый on-accent, как в кадрах главной 1194/834/390 (014);
    // с 1280 — белый и светлый, как в кадре 1512
    logo: "text-on-accent xl:text-canvas",
    nav: "text-on-accent xl:text-white hover:text-on-accent",
    // Ниже 1280 — без прозрачности: так «Корзина N» и бургер читаются на светлых
    // кадрах видео (решение по ревью 004b); с 1280 — как в макете
    secondary: "text-on-accent xl:text-canvas/80 hover:text-white",
    button:
      "border-on-accent text-on-accent xl:border-line xl:text-canvas hover:border-accent hover:bg-accent hover:text-white",
  },
};

/**
 * Бордовая шапка постоянной высоты 118px — всё, кроме главной (решение 09.10):
 * правило, а не список разделов, чтобы новая страница не осталась со светлой шапкой.
 */
function isAccentPath(pathname: string): boolean {
  return pathname !== "/";
}

/** После какой прокрутки шапка сжимается до 118px (поправка заказчика: ~40px). */
const COMPACT_AFTER = 40;

function usePageState(pathname: string, enabled: boolean) {
  // На главной с первого рендера считаем, что герой есть: иначе после гидрации
  // контент прыгнул бы вверх на высоту шапки. Если героя нет — снимаем наложение.
  const [overlay, setOverlay] = useState(enabled && pathname === "/");
  const [overHero, setOverHero] = useState(enabled && pathname === "/");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const hero = pathname === "/" ? document.querySelector<HTMLElement>("[data-hero]") : null;
    setOverlay(Boolean(hero));
    // Lenis прокручивает окно штатно, поэтому событие scroll приходит и с ним
    const update = () => {
      setScrolled(window.scrollY > COMPACT_AFTER);
      // Шапка прозрачная, пока под ней видео героя (задание 004), и светлая ниже
      const header = document.querySelector<HTMLElement>("[data-site-header]");
      setOverHero(hero ? hero.getBoundingClientRect().bottom > (header?.offsetHeight ?? 0) : false);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [pathname, enabled]);

  return { overlay, overHero, scrolled };
}

type MenuKey = "catalog" | "cakes";

/** Пункты с мега-меню; остальные пункты — ссылки. */
const MENU_ITEMS: Record<string, MenuKey> = { "/catalog": "catalog", "/custom-cakes": "cakes" };

/** После какой прокрутки открытое мега-меню закрывается. */
const CLOSE_AFTER_SCROLL = 80;

const EMPTY_MENU: HeaderMenuData = {
  categories: [],
  cakes: null,
  telegram: null,
  addressLine: null,
};

export function Header({
  phone,
  menu = EMPTY_MENU,
  variant: forcedVariant,
  compact: forcedCompact,
  isStatic = false,
}: {
  /** Телефон из GET /pages/contacts в том виде, как его ввели в админке. */
  phone: string | null;
  /** Разделы, меню «Тортов на заказ» и контакты для мега-меню и мобильного меню. */
  menu?: HeaderMenuData;
  /** Для витрины компонентов: зафиксировать вариант и не следить за прокруткой. */
  variant?: HeaderVariant;
  /** Для витрины: компактная шапка 118px. */
  compact?: boolean;
  isStatic?: boolean;
}) {
  const pathname = usePathname();
  const { cart } = useCart();
  const count = cart?.total_items ?? 0;
  const { overlay, overHero, scrolled } = usePageState(pathname, !isStatic);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  // До гидрации пункты меню — ссылки: без JS они ведут на разделы
  const [hydrated, setHydrated] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const buttons = useRef<Partial<Record<MenuKey, HTMLButtonElement | null>>>({});
  const reduce = useReducedMotion();

  const accentPage = !isStatic && isAccentPath(pathname);
  const compact = isStatic ? Boolean(forcedCompact) : accentPage || scrolled;
  const variant: HeaderVariant =
    forcedVariant ??
    (openMenu ? "light" : accentPage ? "accent" : overlay && overHero ? "transparent" : "light");
  const theme = THEMES[variant];
  const tel = phone ? formatPhone(phone) : null;

  useEffect(() => setHydrated(true), []);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeMobile = () => {
      if (desktop.matches) setMobileOpen(false);
    };
    desktop.addEventListener("change", closeMobile);
    return () => desktop.removeEventListener("change", closeMobile);
  }, []);
  useEffect(() => {
    setMobileOpen(false);
    setOpenMenu(null);
  }, [pathname]);

  // Закрытие мега-меню: Esc (фокус — на пункт), клик вне шапки, прокрутка > 80px
  useEffect(() => {
    if (!openMenu) return;
    const startY = window.scrollY;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenMenu(null);
      buttons.current[openMenu]?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    const onScroll = () => {
      if (Math.abs(window.scrollY - startY) > CLOSE_AFTER_SCROLL) setOpenMenu(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [openMenu]);

  const close = () => setOpenMenu(null);

  return (
    <>
      {/* Место под шапку постоянной высоты: сжатие шапки не сдвигает контент */}
      {isStatic ? null : (
        <div
          aria-hidden="true"
          className={
            overlay
              ? "h-0"
              : accentPage
                ? "h-[90px] sm:h-[72px] lg:h-24 xl:h-(--header-h-compact)"
                : "h-[90px] sm:h-[72px] lg:h-24 xl:h-(--header-h)"
          }
        />
      )}

      {/* Затемнение под мега-меню; клик по нему закрывает меню */}
      <AnimatePresence>
        {openMenu ? (
          <motion.div
            key="menu-dim"
            aria-hidden="true"
            className="fixed inset-0 z-30 hidden bg-night/50 lg:block"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
          />
        ) : null}
      </AnimatePresence>

      <header
        ref={headerRef}
        data-site-header
        data-variant={variant}
        data-compact={compact || undefined}
        className={[
          isStatic ? "relative" : "fixed inset-x-0 top-0",
          "z-40 h-[90px] transition-[height,background-color] duration-200 ease-out-soft sm:h-[72px] lg:h-24",
          compact ? "xl:h-(--header-h-compact)" : "xl:h-(--header-h)",
          theme.bar,
        ].join(" ")}
      >
        {/* Ниже 1024 (мобильная шапка) белый текст поверх светлых кадров видео
            не читался — лёгкое затемнение сверху, пока шапка прозрачная. */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-black/35 to-transparent transition-opacity duration-200 lg:hidden ${
            variant === "transparent" ? "opacity-100" : "opacity-0"
          }`}
        />
        {/* Поля шапки по кадрам главной 834 и 1194 (014): 32 и 40px. Остальные секции
            главной на этих ширинах пока на общем токене поля — это отдельное задание */}
        {/* Внутренние страницы с 1280: во всех макетах 09.10 содержимое шапки 118px
            стоит на 9,5px ниже середины полосы (логотип 48–89, меню 62–75) — 006b */}
        <div
          className={`container-page flex h-full items-center sm:max-lg:px-8 lg:max-xl:px-10 ${
            accentPage ? "xl:pt-[19px]" : ""
          }`}
        >
          <Link
            href="/"
            className={`shrink-0 transition-colors duration-200 ${theme.logo}`}
            aria-label="Главная"
          >
            <Logo className="w-[102px] sm:w-[122px] lg:w-[136px] xl:w-[161px]" />
          </Link>

          <nav
            aria-label="Основное меню"
            className="ml-9 hidden items-center gap-5 lg:flex xl:ml-[90px] xl:gap-10"
          >
            {NAV_LINKS.map((link) => {
              const key = MENU_ITEMS[link.href];
              // Страница товара — внутри «Каталога» (макет товара 09.10, 006b)
              const current = pathname.startsWith(link.href)
                ? "page"
                : link.href === "/catalog" && pathname.startsWith("/product/")
                  ? "true"
                  : undefined;
              const itemClass = `inline-flex items-center text-[15px] whitespace-nowrap transition-colors duration-200 xl:text-nav ${theme.nav}`;
              if (key && hydrated) {
                const open = openMenu === key;
                // Панель — в DOM сразу за своей кнопкой: Tab с открытого пункта идёт
                // по ссылкам меню, а не на соседний пункт (disclosure navigation).
                // Обёртка статичная, панель позиционируется от шапки
                return (
                  <div key={link.href} className="contents">
                    <button
                      ref={(element) => {
                        buttons.current[key] = element;
                      }}
                      type="button"
                      aria-expanded={open}
                      aria-controls={`mega-${key}`}
                      aria-current={current}
                      onClick={() => setOpenMenu(open ? null : key)}
                      className={`${itemClass} ${open ? "underline underline-offset-[5px]" : ""}`}
                    >
                      {typograf(link.label)}
                      <Chevron open={open} className="ml-2 xl:mr-1.5 xl:ml-[9px]" />
                    </button>
                    {/* Выезжает вниз из-под шапки: обёртка обрезает её по нижнему краю шапки */}
                    <div className="absolute inset-x-0 top-full overflow-hidden">
                      <AnimatePresence initial={false}>
                        {open ? (
                          <motion.div
                            key={key}
                            id={`mega-${key}`}
                            className="border-t border-line bg-canvas"
                            initial={reduce ? { opacity: 0 } : { y: "-100%" }}
                            animate={reduce ? { opacity: 1 } : { y: 0 }}
                            exit={reduce ? { opacity: 0 } : { y: "-100%" }}
                            transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
                          >
                            {key === "catalog" ? (
                              <CatalogPanel categories={menu.categories} onNavigate={close} />
                            ) : (
                              <CakesPanel cakes={menu.cakes} onNavigate={close} />
                            )}
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              }
              return (
                <Link key={link.href} href={link.href} aria-current={current} className={itemClass}>
                  {typograf(link.label)}
                  {key ? <Chevron className="ml-2 xl:mr-1.5 xl:ml-[9px]" /> : null}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center">
            <Link
              href="/cart"
              className={`inline-flex items-center text-base whitespace-nowrap transition-colors duration-200 ${theme.secondary}`}
            >
              {/* Настоящий пробел, а не только отступ: скринридер читает «Корзина 0»,
                  и доступное имя совпадает с видимым текстом. На телефоне — сумка */}
              <BagIcon className="mr-2 sm:hidden" />
              <span className="max-sm:sr-only">Корзина </span>
              <span className="tnum text-xs sm:ml-2 sm:text-sm">{count}</span>
              <span className="sr-only">{typograf(" — товаров в корзине")}</span>
            </Link>

            {tel ? (
              <a
                href={tel.href}
                className={`ml-[35px] hidden text-lg whitespace-nowrap transition-colors duration-200 min-[1400px]:inline ${theme.secondary}`}
              >
                {tel.display}
              </a>
            ) : null}

            <Link
              href="/custom-cakes?request=1"
              className={`ml-8 hidden h-12 w-[156px] items-center justify-center border text-sm font-light uppercase xl:ml-[34px] transition-colors duration-200 lg:inline-flex xl:h-13 xl:w-[201px] xl:text-[1.03125rem] ${theme.button}`}
            >
              Заказать торт
            </Link>

            <button
              type="button"
              className={`-mr-2 ml-3.5 inline-flex size-10 items-center justify-center sm:ml-6 lg:hidden ${theme.secondary}`}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
              aria-label="Открыть меню"
              onClick={() => setMobileOpen(true)}
            >
              <svg width="18" height="12" viewBox="0 0 16 12" fill="none" aria-hidden="true">
                <path d="M0 1h16M0 6h16M0 11h16" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <MobileMenu
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        tel={tel}
        count={count}
        menu={menu}
      />
    </>
  );
}
