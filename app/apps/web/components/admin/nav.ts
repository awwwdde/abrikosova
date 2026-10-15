/**
 * Разделы админки: меню, хлебные крошки и счётчики берут названия отсюда.
 *
 * `ownerOnly` только прячет пункт — доступ проверяет бэкенд (403 для менеджера),
 * прямой заход по адресу чужой раздел не откроет.
 */

import {
  CalendarCheck,
  ChatCircleText,
  ClockCounterClockwise,
  Database,
  FileText,
  GearSix,
  House,
  ImageSquare,
  Stack,
  SquaresFour,
  Star,
  UserCircle,
  Users,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

export type CounterKey = "orders_new" | "consultations_new" | "reviews_unpublished";

export type NavItem = {
  href: string;
  label: string;
  icon: Icon;
  ownerOnly?: boolean;
  counter?: CounterKey;
};

export type NavGroup = { title: string | null; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    title: null,
    items: [
      { href: "/admin", label: "Главная", icon: House },
      { href: "/admin/orders", label: "Заказы", icon: CalendarCheck, counter: "orders_new" },
      {
        href: "/admin/consultations",
        label: "Заявки на торты",
        icon: ChatCircleText,
        counter: "consultations_new",
      },
    ],
  },
  {
    title: "Витрина",
    items: [
      { href: "/admin/catalog", label: "Каталог", icon: SquaresFour },
      { href: "/admin/custom-cakes", label: "Торты на заказ и начинки", icon: Stack },
      { href: "/admin/gallery", label: "Примеры работ", icon: ImageSquare },
      { href: "/admin/reviews", label: "Отзывы", icon: Star, counter: "reviews_unpublished" },
    ],
  },
  {
    title: "Сайт",
    items: [{ href: "/admin/pages", label: "Страницы сайта", icon: FileText }],
  },
  {
    title: "Настройки",
    items: [
      { href: "/admin/users", label: "Сотрудники", icon: Users, ownerOnly: true },
      { href: "/admin/backups", label: "Резервные копии", icon: Database, ownerOnly: true },
      { href: "/admin/journal", label: "Журнал", icon: ClockCounterClockwise, ownerOnly: true },
      { href: "/admin/settings", label: "Настройки", icon: GearSix, ownerOnly: true },
    ],
  },
];

/** Страницы вне меню — для хлебных крошек. */
const EXTRA: NavItem[] = [{ href: "/admin/profile", label: "Мой профиль", icon: UserCircle }];

export function navFor(role: string | undefined): NavGroup[] {
  return NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.ownerOnly || role === "owner"),
  })).filter((group) => group.items.length > 0);
}

export function isActive(href: string, pathname: string): boolean {
  return href === "/admin"
    ? pathname === "/admin"
    : pathname === href || pathname.startsWith(`${href}/`);
}

/** Раздел для хлебных крошек: «Админ-панель › Заказы». */
export function sectionFor(pathname: string): NavItem | null {
  const all = [...NAV.flatMap((group) => group.items), ...EXTRA];
  return all.find((item) => isActive(item.href, pathname)) ?? null;
}
