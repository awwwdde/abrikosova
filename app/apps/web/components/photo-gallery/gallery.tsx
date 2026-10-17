"use client";

/**
 * Галерея фото — общая для товара (006b) и дизайна торта на заказ (008c).
 * Фото приходят нейтральным списком `GalleryPhoto` (ключ, файл, подпись роли):
 * у товара и дизайна свои справочники ролей, галерея о них не знает.
 *
 * По макету товара 09.10 (product-frames/f0-1.png): большое фото 576×720
 * и колонка миниатюр 96×120 справа. Подпись роли («Целиком», «Срез»…) видна только
 * на заглушке, как на макете; у настоящего фото она — в alt. Активная миниатюра —
 * тёмная рамка.
 *
 * Клик по большому фото — лайтбокс (006b, `lightbox.tsx`). Фото — ссылка на файл:
 * без JS клик просто открывает картинку.
 *
 * Миниатюры — кнопки с `aria-pressed`; на фокусе стрелки ←/→ (и ↑/↓ — колонка
 * вертикальная) переключают фото. Без фото — бежевая плашка с подписью серым,
 * как на макете («Целиком · Медовик целый»).
 *
 * Первое фото — `priority` (LCP страницы), остальные лениво. Ниже 1024 —
 * миниатюры рядом под большим фото; ниже 640 большое фото листается свайпом
 * (нативная прокрутка со scroll-snap), миниатюры остаются кнопками.
 */

import Image from "next/image";
import { useRef, useState, type KeyboardEvent } from "react";
import { imageUrl } from "@/lib/api";
import { typograf } from "@/lib/format";
import { Lightbox } from "./lightbox";

export type GalleryPhoto = {
  key: string;
  storageKey: string | null | undefined;
  /** «Целиком», «Срез»…; подпись миниатюры и часть alt */
  roleLabel: string | null;
};

type Photo = GalleryPhoto;

function caption(photo: Photo | undefined, name: string): string {
  const role = photo?.roleLabel ?? null;
  return role ? `${role} · ${name}` : name;
}

function Placeholder({ text, small = false }: { text: string; small?: boolean }) {
  return (
    <span
      className={`absolute inset-0 flex items-center justify-center bg-photo px-2 text-center text-ink-subtle ${
        small ? "text-[11px] leading-tight" : "text-sm"
      }`}
    >
      {typograf(text)}
    </span>
  );
}

