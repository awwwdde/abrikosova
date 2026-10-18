/**
 * Карточки, фото, служебные блоки и цена.
 */

import Image from "next/image";
import Link from "@/components/page-transition";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/json-ld";
import { Reveal, RevealText } from "@/components/motion";
import { imageUrl } from "@/lib/api";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import { MOTION } from "@/lib/motion";
import { typograf } from "@/lib/format";

/**
 * Служебная карточка (корзина, чекаут, админка). В макете теней нет,
 * поэтому граница — тонкая линия `line`, углы прямые.
 */
export function Card({
  className = "",
  interactive = false,
  children,
}: {
  className?: string;
  interactive?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`border border-line bg-surface ${
        interactive
          ? "transition-[border-color] duration-200 ease-out-soft hover:border-accent"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Фотография товара или работы.
 *
 * Пока изображения нет — показывает заглушку с тем же соотношением сторон,
 * поэтому сетка не «прыгает» при появлении реальных фото. Загрузка через
 * next/image с явным `sizes`: браузер скачивает вариант под свою ширину,
 * а не полноразмерный файл.
 */
export function Picture({
  storageKey,
  alt,
  ratio = "4/5",
  sizes = "(min-width: 768px) 25vw, 50vw",
  priority = false,
  className = "",
  placeholderLabel,
}: {
  storageKey: string | null | undefined;
  alt: string;
  ratio?: "4/5" | "1/1" | "16/9" | "3/2";
  sizes?: string;
  priority?: boolean;
  className?: string;
  /** Подпись заглушки без фото — название товара серым по центру (макет каталога) */
  placeholderLabel?: string;
}) {
  const src = imageUrl(storageKey);

  if (!src)
    return <ImagePlaceholder ratio={ratio} label={placeholderLabel} className={className} />;

  return (
    <div
      style={{ aspectRatio: `var(--picture-ratio, ${ratio})` }}
      className={`relative w-full overflow-hidden bg-photo ${className}`}
    >
      <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
    </div>
  );
}

/**
 * Место под фото. Фиксированное соотношение сторон держит сетку ровной
 * ещё до того, как появятся реальные изображения.
 */
export function ImagePlaceholder({
  ratio = "4/5",
  label,
  fill = false,
  className = "",
}: {
  ratio?: "4/5" | "1/1" | "16/9" | "3/2";
  label?: string;
  /** Заполнить родителя целиком — для плиток бенто, где высоту задаёт сетка. */
  fill?: boolean;
  className?: string;
}) {
  return (
    <div
      style={fill ? undefined : { aspectRatio: `var(--picture-ratio, ${ratio})` }}
      className={`flex items-center justify-center bg-photo ${
        fill ? "absolute inset-0" : "w-full"
      } ${className}`}
      aria-hidden="true"
    >
      {label ? (
        <span className="px-4 text-center text-[13px] text-ink-subtle">{typograf(label)}</span>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="border border-dashed border-line-strong px-6 py-16 text-center">
      <p className="font-display text-lg text-ink">{typograf(title)}</p>
      {description ? (
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">{typograf(description)}</p>
      ) : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** Крошки сайта. Разметка BreadcrumbList — из того же массива (012): видимые
 * крошки и то, что видит поисковик, не разойдутся.
 *
 * Разделитель «/» — в одном блоке с предыдущим пунктом: при переносе он остаётся
 * в конце строки, а не начинает следующую (014). Ниже 640 крошки в одну строку,
 * длинный последний пункт обрезается многоточием — полный текст есть в H1
 * страницы и в доступном имени пункта (`aria-current`). Отступы те же, что были:
 * 10px перед «/» и 8px после. */
export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(items)} />
      <nav
        aria-label="Хлебные крошки"
        className="flex flex-wrap items-center gap-x-2 text-sm text-ink-subtle max-sm:flex-nowrap"
      >
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <span
              key={`${item.label}-${index}`}
              className={`flex items-center gap-x-2.5 ${last ? "min-w-0" : "shrink-0 max-sm:min-w-0 max-sm:shrink"}`}
            >
              {item.href ? (
                <Link
                  href={item.href}
                  className="transition-colors duration-150 hover:text-ink max-sm:truncate"
                >
                  {typograf(item.label)}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className="text-ink-muted max-sm:truncate"
                >
                  {typograf(item.label)}
                </span>
              )}
              {last ? null : <span aria-hidden="true">/</span>}
            </span>
          );
        })}
      </nav>
    </>
  );
}

/**
 * Заголовок секции по макету («Готово сегодня», «Сделано на заказ»):
 * слева заголовок Forum 56 и подзаголовок, справа — стрелки карусели
 * (`controls`) и кнопка (`action`), выровненные по низу подзаголовка.
 * `eyebrow` оставлен для существующих страниц.
 *
 * `subtitleGap` — отступ заголовок → подзаголовок: на макете он разный
 * у двух секций главной (8 и 16px), повторяем как нарисовано. `bottomGap` —
 * отступ до ленты: на главной 63px, на странице товара (006) 48px.
 */
export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  controls,
  action,
  subtitleGap = "mt-[8.6px]",
  bottomGap = "md:mb-[63px]",
  className = "",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  controls?: ReactNode;
  action?: ReactNode;
  subtitleGap?: string;
  bottomGap?: string;
  className?: string;
}) {
  return (
    <div
      className={`mb-10 flex flex-wrap items-end justify-between gap-x-6 gap-y-6 ${bottomGap} ${className}`}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <Reveal as="p" delay={0} className="eyebrow mb-3">
            {eyebrow}
          </Reveal>
        ) : null}
        <RevealText as="h2" className="text-section">
          {title}
        </RevealText>
        {subtitle ? (
          <Reveal as="p" className={`text-subtitle font-light text-ink-muted ${subtitleGap}`}>
            {subtitle}
          </Reveal>
        ) : null}
      </div>
      {controls || action ? (
        <Reveal delay={MOTION.button.delay} className="flex items-center gap-4">
          {controls ? <div className="hidden items-center gap-2 md:flex">{controls}</div> : null}
          {action}
        </Reveal>
      ) : null}
    </div>
  );
}

export function Price({ value, className = "" }: { value: string; className?: string }) {
  const number = Number.parseFloat(value);
  return (
    <span className={`tnum ${className}`}>
      {number.toLocaleString("ru-RU", { maximumFractionDigits: 0 })}&nbsp;₽
    </span>
  );
}
