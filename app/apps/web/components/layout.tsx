"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/components/cart-context";

const NAV_LINKS = [
  { href: "/catalog", label: "Каталог" },
  { href: "/custom-cakes", label: "Торты на заказ" },
  { href: "/gallery", label: "Работы" },
  { href: "/about", label: "О нас" },
  { href: "/contacts", label: "Контакты" },
];

function CartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M3 5h1.6l1.7 8.4a1.4 1.4 0 0 0 1.4 1.1h6.5a1.4 1.4 0 0 0 1.4-1.1L17 7.5H5.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8.5" cy="17" r="1.1" fill="currentColor" />
      <circle cx="14.5" cy="17" r="1.1" fill="currentColor" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  // Обе иконки в DOM и кросс-фейдятся: так у переключения есть и вход, и выход
  return (
    <span className="relative block size-4">
      <svg
        viewBox="0 0 16 16"
        fill="none"
        className="absolute inset-0 transition-[opacity,scale,filter] duration-200 ease-[cubic-bezier(0.2,0,0,1)]"
        style={{
          opacity: open ? 0 : 1,
          scale: open ? "0.25" : "1",
          filter: open ? "blur(4px)" : "blur(0px)",
        }}
        aria-hidden="true"
      >
        <path
          d="M2 4h12M2 8h12M2 12h12"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
      <svg
        viewBox="0 0 16 16"
        fill="none"
        className="absolute inset-0 transition-[opacity,scale,filter] duration-200 ease-[cubic-bezier(0.2,0,0,1)]"
        style={{
          opacity: open ? 1 : 0,
          scale: open ? "1" : "0.25",
          filter: open ? "blur(0px)" : "blur(4px)",
        }}
        aria-hidden="true"
      >
        <path
          d="M3.5 3.5l9 9M12.5 3.5l-9 9"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { cart } = useCart();
  const pathname = usePathname();
  const count = cart?.total_items ?? 0;

  // Шапка получает тень только когда под ней есть контент — на самом верху
  // страницы линия не нужна и выглядит лишней
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header
      className={`sticky top-0 z-30 bg-canvas/85 backdrop-blur-md transition-shadow duration-200 ${
        scrolled ? "shadow-header" : ""
      }`}
    >
      <div className="container-page flex h-16 items-center justify-between gap-6">
        <Link href="/" className="flex flex-col leading-none">
          <span className="font-display text-base tracking-tight">Абрикосова</span>
          <span className="text-2xs tracking-[0.12em] text-ink-subtle">КОНДИТЕРСКАЯ</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative py-2 text-sm transition-colors duration-150 ${
                  active ? "text-ink" : "text-ink-muted hover:text-ink"
                }`}
              >
                {link.label}
                {active ? (
                  <span
                    className="absolute inset-x-0 -bottom-0.5 h-px bg-accent"
                    aria-hidden="true"
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1">
          <Link
            href="/cart"
            className="inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm text-ink transition-[background-color,scale] duration-150 hover:bg-surface-sunken active:scale-[0.96]"
            aria-label={`Корзина, товаров: ${count}`}
          >
            <CartIcon />
            <span className="tnum text-xs text-ink-muted">{count}</span>
          </Link>

          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-md text-ink transition-[background-color,scale] duration-150 hover:bg-surface-sunken active:scale-[0.96] md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label="Меню"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MenuIcon open={menuOpen} />
          </button>
        </div>
      </div>

      {/* Выход мягче входа: короткий сдвиг вместо схлопывания высоты */}
      <div
        id="mobile-menu"
        className="overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.2,0,0,1)] md:hidden"
        style={{
          display: "grid",
          gridTemplateRows: menuOpen ? "1fr" : "0fr",
          opacity: menuOpen ? 1 : 0,
        }}
      >
        <nav className="container-page min-h-0 pb-4">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block border-b border-line py-3 text-sm text-ink last:border-b-0"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="container-page grid gap-10 py-14 md:grid-cols-12">
        <div className="md:col-span-4">
          <p className="font-display text-lg">Абрикосова</p>
          <p className="mt-2 max-w-xs text-sm text-ink-muted">
            Торты и десерты ручной работы на заказ.
          </p>
        </div>

        <div className="md:col-span-3">
          <p className="eyebrow mb-3">Контакты</p>
          <a
            href="tel:+70000000000"
            className="tnum block text-sm transition-colors hover:text-accent"
          >
            +7 (000) 000-00-00
          </a>
          <p className="mt-2 text-sm text-ink-muted">Пн–Пт 9:00–20:00</p>
          <p className="text-sm text-ink-muted">Сб–Вс 10:00–18:00</p>
        </div>

        <div className="md:col-span-2">
          <p className="eyebrow mb-3">Разделы</p>
          <ul className="space-y-2 text-sm">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-ink-muted transition-colors hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-3">
          <p className="eyebrow mb-3">Документы</p>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/privacy" className="text-ink-muted transition-colors hover:text-ink">
                Политика конфиденциальности
              </Link>
            </li>
            <li>
              <Link href="/terms" className="text-ink-muted transition-colors hover:text-ink">
                Пользовательское соглашение
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="container-page flex flex-wrap justify-between gap-3 py-5 text-xs text-ink-subtle">
          <p>© {new Date().getFullYear()} Кондитерская Елены Абрикосовой</p>
          <p>Информация на сайте не является публичной офертой</p>
        </div>
      </div>
    </footer>
  );
}
