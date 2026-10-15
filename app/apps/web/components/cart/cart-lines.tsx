"use client";

/**
 * Строки корзины (007b, кадр «Корзина + самовывоз»): фото 96×120, название Forum
 * ссылкой на товар, «1 кг · Надпись: «…»», «Изменить», срок; справа цена строки,
 * количество 1–20 и «Удалить».
 *
 * - **«Изменить»** — у строк с надписью или с возможной надписью: поле в строке
 *   и чёрная «Готово» (кадр «Правка надписи»). Enter сохраняет, Esc отменяет.
 *   Совпала с другой строкой того же веса — сервер сливает строки (007a): лишняя
 *   уезжает анимацией высоты, количество у оставшейся растёт.
 * - **Количество** — оптимистично (cart-context): на 1 минус выключен, удаляет
 *   только «Удалить».
 * - **«Удалить»** — сразу, на месте строки 5 секунд плашка «Удалено · Вернуть»:
 *   «Вернуть» кладёт строку обратно тем же весом, надписью и количеством.
 */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useCart } from "@/components/cart-context";
import { ApiError, imageUrl, type CartItem } from "@/lib/api";
import { leadText } from "@/lib/checkout";
import { typograf } from "@/lib/format";
import { INSCRIPTION_MAX } from "@/lib/product-page";

const MAX_QUANTITY = 20;
const UNDO_MS = 5000;

const money = (value: string | number) =>
  `${Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`;

type Removed = { key: number; line: CartItem; timer: number };

export function CartLines({
  items,
  onMessage,
}: {
  items: CartItem[];
  /** Сообщение для общей строки состояния: ошибка API, «Вернули в корзину» */
  onMessage: (text: string) => void;
}) {
  const { setQuantity, removeItem, setInscription, addItem } = useCart();
  const reduce = useReducedMotion();
  const [removed, setRemoved] = useState<Removed[]>([]);
  const [editing, setEditing] = useState<number | null>(null);

  useEffect(() => () => removed.forEach((item) => window.clearTimeout(item.timer)), [removed]);

  async function change(line: CartItem, quantity: number) {
    try {
      await setQuantity(line.id, quantity);
    } catch (error) {
      onMessage(error instanceof ApiError ? error.message : "Не удалось изменить количество");
    }
  }

  async function remove(line: CartItem) {
    const key = line.id;
    const timer = window.setTimeout(
      () => setRemoved((current) => current.filter((item) => item.key !== key)),
      UNDO_MS,
    );
    setRemoved((current) => [...current, { key, line, timer }]);
    try {
      await removeItem(line.id);
    } catch (error) {
      window.clearTimeout(timer);
      setRemoved((current) => current.filter((item) => item.key !== key));
      onMessage(error instanceof ApiError ? error.message : "Не удалось удалить позицию");
    }
  }

  async function restore(item: Removed) {
    window.clearTimeout(item.timer);
    setRemoved((current) => current.filter((entry) => entry.key !== item.key));
    try {
      await addItem(
        item.line.variant_id,
        item.line.quantity,
        item.line.inscription_text ?? undefined,
      );
      onMessage(`«${item.line.name}» снова в корзине`);
    } catch (error) {
      onMessage(error instanceof ApiError ? error.message : "Не удалось вернуть позицию");
    }
  }

  // Плашка «Удалено» стоит на месте строки: в общем списке по позиции удалённой
  const rows: ({ kind: "line"; line: CartItem } | { kind: "removed"; item: Removed })[] = items.map(
    (line) => ({ kind: "line" as const, line }),
  );
  for (const item of removed) {
    rows.push({ kind: "removed", item });
  }
  rows.sort((a, b) => key(a) - key(b));

  return (
    <>
      {/* Невидимый h2 между h1 «Корзина» и h3 названий позиций: без него
          уровни заголовков прыгают (Lighthouse: heading-order, 008a) */}
      <h2 className="sr-only">Позиции в корзине</h2>
      <ul className="border-t border-line">
        <AnimatePresence initial={false}>
          {rows.map((row) =>
            row.kind === "removed" ? (
              <motion.li
                key={`removed-${row.item.key}`}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                className="overflow-hidden border-b border-line"
              >
                <p
                  role="status"
                  className="flex items-center gap-2 py-[22px] text-[15px] text-ink-muted"
                >
                  {typograf(`«${row.item.line.name}» удалено`)}
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => void restore(row.item)}
                    className="text-ink underline underline-offset-4 transition-colors hover:text-accent"
                  >
                    Вернуть
                  </button>
                </p>
              </motion.li>
            ) : (
              <motion.li
                key={row.line.id}
                layout={reduce ? false : "position"}
                initial={false}
                exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
                className="overflow-hidden border-b border-line"
              >
                <Line
                  line={row.line}
                  canInscribe={Boolean(row.line.inscription_text) || row.line.allows_inscription}
                  editing={editing === row.line.id}
                  onEdit={(open) => setEditing(open ? row.line.id : null)}
                  onSave={async (text) => {
                    try {
                      await setInscription(row.line.id, text);
                      setEditing(null);
                    } catch (error) {
                      return error instanceof ApiError ? error.message : "Не удалось сохранить";
                    }
                    return null;
                  }}
                  onQuantity={(quantity) => void change(row.line, quantity)}
                  onRemove={() => void remove(row.line)}
                />
              </motion.li>
            ),
          )}
        </AnimatePresence>
      </ul>
    </>
  );
}

function key(row: { kind: "line"; line: CartItem } | { kind: "removed"; item: Removed }): number {
  return row.kind === "line" ? row.line.id : row.item.key;
}