export function PhotoGallery({
  name,
  images,
  groupLabel = "Фотографии товара",
}: {
  name: string;
  images: Photo[];
  /** Подпись группы миниатюр для скринридера */
  groupLabel?: string;
}) {
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState<number | null>(null);
  const thumbs = useRef<(HTMLButtonElement | null)[]>([]);
  const track = useRef<HTMLDivElement>(null);
  const photos = images.length > 0 ? images : [undefined];

  function show(index: number, focus = false) {
    const next = (index + photos.length) % photos.length;
    setActive(next);
    if (focus) thumbs.current[next]?.focus();
    // На телефоне большое фото — лента со свайпом: прокручиваем к выбранному
    const strip = track.current;
    if (strip && strip.scrollWidth > strip.clientWidth) {
      strip.scrollTo({ left: next * strip.clientWidth, behavior: "smooth" });
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    show(index + step, true);
  }

  return (
    <div className="flex flex-col gap-4 max-sm:gap-0 xl:flex-row xl:items-start">
      {/* Большое фото. Ниже 640 — лента со свайпом, выше — одно выбранное фото */}
      <div
        ref={track}
        onScroll={(event) => {
          const strip = event.currentTarget;
          if (strip.scrollWidth <= strip.clientWidth) return;
          const index = Math.round(strip.scrollLeft / strip.clientWidth);
          if (index !== active) setActive(index);
        }}
        className="scrollbar-none flex w-full shrink-0 snap-x snap-mandatory overflow-x-auto max-sm:-mx-4 max-sm:w-[calc(100%+2rem)] sm:overflow-hidden xl:w-[576px]"
      >
        {photos.map((photo, index) => {
          const src = imageUrl(photo?.storageKey);
          const label = `Открыть фото крупно: ${caption(photo, name)}`;
          const open = () => setZoomed(index);
          const zoomClass = "absolute inset-0 block cursor-zoom-in";
          return (
            <div
              key={photo?.key ?? "empty"}
              className={`relative aspect-[4/5] w-full shrink-0 snap-center bg-photo ${
                index === active ? "" : "sm:hidden"
              }`}
              aria-hidden={index === active ? undefined : true}
            >
              {src ? (
                <Image
                  src={src}
                  alt={index === active ? caption(photo, name) : ""}
                  fill
                  priority={index === 0}
                  // Первое фото — LCP страницы (006b): priority даёт preload и снимает
                  // lazy, а сетевой приоритет в Next 15 поднимает только fetchPriority
                  fetchPriority={index === 0 ? "high" : undefined}
                  loading={index === 0 ? undefined : "lazy"}
                  sizes="(min-width: 1280px) 576px, (min-width: 1024px) 45vw, 100vw"
                  className="object-cover"
                />
              ) : (
                <Placeholder text={caption(photo, name)} />
              )}
              {/* Поверх фото: ссылка на файл (без JS) или кнопка у заглушки */}
              {src ? (
                <a
                  href={src}
                  aria-label={label}
                  tabIndex={index === active ? undefined : -1}
                  onClick={(event) => {
                    event.preventDefault();
                    open();
                  }}
                  className={zoomClass}
                />
              ) : (
                <button
                  type="button"
                  aria-label={label}
                  tabIndex={index === active ? undefined : -1}
                  onClick={open}
                  className={zoomClass}
                />
              )}
            </div>
          );
        })}
      </div>

      {photos.length > 1 ? (
        <div
          role="group"
          aria-label={groupLabel}
          className="flex gap-3 max-sm:h-6 max-sm:justify-center max-sm:gap-0 xl:w-24 xl:shrink-0 xl:flex-col"
        >
          {photos.map((photo, index) => {
            const src = imageUrl(photo?.storageKey);
            const role = photo?.roleLabel ?? null;
            const selected = index === active;
            return (
              <div key={photo?.key ?? index} className="flex shrink-0 flex-col items-center gap-1">
                <button
                  ref={(element) => {
                    thumbs.current[index] = element;
                  }}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`Показать фото: ${role ?? `${index + 1} из ${photos.length}`}`}
                  onClick={() => show(index)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                  className={`relative aspect-[4/5] w-24 border bg-photo transition-colors duration-150 max-sm:aspect-auto max-sm:h-6 max-sm:w-6 max-sm:border-0 max-sm:bg-transparent ${
                    selected ? "border-ink" : "border-transparent hover:border-line-strong"
                  }`}
                >
                  <span
                    className={`absolute top-1/2 left-1/2 hidden h-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full max-sm:block ${selected ? "w-[18px] bg-accent" : "w-1.5 bg-line"}`}
                    aria-hidden="true"
                  />
                  <span className="absolute inset-0 max-sm:hidden">
                    {src ? (
                      <Image
                        src={src}
                        alt=""
                        fill
                        sizes="96px"
                        loading="lazy"
                        className="object-cover"
                      />
                    ) : role ? (
                      // Без фото подпись роли — на плашке, как на макете
                      <Placeholder text={role} small />
                    ) : null}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {zoomed !== null ? (
        <Lightbox
          name={name}
          start={zoomed}
          onClose={() => setZoomed(null)}
          photos={photos.map((photo, index) => ({
            key: photo?.key ?? String(index),
            storageKey: photo?.storageKey,
            caption: caption(photo, name),
          }))}
        />
      ) : null}
    </div>
  );
}
