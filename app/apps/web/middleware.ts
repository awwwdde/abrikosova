/**
 * 1. Адреса старого сайта (задание 012, lib/legacy-redirects.ts) — одним шагом
 *    на новые: 301 с итоговым адресом или 410 для служебных. Идёт первым и не
 *    зависит от того, открыт раздел или нет: старый адрес ведёт на новый, а новый
 *    уже решает, показать страницу или заглушку. Встроенный редирект Next со
 *    слэшем в конце выключен (next.config), его делает этот же шаг — иначе
 *    `/catalog/7/` давал бы цепочку 308 → 301.
 *
 * 2. Закрытые разделы (lib/pages-status.ts) → «Страница в разработке».
 *    Переписываем адрес на внутренний маршрут заглушки (rewrite): в строке браузера
 *    остаётся /catalog, ответ 200, а код страницы каталога на сервере не выполняется
 *    вовсе и в API не ходит. Проверка в layout так не умеет: layout и страница
 *    рендерятся параллельно, и страница успела бы сделать свои запросы.
 *    Прямой заход на сам адрес заглушки — 404: это не страница сайта.
 *
 * 3. Снятый с продажи или несуществующий товар (006) и дизайн торта (008c) → настоящая 404. `notFound()`
 *    в динамической странице Next 15 отдаёт пустую оболочку `__next_error__`
 *    (шапку и текст рисует уже браузер), а Suspense-заглушка дала бы мягкую 404
 *    со статусом 200. Поэтому наличие товара проверяем здесь и переписываем адрес
 *    на несуществующий маршрут: Next отдаёт готовую страницу 404 со статусом 404,
 *    шапкой и подвалом в HTML. `notFound()` в самой странице остаётся страховкой.
 *    Так же — несуществующий раздел или подраздел каталога (014): список разделов
 *    почти не меняется, его держим 5 минут.
 *
 * 4. `/checkout` → 301 на `/cart`: оформление теперь на странице корзины (007b).
 *
 * `SHOW_WIP_PAGES=true` (только серверная переменная) открывает все разделы — для
 * разработки. Рантайм nodejs, а не edge: так переменная читается при каждом
 * запросе из окружения сервера, а не вшивается при сборке.
 */

import { NextResponse, type NextRequest } from "next/server";
import {
  type LegacyKind,
  type LegacyTarget,
  legacyDecision,
  legacyOutcome,
} from "@/lib/legacy-redirects";
import { isWipPath, WIP_ROUTE } from "@/lib/pages-status";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "";
const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_URL ?? "/media";
// Хранилище картинок на проде — свой домен бакета; относительный /media — тот же сайт
const MEDIA_ORIGIN = /^https?:\/\//.test(MEDIA_URL) ? new URL(MEDIA_URL).origin : null;

// Старые адреса приходят от поисковых роботов пачками — ответ API держим 10 минут,
// и отрицательный тоже: несуществующий слаг не должен каждый раз ходить в базу
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { target: LegacyTarget | null; expires: number }>();

