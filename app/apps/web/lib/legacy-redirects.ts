/**
 * Адреса старого сайта (Django, `old/main/urls.py`) → новые (задание 012).
 *
 * Старый сайт проиндексирован, и при переезде каждый его адрес должен **одним
 * шагом** вести туда, где теперь та же страница: 301 сразу на итоговый адрес,
 * без цепочек «сначала убрать слэш, потом сменить путь». Поэтому встроенный
 * редирект Next со слэшем в конце выключен (`skipTrailingSlashRedirect` в
 * next.config) — его делает middleware после этих правил.
 *
 * Модуль без Next и без сети: решение по адресу, а за данными (старый слаг →
 * новый, старый id подкатегории → путь) middleware ходит в API сам, по
 * `lookup`. Тесты — legacy-redirects.test.ts.
 */

export type LegacyKind = "product" | "subcategory" | "media";

export type LegacyDecision =
  | { type: "redirect"; location: string }
  /** Служебные адреса старого сайта: 410 — поисковик выкинет их быстрее, чем 404 */
  | { type: "gone" }
  /** Ответ зависит от данных: спросить API, а если соответствия нет — fallback */
  | { type: "lookup"; kind: LegacyKind; key: string; fallback: LegacyDecision }
  | null;

// POST- и AJAX-адреса старого сайта: страниц за ними не было, переносить некуда
const GONE: RegExp[] = [
  /^\/create-consultation\/?$/,
  /^\/cart\/(?:add|remove|update)\/\d+\/?$/,
  /^\/cart\/(?:count|items|clear)\/?$/,
];

// Папки upload_to старых моделей (old/main/models.py). Только они — «старые
// картинки»: под /media/ сейчас лежат и новые ключи хранилища, и статика сайта
// (public/media/hero), их трогать нельзя
const OLD_MEDIA =
  /^(?:products\/\d{4}\/\d{2}\/\d{2}|custom_cakes|custom_cakes_page|fillings|about)\//;
// Ключ нового хранилища: `<префикс>[/<id>]/<uuid>.webp` (services/storage.py)
const NEW_MEDIA_KEY = /^[a-z][a-z0-9-]*(?:\/\d+)?\/[0-9a-f]{32}\.webp$/;

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Адрес внутри сайта: ровно один «/» в начале, за ним не «/» и не «\» (012a).
 * «//evil.example» и «/\evil.example» браузер и `new URL` читают как адрес
 * чужого хоста — редирект на такой адрес был бы открытым редиректом с нашего домена.
 */
export function isInternalPath(path: string): boolean {
  return path.startsWith("/") && path[1] !== "/" && path[1] !== "\\";
}

/**
 * Путь запроса, который вообще можно разбирать как старый (012a). Повторные слэши
 * и обратный слэш — ни одного такого адреса у старого сайта не было; разбирать их
 * значило бы плодить странные адреса или, хуже, вести на чужой хост. То же после
 * раскодирования: «/%2F%2Fevil.example» не должен стать «//evil.example».
 */
function isSafeRequestPath(pathname: string): boolean {
  const decoded = decode(pathname);
  return [pathname, decoded].every(
    (path) => isInternalPath(path) && !path.includes("//") && !path.includes("\\"),
  );
}

/** Решение для пути запроса или null — адрес не старый, обрабатывать как обычно. */
export function legacyDecision(pathname: string): LegacyDecision {
  // Странный путь — не старый адрес: дальше обычная обработка (404)
  if (!isSafeRequestPath(pathname)) return null;
  if (GONE.some((pattern) => pattern.test(pathname))) return { type: "gone" };

  if (pathname.startsWith("/media/")) {
    const path = decode(pathname.slice("/media/".length));
    if (!OLD_MEDIA.test(path) || NEW_MEDIA_KEY.test(path)) return null;
    // Файл перенесли — 301 на новый адрес, иначе 410
    return { type: "lookup", kind: "media", key: path, fallback: { type: "gone" } };
  }

  const order = pathname.match(/^\/order\/success\/([^/]+)\/?$/);
  if (order) return { type: "redirect", location: `/order/${order[1]}` };

  // Оба старых вида адреса подкатегории искали SubCategory по id
  // (views.subcategory_products и views.products_by_subcategory)
  const subcategory = pathname.match(/^\/catalog\/(?:subcategory\/)?(\d+)\/?$/);
  if (subcategory) {
    return {
      type: "lookup",
      kind: "subcategory",
      key: subcategory[1]!,
      // Подкатегории больше нет — в каталог, а не в 404
      fallback: { type: "redirect", location: "/catalog" },
    };
  }

  // Слэш в конце — признак старого адреса товара (Django всегда отдавал со слэшем),
  // так что новые адреса /product/<slug> в API не ходят
  const product = pathname.match(/^\/product\/([^/]+)\/$/);
  if (product) {
    const slug = decode(product[1]!);
    return {
      type: "lookup",
      kind: "product",
      key: slug,
      // Слаг при переносе сохранили — просто без слэша
      fallback: { type: "redirect", location: `/product/${product[1]}` },
    };
  }

  // Любой другой адрес со слэшем в конце: /catalog/, /about/, /privacy/ …
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return { type: "redirect", location: pathname.replace(/\/+$/, "") || "/" };
  }

  return null;
}

export type LegacyTarget = { location?: string | null; media_key?: string | null };
export type LegacyLookup = (kind: LegacyKind, key: string) => Promise<LegacyTarget | null>;
export type LegacyOutcome = { status: 301; location: string } | { status: 410 } | null;

/**
 * Итог для адреса: 301 с Location, 410 или null. `mediaBase` — публичный адрес
 * хранилища (`/media` в разработке, домен бакета на проде).
 */
export async function legacyOutcome(
  pathname: string,
  lookup: LegacyLookup,
  mediaBase: string,
): Promise<LegacyOutcome> {
  let decision = legacyDecision(pathname);
  if (decision?.type === "lookup") {
    const target = await lookup(decision.kind, decision.key).catch(() => null);
    if (target?.location) {
      // API строит пути из слагов и абсолютных адресов не отдаёт. Пришёл такой —
      // это ошибка данных, и вести по нему посетителя нельзя (012a)
      if (!isInternalPath(target.location)) {
        console.warn("legacy: API вернул не внутренний адрес, редиректа нет", target.location);
        return null;
      }
      decision = { type: "redirect", location: target.location };
    } else if (target?.media_key) {
      decision = { type: "redirect", location: `${mediaBase}/${target.media_key}` };
    } else decision = decision.fallback;
  }
  if (!decision) return null;
  if (decision.type === "gone") return { status: 410 };
  if (decision.type === "redirect") {
    // Последний рубеж: внутренний путь или файл нашего хранилища — больше ничего
    const media = /^https?:\/\//.test(mediaBase) && decision.location.startsWith(`${mediaBase}/`);
    if (!media && !isInternalPath(decision.location)) return null;
    return { status: 301, location: decision.location };
  }
  return null;
}
