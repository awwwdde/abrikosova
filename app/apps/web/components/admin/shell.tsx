"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import { Button } from "@/components/ui";

const NAV_GROUPS = [
  {
    title: "Работа",
    items: [
      { href: "/admin", label: "Дашборд", ownerOnly: false },
      { href: "/admin/orders", label: "Заказы", ownerOnly: false },
      { href: "/admin/consultations", label: "Заявки", ownerOnly: false },
    ],
  },
  {
    title: "Содержимое",
    items: [
      { href: "/admin/catalog", label: "Каталог", ownerOnly: false },
      { href: "/admin/custom-cakes", label: "Торты на заказ", ownerOnly: false },
      { href: "/admin/gallery", label: "Примеры работ", ownerOnly: false },
      { href: "/admin/reviews", label: "Отзывы", ownerOnly: false },
      { href: "/admin/pages", label: "Контент страниц", ownerOnly: false },
    ],
  },
  {
    title: "Администрирование",
    items: [
      { href: "/admin/users", label: "Пользователи", ownerOnly: true },
      { href: "/admin/backups", label: "Резервные копии", ownerOnly: true },
    ],
  },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, status, logout } = useAdminAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (status === "anonymous" && !isLoginPage) router.replace("/admin/login");
    if (status === "authenticated" && isLoginPage) router.replace("/admin");
  }, [status, isLoginPage, router]);

  if (isLoginPage) return <>{children}</>;

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-ink-subtle">Проверяем сессию…</p>
      </div>
    );
  }

  if (status === "anonymous") return null;

  // Пункты меню скрываются по роли, но решает всё равно бэкенд —
  // прямой заход по URL на чужой раздел вернёт 403
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.ownerOnly || user?.role === "owner"),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between gap-4 px-4 md:px-6">
          <Link href="/admin" className="flex items-baseline gap-2">
            <span className="font-display text-sm">Абрикосова</span>
            <span className="text-2xs tracking-[0.12em] text-ink-subtle">АДМИНКА</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              target="_blank"
              className="hidden text-xs text-ink-muted transition-colors duration-150 hover:text-ink sm:block"
            >
              Открыть сайт ↗
            </Link>
            <span className="hidden text-xs text-ink-subtle md:block">
              {user?.email} · {user?.role === "owner" ? "владелец" : "менеджер"}
            </span>
            <Button variant="ghost" onClick={() => void logout()}>
              Выйти
            </Button>
          </div>
        </div>
      </header>

      <div className="md:grid md:grid-cols-[15rem_1fr]">
        <nav className="border-b border-line px-4 py-4 md:min-h-[calc(100vh-3.5rem)] md:border-b-0 md:border-r md:px-3 md:py-6">
          <div className="flex flex-wrap gap-x-6 gap-y-5 md:block md:space-y-6">
            {groups.map((group) => (
              <div key={group.title}>
                <p className="eyebrow mb-2 px-2">{group.title}</p>
                <ul className="flex flex-wrap gap-1 md:block md:space-y-0.5">
                  {group.items.map((item) => {
                    const active =
                      item.href === "/admin"
                        ? pathname === "/admin"
                        : pathname.startsWith(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`block rounded-md px-2 py-1.5 text-sm transition-colors duration-150 ${
                            active
                              ? "bg-surface font-medium text-ink shadow-raised"
                              : "text-ink-muted hover:bg-surface-sunken hover:text-ink"
                          }`}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <main className="px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
