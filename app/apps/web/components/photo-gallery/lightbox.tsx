"use client";

/**
 * Лайтбокс фото товара (макет 09.10, product-frames/f4-2.png, 006b): тёмный фон на
 * весь экран, фото 4:5 по центру (на 1512×982 — 664×830), круглые стрелки по бокам,
 * крестик справа вверху, счётчик «2 / 4» внизу. Без фото — та же бежевая плашка
 * с подписью роли, что и на странице.
 *
 * - `role="dialog"`, фокус заперт внутри, по закрытию возвращается на фото.
 * - ←/→ листают по кругу, Esc закрывает, на телефоне — свайп.
 * - Прокрутка страницы заблокирована: Lenis `stop()` и `overflow: hidden`, как
 *   у мобильного меню (014).
 * - Портал в `body`: у предков фото могут быть transform анимаций появления, а
 *   `position: fixed` внутри transform считается от предка, а не от окна.
 */

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLenis } from "@/components/lenis-provider";
import { imageUrl } from "@/lib/api";
import { typograf } from "@/lib/format";

export type LightboxPhoto = { key: string; storageKey: string | null | undefined; caption: string };

/** Свайп короче — не листание, а случайное касание. */
const SWIPE_MIN = 40;

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5 fill-none stroke-current stroke-[1.6]"
    >
      <path d={direction === "left" ? "m14.5 6-6 6 6 6" : "m9.5 6 6 6-6 6"} />
    </svg>
  );
}

export function Lightbox({
  photos,
  start,
  name,
  onClose,
}: {
  photos: LightboxPhoto[];
  start: number;
  /** Название товара — подпись диалога */
  name: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(start);
  const lenis = useLenis();
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  const count = photos.length;
  const photo = photos[index]!;
  const src = imageUrl(photo.storageKey);

  const go = useCallback(
    (step: number) => setIndex((current) => (current + step + count) % count),
    [count],
  );

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    lenis?.stop();
    closeButton.current?.focus();
    return () => {
      root.style.overflow = overflow;
      lenis?.start();
      previous?.focus();
    };
  }, [lenis]);

  // Клавиши — на документе, пока лайтбокс открыт: фокус не обязан быть внутри
  // (клик мышью по фону его не переносит), а Esc и стрелки должны работать всегда
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
      } else if (event.key === "Tab" && dialog.current) {
        // Фокус заперт. Только видимые кнопки: стрелки другой ширины экрана
        // скрыты display: none и фокус не принимают
        const items = Array.from(dialog.current.querySelectorAll<HTMLElement>("button")).filter(
          (item) => item.getClientRects().length > 0,
        );
        const first = items[0];
        const last = items[items.length - 1];
        const inside = dialog.current.contains(document.activeElement);
        if (event.shiftKey && (document.activeElement === first || !inside)) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !inside)) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [go, onClose]);

  const arrow = (direction: "left" | "right", className: string) => (
    <button
      type="button"
      aria-label={direction === "left" ? "Предыдущее фото" : "Следующее фото"}
      onClick={() => go(direction === "left" ? -1 : 1)}
      className={`flex size-[52px] items-center justify-center rounded-full border border-on-accent/50 text-on-accent transition-colors duration-150 hover:border-on-accent hover:bg-on-accent/10 ${className}`}
    >
      <Chevron direction={direction} />
    </button>
  );

  return createPortal(
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label={`Фото: ${name}`}
      onTouchStart={(event) => {
        touchX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const from = touchX.current;
        const to = event.changedTouches[0]?.clientX;
        touchX.current = null;
        if (from === null || to === undefined || Math.abs(to - from) < SWIPE_MIN) return;
        go(to < from ? 1 : -1);
      }}
      data-lenis-prevent
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink"
    >
      <button
        ref={closeButton}
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        className="absolute top-[24px] right-[28px] flex size-10 items-center justify-center text-on-accent transition-opacity duration-150 hover:opacity-70"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-6 fill-none stroke-current stroke-[1.4]"
        >
          <path d="M1 1l22 22M23 1 1 23" />
        </svg>
      </button>

      {/* Фото 4:5: высота окна минус поля 76 сверху и снизу, не шире окна */}
      <div className="relative aspect-[4/5] h-[min(calc(100dvh-152px),125vw)] max-w-full">
        {src ? (
          <Image
            key={photo.key}
            src={src}
            alt={photo.caption}
            fill
            sizes="(min-width: 768px) 664px, 100vw"
            className="object-cover"
          />
        ) : (
          <span
            role="img"
            aria-label={photo.caption}
            className="absolute inset-0 flex items-center justify-center bg-photo px-4 text-center text-sm text-ink-subtle"
          >
            {typograf(photo.caption)}
          </span>
        )}
        {count > 1 ? (
          <>
            {arrow("left", "absolute top-1/2 right-full mr-8 -translate-y-1/2 max-md:hidden")}
            {arrow("right", "absolute top-1/2 left-full ml-8 -translate-y-1/2 max-md:hidden")}
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <div className="absolute inset-x-0 bottom-[26px] flex items-center justify-center gap-6 md:bottom-[30px]">
          {arrow("left", "md:hidden")}
          <p aria-live="polite" className="tnum text-[13px] text-on-accent">
            {index + 1} / {count}
          </p>
          {arrow("right", "md:hidden")}
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
