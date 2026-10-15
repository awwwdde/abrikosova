"use client";

/**
 * Каркас админки по концепту new/design/admin/Dashboard.dc.html (задание 011b).
 *
 * Бордовый фон, слева меню 256px, справа кремовая подложка со скруглением 28
 * и отступом 12 от окна. Активный пункт меню «врастает» в подложку: та же
 * заливка и выгнутые уголки сверху и снизу (`.admin-nav-fill` в globals.css).
 *
 * Уже 1024 меню уезжает в выдвижную панель (кнопка-бургер): нативный модальный
 * `<dialog>` даёт фокус-ловушку и Esc, прокрутку страницы под ним блокируем сами.
 * Подложка на узком экране — без внешнего отступа, во всю ширину.
 */

import { ArrowSquareOut, List, X } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import { BreadcrumbProvider } from "@/components/admin/breadcrumbs";
import { CountersProvider, useCounters } from "@/components/admin/counters";
import { isActive, navFor } from "@/components/admin/nav";
import { BellMenu, Breadcrumbs, ProfileMenu, SearchBox } from "@/components/admin/topbar";
import { CountPill, IconButton, ToastProvider } from "@/components/admin/ui";
import { Logo } from "@/components/logo";
import { safeNextPath } from "@/lib/admin-login";

const ASIDE_FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-cream";

