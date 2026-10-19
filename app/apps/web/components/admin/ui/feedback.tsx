"use client";

/**
 * Состояния и обратная связь: пусто, загрузка, плашки, тосты, подтверждение.
 */

import { CheckCircle, WarningCircle, X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useDialogMotion } from "@/components/admin/motion";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "./button";

/** Пустой блок: иконка, короткий текст, необязательное действие. */
export function EmptyState({
  icon,
  title,
  text,
  action,
  compact = false,
}: {
  icon?: ReactNode;
  title: ReactNode;
  text?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 text-center ${compact ? "py-6" : "py-12"}`}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="mb-1 flex size-12 items-center justify-center rounded-admin-control bg-admin-soft text-admin-side"
        >
          {icon}
        </span>
      ) : null}
      <p className="text-[15px] font-bold text-admin-ink">{title}</p>
      {text ? (
        <p className="max-w-xs text-[13.5px] leading-normal text-admin-muted">{text}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/**
 * Заглушка на время загрузки — той же формы, что и содержимое, чтобы
 * страница не прыгала. Пульсация — только opacity, при reduced-motion — без неё.
 */
export function Skeleton({ className = "", ...props }: ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded-admin-small bg-admin-line motion-reduce:animate-none ${className}`}
      {...props}
    />
  );
}

/** Плашка под формой или над блоком: ошибка, предупреждение. */
export function Notice({
  icon,
  tone = "accent",
  action,
  className = "",
  children,
  ...props
}: ComponentProps<"div"> & {
  icon?: ReactNode;
  tone?: "accent" | "amber";
  action?: ReactNode;
}) {
  const tones = {
    accent: "bg-admin-soft text-admin-side",
    amber: "bg-admin-amber-soft text-admin-amber",
  };
  return (
    <div
      className={`flex items-center gap-3 rounded-admin-control px-3.5 py-3 text-sm font-semibold ${tones[tone]} ${className}`}
      {...props}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      <span className="grow">{children}</span>
      {action}
    </div>
  );
}

/** Метка-пилюля под полем: «Включён Caps Lock». */
export function Pill({
  tone = "amber",
  children,
}: {
  tone?: "amber" | "accent";
  children: ReactNode;
}) {
  const tones = {
    amber: "bg-admin-amber-soft text-admin-amber",
    accent: "bg-admin-soft text-admin-side",
  };
  return (
    <span
      className={`inline-flex h-[26px] items-center self-start rounded-full px-2.5 text-[12.5px] font-bold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

// --- Тосты ---

type Toast = { id: number; tone: "success" | "error"; text: string };
type ToastApi = { success: (text: string) => void; error: (text: string) => void };

const ToastContext = createContext<ToastApi | null>(null);
const TOAST_MS = 5000;

/**
 * Результат операции («Отзыв опубликован», «Не удалось сохранить»). Две области
 * `aria-live`: успех — вежливо (polite), ошибка — сразу (assertive, role=alert).
 * Исчезают через 5 с; ошибку можно закрыть раньше.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone: Toast["tone"], text: string) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-2), { id, tone, text }]);
      window.setTimeout(() => dismiss(id), TOAST_MS);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({ success: (text) => push("success", text), error: (text) => push("error", text) }),
    [push],
  );

  const render = (tone: Toast["tone"]) =>
    toasts
      .filter((toast) => toast.tone === tone)
      .map((toast) => (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: reduce ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduce ? 0 : -4 }}
          transition={{ duration: reduce ? 0 : 0.18 }}
          className="pointer-events-auto flex min-w-64 items-center gap-3 rounded-admin-control bg-admin-ink px-4 py-3 text-sm font-semibold text-admin-card shadow-admin-hover"
        >
          {tone === "success" ? (
            <CheckCircle aria-hidden="true" size={20} className="text-admin-green-soft" />
          ) : (
            <WarningCircle aria-hidden="true" size={20} className="text-admin-cream" />
          )}
          <span className="grow">{toast.text}</span>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            aria-label="Закрыть уведомление"
            className="rounded-full p-1 text-admin-card/70 hover:text-admin-card focus-visible:outline-2 focus-visible:outline-admin-cream"
          >
            <X aria-hidden="true" size={14} weight="bold" />
          </button>
        </motion.div>
      ));

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex flex-col items-end gap-2">
        <div role="status" aria-live="polite" className="flex flex-col items-end gap-2">
          <AnimatePresence>{render("success")}</AnimatePresence>
        </div>
        <div role="alert" aria-live="assertive" className="flex flex-col items-end gap-2">
          <AnimatePresence>{render("error")}</AnimatePresence>
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast вызван вне ToastProvider");
  return context;
}

// --- Подтверждение ---

/**
 * Подтверждение разрушительного действия на нативном `<dialog>`: `showModal()`
 * делает остальную страницу инертной (фокус не уходит за окно), Esc закрывает,
 * а после закрытия браузер возвращает фокус на кнопку, открывшую окно.
 * Фокус сразу — на «Отмена»: случайный Enter не удалит запись.
 */
export function ConfirmDialog({
  open,
  title,
  text,
  confirmLabel = "Удалить",
  cancelLabel = "Отмена",
  loading = false,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: ReactNode;
  text?: ReactNode;
  /** Дополнительное поле внутри окна — например, причина отмены заказа */
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useDialogMotion(ref, open, "confirm");

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(event) => {
        // Esc во время запроса не закрывает: результат удаления ещё неизвестен
        event.preventDefault();
        if (!loading) onClose();
      }}
      aria-labelledby={titleId}
      className="admin-motion-dialog m-auto w-[min(420px,calc(100vw-32px))] rounded-admin-card bg-admin-card p-6 text-admin-ink shadow-admin-hover backdrop:bg-admin-ink/40"
    >
      <h2 id={titleId} className="font-sans text-[17px] font-bold">
        {title}
      </h2>
      {text ? <p className="mt-2 text-sm leading-normal text-admin-muted">{text}</p> : null}
      {children ? <div className="mt-4">{children}</div> : null}
      <div className="mt-6 flex justify-end gap-2">
        <Button ref={cancelRef} variant="outline" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