function Line({
  line,
  canInscribe,
  editing,
  onEdit,
  onSave,
  onQuantity,
  onRemove,
}: {
  line: CartItem;
  canInscribe: boolean;
  editing: boolean;
  onEdit: (open: boolean) => void;
  onSave: (text: string | null) => Promise<string | null>;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const src = imageUrl(line.main_image);
  const href = `/product/${line.slug}`;
  const lead = leadText(line.lead_time_days);
  // «1 кг · Надпись: «…»». Вес — у торта всегда («Три шоколада, 1,4 кг» — один вес),
  // у остального — если весов несколько; у пирожного «120 г» не пишем (макет)
  const meta = [
    line.has_variants || line.is_cake ? line.variant_label : null,
    line.inscription_text ? `Надпись: «${line.inscription_text}»` : null,
  ].filter(Boolean);
  const metaText = meta.join(" · ");
  const showMeta = meta.length > 0;

  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-4 pt-[24px] pb-[23px] sm:grid-cols-[96px_minmax(0,1fr)_auto] sm:gap-x-6">
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden="true"
        className="relative row-span-2 block aspect-[4/5] w-[72px] overflow-hidden bg-photo sm:w-24"
      >
        {src ? (
          <Image src={src} alt="" fill sizes="96px" className="object-cover" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-[11px] text-ink-subtle">
            Фото
          </span>
        )}
      </Link>

      <div className="min-w-0">
        <h3 className="font-display text-[24px] leading-[30px] text-ink max-sm:text-xl">
          <Link href={href} className="transition-colors hover:text-accent">
            {typograf(line.name)}
          </Link>
        </h3>
        {showMeta && !editing ? (
          <p className="mt-[7px] text-[13px] leading-5 text-ink-muted">{typograf(metaText)}</p>
        ) : null}
        {canInscribe ? (
          editing ? (
            <InscriptionEditor
              initial={line.inscription_text ?? ""}
              onCancel={() => onEdit(false)}
              onSave={onSave}
              name={line.name}
            />
          ) : (
            <button
              type="button"
              onClick={() => onEdit(true)}
              aria-label={`Изменить надпись: ${line.name}`}
              className="mt-[1px] text-[13px] leading-5 text-ink underline underline-offset-[3px] transition-colors hover:text-accent"
            >
              Изменить
            </button>
          )
        ) : null}
        <p
          className={`mt-[10px] text-[13px] leading-5 font-medium ${lead.ready && line.lead_time_days === 0 ? "text-accent" : "text-ink"}`}
        >
          {lead.text}
        </p>
      </div>

      <div className="col-start-2 mt-3 flex items-center justify-between gap-4 sm:col-start-3 sm:row-start-1 sm:mt-0 sm:flex-col sm:items-end sm:justify-start sm:gap-0">
        <p className="order-2 text-[18px] leading-6 font-bold text-ink tabular-nums sm:order-none">
          {money(line.line_total)}
        </p>
        <div className="order-1 flex h-10 w-[100px] items-center justify-between border border-line sm:order-none sm:mt-[12px]">
          <button
            type="button"
            aria-label={`Меньше: ${line.name}`}
            disabled={line.quantity <= 1}
            onClick={() => onQuantity(line.quantity - 1)}
            className="flex h-full w-8 items-center justify-center text-ink disabled:opacity-35"
          >
            −
          </button>
          <span aria-live="polite" className="text-[14px] text-ink tabular-nums">
            <span className="sr-only">Количество: </span>
            {line.quantity}
          </span>
          <button
            type="button"
            aria-label={`Больше: ${line.name}`}
            disabled={line.quantity >= MAX_QUANTITY}
            onClick={() => onQuantity(line.quantity + 1)}
            className="flex h-full w-8 items-center justify-center text-ink disabled:opacity-35"
          >
            +
          </button>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Удалить: ${line.name}`}
          className="order-3 text-[13px] text-ink-subtle underline underline-offset-[3px] transition-colors hover:text-accent sm:order-none sm:mt-[13px]"
        >
          Удалить
        </button>
      </div>
    </div>
  );
}

function InscriptionEditor({
  initial,
  name,
  onCancel,
  onSave,
}: {
  initial: string;
  name: string;
  onCancel: () => void;
  onSave: (text: string | null) => Promise<string | null>;
}) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  async function save() {
    setSaving(true);
    const problem = await onSave(text.trim() || null);
    setSaving(false);
    if (problem) setError(problem);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void save();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  }

  return (
    <div className="mt-[6px]">
      <div className="flex gap-2">
        <label htmlFor={`inscription-${name}`} className="sr-only">
          Надпись на табличке: {name}
        </label>
        <input
          ref={input}
          id={`inscription-${name}`}
          value={text}
          maxLength={INSCRIPTION_MAX}
          onChange={(event) => {
            setText(event.target.value);
            setError(null);
          }}
          onKeyDown={onKeyDown}
          aria-invalid={error ? true : undefined}
          aria-describedby={`inscription-${name}-hint`}
          className={`h-[34px] w-full max-w-[340px] border bg-surface px-3 text-[13px] text-ink focus:outline-none ${
            error ? "border-accent" : "border-line focus:border-ink"
          }`}
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="h-[34px] shrink-0 bg-ink px-4 text-[13px] font-medium text-canvas transition-opacity hover:opacity-85 disabled:opacity-50"
        >
          Готово
        </button>
      </div>
      <p
        id={`inscription-${name}-hint`}
        role={error ? "alert" : undefined}
        className={`mt-1 text-[12px] ${error ? "text-accent" : "text-ink-subtle"}`}
      >
        {error ?? `До ${INSCRIPTION_MAX} знаков · Enter — сохранить, Esc — отменить`}
      </p>
    </div>
  );
}