function SidebarNav({ variant }: { variant: "rail" | "drawer" }) {
  const { user } = useAdminAuth();
  const { counters } = useCounters();
  const pathname = usePathname();

  return (
    <>
      <Link
        href="/admin"
        aria-label="Главная админки"
        className={`flex h-10 items-center self-start rounded-admin-small pl-[18px] text-admin-side-ink ${ASIDE_FOCUS}`}
      >
        <Logo className="h-[30px] w-[108px] opacity-95" />
      </Link>

      <nav aria-label="Разделы админки" className="flex flex-col gap-0.5">
        {navFor(user?.role).map((group) => (
          <div key={group.title ?? "main"} className="flex flex-col gap-0.5">
            {group.title ? (
              <p className="mt-[22px] mb-1.5 ml-[18px] text-[11px] font-bold tracking-[0.14em] text-admin-side-group uppercase">
                {group.title}
              </p>
            ) : null}
            {group.items.map((item) => {
              const active = isActive(item.href, pathname);
              const count = item.counter ? (counters?.[item.counter] ?? 0) : 0;
              const Icon = item.icon;
              // Размер и отступы пункта одинаковые в любом состоянии (011g): иначе
              // при выборе раздела сдвигались пункты ниже и счётчик. Активный пункт
              // отличается только заливкой и цветом; заливка у меню — отдельный слой
              const shape = active
                ? "font-bold text-admin-side"
                : "font-medium text-admin-side-text hover:bg-admin-side-ink/8 hover:text-admin-side-ink";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  aria-current={active ? "page" : undefined}
                  className={`relative mr-3.5 flex h-11 items-center gap-[13px] rounded-admin-control pl-[18px] text-[14.5px] whitespace-nowrap no-underline transition-colors duration-150 motion-reduce:transition-none ${shape} ${ASIDE_FOCUS}`}
                >
                  {active ? (
                    <span
                      aria-hidden="true"
                      className={
                        variant === "rail"
                          ? // До правого края меню: 14px отступа пункта
                            "admin-nav-fill absolute inset-y-0 left-0 -right-3.5 rounded-l-[22px] bg-admin-panel"
                          : "absolute inset-0 rounded-admin-control bg-admin-panel"
                      }
                    />
                  ) : null}
                  <Icon aria-hidden="true" size={19} className="relative shrink-0" />
                  {/* Жирный активный текст шире среднего: «Торты на заказ и начинки» в
                      700 — 181px при 178px места. Заливка активного пункта в меню доходит
                      до края на 14px дальше — подпись занимает и их (левый край тот же) */}
                  <span
                    className={`relative min-w-0 grow truncate ${active && variant === "rail" && count === 0 ? "-mr-3.5" : ""}`}
                  >
                    {item.label}
                  </span>
                  {count > 0 ? (
                    <span className="relative mr-2.5 shrink-0">
                      <CountPill>
                        {count > 99 ? "99+" : count}
                        <span className="sr-only"> новых</span>
                      </CountPill>
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <a
        href="/"
        target="_blank"
        rel="noopener"
        className={`mt-auto mr-3.5 flex h-11 items-center gap-[13px] rounded-admin-control pl-[18px] text-[14.5px] font-medium text-admin-side-text no-underline transition-colors duration-150 hover:bg-admin-side-ink/8 hover:text-admin-side-ink ${ASIDE_FOCUS}`}
      >
        <ArrowSquareOut aria-hidden="true" size={19} />
        Открыть сайт
        <span className="sr-only"> (в новой вкладке)</span>
      </a>
    </>
  );
}

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    // Под модальным окном страница не должна прокручиваться пальцем
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label="Меню админки"
      className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(288px,86vw)] max-w-none bg-admin-side p-0 text-admin-side-ink backdrop:bg-admin-ink/45 adm-lg:hidden"
      onClick={(event) => {
        // Клик по затемнению (мимо панели) закрывает меню
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex h-full flex-col gap-[22px] pt-[22px] pb-[22px] pl-3.5">
        <div className="absolute top-[22px] right-3">
          <IconButton
            label="Закрыть меню"
            tone="round"
            onClick={onClose}
            className="text-admin-side-ink hover:bg-admin-side-ink/10 hover:text-admin-side-ink focus-visible:outline-admin-cream"
          >
            <X size={20} />
          </IconButton>
        </div>
        <SidebarNav variant="drawer" />
      </div>
    </dialog>
  );
}

function ShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Переход по пункту меню закрывает выдвижную панель
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <div className="min-h-dvh bg-admin-side font-sans text-admin-ink adm-lg:flex">
      <a
        href="#admin-main"
        className="sr-only z-50 rounded-admin-small bg-admin-card px-4 py-2 font-bold text-admin-side focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Перейти к содержимому
      </a>

      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-[22px] overflow-y-auto pt-[26px] pb-[22px] pl-3.5 text-admin-side-ink adm-lg:flex">
        <SidebarNav variant="rail" />
      </aside>
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="min-h-dvh min-w-0 grow bg-admin-panel px-4 pt-3 pb-10 adm-sm:px-6 adm-lg:my-3 adm-lg:mr-3 adm-lg:min-h-[calc(100dvh-24px)] adm-lg:rounded-admin-panel adm-lg:px-8 adm-lg:pt-[22px]">
        <header className="flex flex-wrap items-center gap-x-2 gap-y-3 border-b border-admin-line pb-4 adm-sm:gap-x-3.5 adm-lg:pb-5">
          <IconButton
            label="Открыть меню"
            tone="round"
            className="-ml-2 adm-lg:hidden"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <List size={22} />
          </IconButton>
          <div className="min-w-0 grow">
            <Breadcrumbs />
          </div>
          <SearchBox className="order-last w-full adm-sm:order-none adm-sm:w-60 adm-xl:w-[280px]" />
          <BellMenu />
          <ProfileMenu />
        </header>
        <main id="admin-main" tabIndex={-1} className="pt-6 outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { status } = useAdminAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    // Выкинуло из раздела — после входа вернёмся туда же (параметр next). Проверка
    // адреса — safeNextPath: только пути внутри /admin, иначе open redirect
    if (status === "anonymous" && !isLoginPage) {
      const back = `${window.location.pathname}${window.location.search}`;
      router.replace(`/admin/login?next=${encodeURIComponent(back)}`);
    }
    if (status === "authenticated" && isLoginPage) {
      router.replace(safeNextPath(new URLSearchParams(window.location.search).get("next")));
    }
  }, [status, isLoginPage, router]);

  if (isLoginPage) return <>{children}</>;

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-admin-side p-3">
        <p role="status" className="text-sm text-admin-side-text">
          Проверяем сессию…
        </p>
      </div>
    );
  }

  if (status === "anonymous") return null;

  return (
    <ToastProvider>
      <CountersProvider>
        <BreadcrumbProvider>
          <ShellFrame>{children}</ShellFrame>
        </BreadcrumbProvider>
      </CountersProvider>
    </ToastProvider>
  );
}
