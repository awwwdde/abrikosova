"use client";

/**
 * Выбор товара поиском (011f, находка 4 из 011e): раньше список товаров
 * загружался первыми 100 — товар 101-й и дальше выбрать было нельзя. Теперь
 * ввод ищет по названию на сервере (`/admin/products?search=…`, 20 результатов).
 *
 * Паттерн ARIA combobox со списком: стрелки ходят по вариантам
 * (aria-activedescendant), Enter выбирает, Esc закрывает.
 */

import { MagnifyingGlass } from "@phosphor-icons/react";
import { useEffect, useId, useState } from "react";
import type { KeyboardEvent } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import { Input } from "@/components/admin/ui";
import type { Page, ProductAdmin, ProductAdminListItem } from "@/lib/api";

type Option = { id: string; name: string };

export function ProductCombobox({
  value,
  initialName,
  onChange,
  emptyLabel,
  className = "",
  ...a11y
}: {
  /** id товара строкой, "" — не выбран */
  value: string;
  /** Название выбранного товара, если уже известно (у отзыва — product_name) */
  initialName?: string | null;
  onChange: (id: string) => void;
  /** Первый вариант: «Все товары» в фильтре, «Без привязки к товару» в форме */
  emptyLabel: string;
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}) {
  const { authFetch } = useAdminAuth();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [items, setItems] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [names, setNames] = useState<Record<string, string>>(
    value && initialName ? { [value]: initialName } : {},
  );

  // Название выбранного товара для ссылки вида ?product=42
  useEffect(() => {
    if (!value || names[value]) return;
    authFetch<ProductAdmin>(`/admin/products/${value}`)
      .then((product) => setNames((current) => ({ ...current, [value]: product.name })))
      .catch(() => setNames((current) => ({ ...current, [value]: `Товар №${value}` })));
  }, [authFetch, value, names]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ page_size: "20" });
      if (text.trim()) params.set("search", text.trim());
      authFetch<Page<ProductAdminListItem>>(`/admin/products?${params}`)
        .then((page) =>
          setItems(page.items.map((item) => ({ id: String(item.id), name: item.name }))),
        )
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [authFetch, open, text]);

  const options: Option[] = [{ id: "", name: emptyLabel }, ...items];
  const shown = open ? text : value ? (names[value] ?? "…") : emptyLabel;

  function choose(option: Option) {
    setNames((current) => (option.id ? { ...current, [option.id]: option.name } : current));
    setOpen(false);
    setText("");
    onChange(option.id);
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (current + step + options.length) % options.length);
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      const option = options[active];
      if (option) choose(option);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      setText("");
    }
  }

  return (
    <div className={`relative ${className}`}>
      <Input
        {...a11y}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        autoComplete="off"
        icon={<MagnifyingGlass size={17} />}
        placeholder={open ? "Название товара" : undefined}
        value={shown}
        onFocus={() => {
          setOpen(true);
          setActive(0);
        }}
        onBlur={() => {
          setOpen(false);
          setText("");
        }}
        onChange={(event) => {
          setOpen(true);
          setActive(0);
          setText(event.target.value);
        }}
        onKeyDown={onKey}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Товары"
        hidden={!open}
        className="absolute top-[calc(100%+6px)] right-0 left-0 z-40 max-h-72 min-w-56 overflow-y-auto rounded-admin-card bg-admin-card p-1.5 shadow-admin-hover"
      >
        {options.map((option, index) => (
          <li
            key={option.id || "any"}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={option.id === value}
            // mousedown, а не click: иначе blur инпута закроет список раньше выбора
            onMouseDown={(event) => {
              event.preventDefault();
              choose(option);
            }}
            onMouseEnter={() => setActive(index)}
            className={`cursor-pointer rounded-admin-small px-3 py-2 text-[13.5px] font-semibold ${
              index === active ? "bg-admin-soft" : ""
            } ${option.id === value ? "text-admin-side" : "text-admin-ink"}`}
          >
            {option.name}
          </li>
        ))}
        {!loading && items.length === 0 && text.trim() ? (
          <li role="presentation" className="px-3 py-2 text-[13px] text-admin-muted">
            Ничего не нашлось
          </li>
        ) : null}
      </ul>
    </div>
  );
}