async function lookup(kind: LegacyKind, key: string): Promise<LegacyTarget | null> {
  const cacheKey = `${kind}:${key}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return hit.target;

  const params = new URLSearchParams({ kind, key });
  const response = await fetch(`${API_URL}/legacy/resolve?${params}`, {
    signal: AbortSignal.timeout(2000),
    cache: "no-store",
  });
  // Ошибку сервера не кэшируем — через минуту API может ожить
  if (!response.ok && response.status !== 404) throw new Error(`legacy ${response.status}`);
  const target = response.ok ? ((await response.json()) as LegacyTarget) : null;
  if (cache.size > 5000) cache.clear();
  cache.set(cacheKey, { target, expires: Date.now() + CACHE_TTL_MS });
  return target;
}

// Товар и дизайн торта (008c): «есть / нет» держим минуту — снятый в админке
// быстро станет 404, а боты, перебирающие несуществующие слаги, не ходят в API
// на каждый запрос
const PRODUCT_TTL_MS = 60 * 1000;
const products = new Map<string, { exists: boolean; expires: number }>();

/**
 * `apiPath` — путь API с сегментом адреса как есть (уже в %-кодировке):
 * декодировать не нужно, а кривой «%zz» упал бы в decodeURIComponent. null — API
 * не ответил: решать не нам, страница сама покажет страницу или ошибку.
 */
async function resourceExists(apiPath: string): Promise<boolean | null> {
  const hit = products.get(apiPath);
  if (hit && hit.expires > Date.now()) return hit.exists;
  try {
    const response = await fetch(`${API_URL}${apiPath}`, {
      signal: AbortSignal.timeout(2000),
      cache: "no-store",
    });
    if (!response.ok && response.status !== 404) return null;
    if (products.size > 5000) products.clear();
    products.set(apiPath, { exists: response.ok, expires: Date.now() + PRODUCT_TTL_MS });
    return response.ok;
  } catch {
    return null;
  }
}

// Разделы каталога: «раздел → подразделы». Меняются редко — 5 минут
const CATEGORIES_TTL_MS = 5 * 60 * 1000;
let categories: { map: Map<string, Set<string>>; expires: number } | null = null;

/** null — API не ответил: решать не нам, страница сама покажет ошибку или раздел. */
async function catalogTree(): Promise<Map<string, Set<string>> | null> {
  if (categories && categories.expires > Date.now()) return categories.map;
  try {
    const response = await fetch(`${API_URL}/catalog/categories`, {
      signal: AbortSignal.timeout(2000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const list = (await response.json()) as { slug: string; subcategories: { slug: string }[] }[];
    const map = new Map(
      list.map((category) => [category.slug, new Set(category.subcategories.map((s) => s.slug))]),
    );
    categories = { map, expires: Date.now() + CATEGORIES_TTL_MS };
    return map;
  } catch {
    return null;
  }
}

/** Есть ли раздел (и подраздел) каталога; null — неизвестно. */
async function catalogExists(category: string, subcategory?: string): Promise<boolean | null> {
  const tree = await catalogTree();
  if (!tree) return null;
  const subs = tree.get(category);
  if (!subs) return false;
  return subcategory ? subs.has(subcategory) : true;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (legacyDecision(pathname)) {
    const outcome = await legacyOutcome(pathname, lookup, MEDIA_URL);
    if (outcome?.status === 410) {
      return new NextResponse("Страница удалена.", {
        status: 410,
        headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex" },
      });
    }
    if (outcome?.status === 301) {
      // Параметры запроса сохраняем: метки рекламы и utm не должны теряться
      const target = new URL(outcome.location, request.url);
      if (search && !target.search) target.search = search;
      // Только тот же сайт или наше хранилище картинок — открытого редиректа на
      // чужой домен не будет, даже если правила выше когда-нибудь ошибутся (012a)
      if (target.origin === request.nextUrl.origin || target.origin === MEDIA_ORIGIN) {
        return NextResponse.redirect(target, 301);
      }
      console.warn("legacy: редирект на чужой origin отклонён", target.href);
    }
  }

  // Оформление переехало в корзину (007b): старые закладки и ссылки — туда
  if (pathname === "/checkout") {
    return NextResponse.redirect(new URL("/cart", request.url), 301);
  }

  const product = /^\/product\/([^/]+)$/.exec(pathname);
  if (
    product &&
    !isWipPath(pathname) &&
    (await resourceExists(`/catalog/products/${product[1]!}`)) === false
  ) {
    return NextResponse.rewrite(new URL("/__not-found", request.url));
  }

  // Неизвестный или выключенный дизайн торта на заказ — та же настоящая 404 (008c)
  const design = /^\/custom-cakes\/([^/]+)$/.exec(pathname);
  if (
    design &&
    !isWipPath(pathname) &&
    (await resourceExists(`/custom-cakes/${design[1]!}`)) === false
  ) {
    return NextResponse.rewrite(new URL("/__not-found", request.url));
  }

  const section = /^\/catalog\/([^/]+)(?:\/([^/]+))?$/.exec(pathname);
  if (section && !isWipPath(pathname) && (await catalogExists(section[1]!, section[2])) === false) {
    return NextResponse.rewrite(new URL("/__not-found", request.url));
  }

  if (pathname === WIP_ROUTE || pathname.startsWith(`${WIP_ROUTE}/`)) {
    // Несуществующий внутренний адрес → обычная 404
    return NextResponse.rewrite(new URL("/__not-found", request.url));
  }

  // Служебное и файлы (картинки, robots.txt, OG-картинки) заглушка не закрывает
  const isFile =
    /\.[a-z0-9]+$/i.test(pathname) ||
    pathname.startsWith("/media/") ||
    // Картинки next/og (opengraph-image, icon) — без расширения в адресе; внутри
    // группы маршрутов Next добавляет к имени хэш: /opengraph-image-1c1a04
    /\/(?:opengraph-image|twitter-image|icon|apple-icon)(?:-[a-z0-9]+)?(?:\/[^/]*)?$/.test(
      pathname,
    );
  if (
    process.env.SHOW_WIP_PAGES === "true" ||
    isFile ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/dev/") ||
    !isWipPath(pathname)
  ) {
    return NextResponse.next();
  }

  return NextResponse.rewrite(new URL(WIP_ROUTE, request.url));
}

export const config = {
  runtime: "nodejs",
  // Всё, кроме сборки Next и API-маршрутов сайта: старые адреса картинок (/media/…)
  // и адреса со слэшем в конце middleware должен видеть
  matcher: ["/((?!_next/|api/).*)"],
};
