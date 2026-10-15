/**
 * Метаданные страниц (задание 012): канонический адрес, Open Graph, Twitter.
 *
 * Next сливает `openGraph` страницы с корневым не глубоко, а целиком: если
 * страница задала свой openGraph, `locale` и `siteName` из layout пропадут.
 * Поэтому общие поля собирает этот помощник, а страницы зовут его, а не
 * пишут openGraph руками.
 */

import type { Metadata } from "next";

export const SITE_NAME = "Кондитерская Елены Абрикосовой";

/**
 * Адрес сайта без слэша в конце: для metadataBase, sitemap, robots и JSON-LD.
 *
 * Сначала — серверные переменные, их читают при запуске: на платформе-хостинге
 * образ собирается один раз без адреса стенда, а `PUBLIC_SITE_URL` приходит в
 * окружение контейнера (deploy/README.md). `NEXT_PUBLIC_SITE_URL` вшивается при
 * сборке и остаётся для compose и старой схемы деплоя. Модуль читают только
 * серверные компоненты — в браузере эти переменные не нужны.
 */
export const SITE_URL = (
  process.env.SITE_URL ||
  process.env.PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "http://localhost:3000"
).replace(/\/+$/, "");

/** Абсолютный адрес: JSON-LD и sitemap не понимают относительных. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Описание для сниппета: без переносов и не длиннее ~160 символов, по границе слова. */
export function snippet(text: string, limit = 160): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= limit) return flat;
  const cut = flat.slice(0, limit - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,.;:—–-]+$/, "")}…`;
}

export function pageMetadata({
  title,
  description,
  path,
  noindex = false,
  canonical = !noindex,
  absoluteTitle = false,
}: {
  title: string;
  description: string;
  /** Канонический путь без параметров: у списков с фильтрами ?occasion=… — без них */
  path: string;
  /** Корзина, оформление, заказ: в выдаче им делать нечего */
  noindex?: boolean;
  /**
   * Указывать ли канонический адрес. По умолчанию — только у индексируемых страниц.
   * Каталог с фильтрами (005b) — noindex, но с каноническим адресом раздела.
   */
  canonical?: boolean;
  /** Главная: заголовок без шаблона «… — Кондитерская Елены Абрикосовой» */
  absoluteTitle?: boolean;
}): Metadata {
  const description_ = snippet(description);
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description: description_,
    // У закрытой от индекса страницы канонический адрес обычно не нужен
    ...(canonical ? { alternates: { canonical: path } } : {}),
    openGraph: {
      title,
      description: description_,
      url: path,
      siteName: SITE_NAME,
      locale: "ru_RU",
      type: "website",
    },
    twitter: { card: "summary_large_image", title, description: description_ },
    // noindex, но ссылки со страницы (на товары в корзине) поисковик пусть видит
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
