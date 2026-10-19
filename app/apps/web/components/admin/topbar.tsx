"use client";

/**
 * Верхняя строка админки: хлебные крошки, поиск, колокольчик, профиль.
 */

import { Bell, CaretRight, MagnifyingGlass, SignOut, UserCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent, RefObject } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import { useCounters, type Counters } from "@/components/admin/counters";
import { useTrail } from "@/components/admin/breadcrumbs";
import { sectionFor } from "@/components/admin/nav";
import { Avatar, initials } from "@/components/admin/ui";
import { pluralRu } from "@/lib/format";
import type { AdminSearchResults } from "@/lib/api";

/** Закрыть всплывающее окно по клику мимо него. */
function useOutside(ref: RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [ref, open, close]);
}

const POPOVER =
  "admin-popover absolute top-[calc(100%+8px)] right-0 z-40 rounded-admin-card bg-admin-card p-2 shadow-admin-hover";

// --- Хлебные крошки ---

export function Breadcrumbs() {
  const pathname = usePathname();
  const section = sectionFor(pathname);
  const trail = useTrail();
  const link = "text-admin-muted no-underline transition-colors duration-150 hover:text-admin-side";
  const separator = (key: string, mobile = false) => (
    <li
      key={key}
      aria-hidden="true"
      className={`text-admin-faint ${mobile ? "" : "hidden adm-sm:block"}`}
    >
      <CaretRight size={12} weight="bold" />
    </li>
  );
  return (
    <nav aria-label="Путь" className="min-w-0 text-sm">
      <ol className="flex min-w-0 items-center gap-2">
        <li className="hidden adm-sm:block">
          <Link href="/admin" className={link}>
            Админ-панель
          </Link>
        </li>
        {separator("root")}
        {trail.length === 0 ? (
          <li aria-current="page" className="truncate font-semibold text-admin-ink">
            {section?.label ?? "Раздел"}
          </li>
        ) : (
          <>
            <li className="hidden shrink-0 adm-sm:block">
              <Link href={section?.href ?? "/admin"} className={link}>
                {section?.label ?? "Раздел"}
              </Link>
            </li>
            {trail.map((crumb, index) => {
              const last = index === trail.length - 1;
              return [
                separator(`s-${index}`, last),
                <li
                  key={`c-${index}`}
                  aria-current={last ? "page" : undefined}
                  className={
                    last ? "truncate font-semibold text-admin-ink" : "hidden shrink-0 adm-sm:block"
                  }
                >
                  {last || !crumb.href ? (
                    crumb.label
                  ) : (
                    <Link href={crumb.href} className={link}>
                      {crumb.label}
                    </Link>
                  )}
                </li>,
              ];
            })}
          </>
        )}
      </ol>
    </nav>
  );
}

// --- Поиск ---

type Option = { id: string; href: string; group: string; title: string; meta?: string };

function toOptions(results: AdminSearchResults): { group: string; options: Option[] }[] {
  return [
    {
      group: "Заказы",
      options: results.orders.map((o) => ({
        id: `order-${o.id}`,
        href: `/admin/orders/${o.id}`,
        group: "Заказы",
        title: `№ ${o.order_number}`,
        meta: `${o.customer_name} · ${o.customer_phone}`,
      })),
    },
    {
      group: "Товары",
      options: results.products.map((p) => ({
        id: `product-${p.id}`,
        href: "/admin/catalog",
        group: "Товары",
        title: p.name,
      })),
    },
    {
      group: "Заявки",
      options: results.consultations.map((c) => ({
        id: `request-${c.id}`,
        href: `/admin/consultations/${c.id}`,
        group: "Заявки",
        title: c.name,
        meta: c.phone,
      })),
    },
  ].filter((group) => group.options.length > 0);
}

const MIN_QUERY = 2;
const DEBOUNCE_MS = 250;

/**
 * Поиск по заказам, товарам и заявкам. Комбобокс по ARIA 1.2: фокус остаётся
 * в поле, стрелки двигают активный вариант (`aria-activedescendant`), Enter
 * открывает, Esc закрывает. Ctrl+K (⌘K) из любого места ставит фокус в поле.
 */
export function SearchBox({ className = "" }: { className?: string }) {
  const { authFetch } = useAdminAuth();
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminSearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const close = useCallback(() => setOpen(false), []);
  useOutside(boxRef, open, close);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const text = query.trim();
    if (text.length < MIN_QUERY) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const data = await authFetch<AdminSearchResults>(
          `/admin/search?q=${encodeURIComponent(text)}`,
        );
        if (!cancelled) {
          setResults(data);
          setActive(0);
        }
      } catch {
        if (!cancelled) setResults({ orders: [], products: [], consultations: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, authFetch]);

  const groups = results ? toOptions(results) : [];
  const flat = groups.flatMap((group) => group.options);
  const showList = open && query.trim().length >= MIN_QUERY;
  const activeOption = flat[active];

  function go(option: Option | undefined) {
    if (!option) return;
    setOpen(false);
    setQuery("");
    router.push(option.href);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (flat.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (current + step + flat.length) % flat.length);
    } else if (event.key === "Enter" && showList) {
      event.preventDefault();
      go(activeOption);
    } else if (event.key === "Escape") {
      if (showList) {
        event.preventDefault();
        setOpen(false);
      } else {
        setQuery("");
      }
    }
  }

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label="Поиск по админке"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          showList && activeOption ? `${listId}-${activeOption.id}` : undefined
        }
        aria-keyshortcuts="Control+K"
        placeholder="Поиск: заказ, клиент, товар"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="h-10 w-full rounded-full border border-admin-disabled bg-admin-card pr-[42px] pl-[18px] text-sm text-admin-ink transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-admin-muted focus:border-admin-side focus:shadow-admin-focus [&::-webkit-search-cancel-button]:hidden"
      />
      <MagnifyingGlass
        aria-hidden="true"
        size={19}
        className="pointer-events-none absolute top-[10px] right-[14px] text-admin-muted"
      />
      <div
        id={listId}
        role="listbox"
        aria-label="Результаты поиска"
        hidden={!showList}
        className={`${POPOVER} right-auto left-0 max-h-[70vh] w-[min(360px,calc(100vw-32px))] overflow-y-auto`}
      >
        {loading && !results ? (
          <p className="px-3 py-2.5 text-[13.5px] text-admin-muted">Ищем…</p>
        ) : groups.length === 0 ? (
          <p className="px-3 py-2.5 text-[13.5px] text-admin-muted">
            {loading ? "Ищем…" : "Ничего не нашлось. Номер, имя, телефон или товар"}
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.group} role="group" aria-labelledby={`${listId}-${group.group}`}>
              <p
                id={`${listId}-${group.group}`}
                className="px-3 pt-2 pb-1 text-[11.5px] font-bold tracking-[0.1em] text-admin-muted uppercase"
              >
                {group.group}
              </p>
              {group.options.map((option) => {
                const selected = option.id === activeOption?.id;
                return (
                  <div
                    key={option.id}
                    id={`${listId}-${option.id}`}
                    role="option"
                    aria-selected={selected}
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => go(option)}
                    onPointerMove={() => setActive(flat.indexOf(option))}
                    className={`flex cursor-pointer flex-col rounded-admin-small px-3 py-2 ${
                      selected ? "bg-admin-soft" : ""
                    }`}
                  >
                    <span className="text-[13.5px] font-bold text-admin-ink">{option.title}</span>
                    {option.meta ? (
                      <span className="text-[12.5px] text-admin-muted">{option.meta}</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// --- Колокольчик ---

const BELL_ROWS: { key: keyof Counters; href: string; forms: [string, string, string] }[] = [
  {
    key: "orders_new",
    href: "/admin/orders?tab=new",
    forms: ["новый заказ", "новых заказа", "новых заказов"],
  },
  {
    key: "consultations_new",
    href: "/admin/consultations?tab=new",
    forms: ["новая заявка", "новые заявки", "новых заявок"],
  },
  {
    key: "reviews_unpublished",
    href: "/admin/reviews",
    forms: ["отзыв ждёт публикации", "отзыва ждут публикации", "отзывов ждут публикации"],
  },
];

/** Что ждёт реакции. Точка на иконке — только когда что-то есть. */
export function BellMenu() {
  const { counters } = useCounters();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const close = useCallback(() => setOpen(false), []);
  useOutside(ref, open, close);

  const rows = BELL_ROWS.map((row) => ({ ...row, count: counters?.[row.key] ?? 0 })).filter(
    (row) => row.count > 0,
  );
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <div
      ref={ref}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          buttonRef.current?.focus();
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={
          total > 0
            ? `Уведомления: ${total} ${pluralRu(total, ["новое", "новых", "новых"])}`
            : "Уведомления: нового нет"
        }
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="relative flex size-10 items-center justify-center rounded-full text-admin-ink transition-colors duration-150 hover:bg-admin-soft hover:text-admin-side focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-side"
      >
        <Bell aria-hidden="true" size={21} />
        {total > 0 ? (
          <span
            aria-hidden="true"
            className="absolute top-2 right-[9px] size-3 rounded-full border-2 border-admin-panel bg-admin-side"
          />
        ) : null}
      </button>
      <div id={panelId} hidden={!open} className={`${POPOVER} w-72`}>
        {rows.length === 0 ? (
          <p className="px-3 py-2.5 text-[13.5px] text-admin-muted">Нового нет. Всё разобрано</p>
        ) : (
          <ul>
            {rows.map((row) => (
              <li key={row.key}>
                <Link
                  href={row.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-admin-small px-3 py-2.5 text-[13.5px] text-admin-ink no-underline hover:bg-admin-soft focus-visible:outline-2 focus-visible:outline-admin-side"
                >
                  <span className="min-w-6 text-[15px] font-extrabold tabular-nums">
                    {row.count}
                  </span>
                  <span>{pluralRu(row.count, row.forms)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// --- Профиль ---

/**
 * Меню профиля по паттерну menu button: стрелки ходят по пунктам, Esc закрывает
 * и возвращает фокус на кнопку.
 */
export function ProfileMenu() {
  const { user, logout } = useAdminAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemsRef = useRef<(HTMLElement | null)[]>([]);
  const menuId = useId();
  const close = useCallback(() => setOpen(false), []);
  useOutside(ref, open, close);
  const name = user?.name ?? "";
  const role = user?.role === "owner" ? "владелец" : "менеджер";

  useEffect(() => {
    if (open) itemsRef.current[0]?.focus();
  }, [open]);

  function onMenuKey(event: KeyboardEvent<HTMLDivElement>) {
    const items = itemsRef.current.filter(Boolean) as HTMLElement[];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    } else if (event.key === "Escape" || event.key === "Tab") {
      setOpen(false);
      if (event.key === "Escape") buttonRef.current?.focus();
    }
  }

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-admin-small px-3 py-2.5 text-left text-[13.5px] font-semibold text-admin-ink no-underline hover:bg-admin-soft focus-visible:bg-admin-soft focus-visible:outline-none";

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Профиль: ${name}`}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="flex size-10 items-center justify-center rounded-full bg-admin-side font-display text-[17px] text-admin-cream transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-side active:translate-y-px"
      >
        {initials(name || "?")}
      </button>
      <div
        id={menuId}
        role="menu"
        aria-label="Профиль"
        hidden={!open}
        onKeyDown={onMenuKey}
        className={`${POPOVER} w-64`}
      >
        <div className="flex items-center gap-3 border-b border-admin-line px-3 pt-1.5 pb-3">
          <Avatar name={name || "?"} tone="side" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[13.5px] font-bold text-admin-ink">{name}</span>
            <span className="truncate text-[12.5px] text-admin-muted">
              {user?.email} · {role}
            </span>
          </span>
        </div>
        <div className="pt-1.5">
          <Link
            ref={(node) => {
              itemsRef.current[0] = node;
            }}
            role="menuitem"
            tabIndex={-1}
            href="/admin/profile"
            onClick={() => setOpen(false)}
            className={itemClass}
          >
            <UserCircle aria-hidden="true" size={18} />
            Мой профиль
          </Link>
          <button
            ref={(node) => {
              itemsRef.current[1] = node;
            }}
            role="menuitem"
            tabIndex={-1}
            type="button"
            onClick={() => void logout()}
            className={itemClass}
          >
            <SignOut aria-hidden="true" size={18} />
            Выйти
          </button>
        </div>
      </div>
    </div>
  );
}
