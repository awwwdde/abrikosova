/**
 * Чистые функции страницы входа в админку (задание 011a). Без React — чтобы
 * покрыть тестами (lib/admin-login.test.ts).
 */

/**
 * Куда вернуть после входа. Только относительный путь внутри `/admin`:
 * иначе ссылка «/admin/login?next=https://evil.example» после входа уводила бы
 * на чужой сайт (open redirect). Всё остальное — на главную админки.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return "/admin";
  // Обратный слэш браузеры читают как прямой: «/\evil.example» — чужой хост
  if (next.includes("\\") || /[\u0000-\u001f]/.test(next)) return "/admin";
  let url: URL;
  try {
    url = new URL(next, "http://admin.local");
  } catch {
    return "/admin";
  }
  // Путь должен остаться на нашем «хосте» и начинаться с /admin — «//evil.example»
  // и «https://…» уводят на другой хост и отсекаются здесь
  if (url.origin !== "http://admin.local") return "/admin";
  if (url.pathname !== "/admin" && !url.pathname.startsWith("/admin/")) return "/admin";
  // Возврат на сам вход зациклил бы редирект
  if (url.pathname === "/admin/login") return "/admin";
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Длина слота смены фото: 10 минут. */
export const PHOTO_SLOT_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Детерминированный генератор (mulberry32): одинаковый сид — одинаковый порядок. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Список фото, перемешанный по сиду дня: у всех открытых вкладок в течение суток
 * один и тот же порядок, а на следующий день — другой.
 */
export function shuffleForDay<T>(items: readonly T[], now: number): T[] {
  const next = random(Math.floor(now / DAY_MS));
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const swap = result[i] as T;
    result[i] = result[j] as T;
    result[j] = swap;
  }
  return result;
}

/**
 * Какое фото показывать сейчас: номер 10-минутного слота → индекс в списке дня.
 * Все вкладки показывают одно фото, при перезагрузке оно не прыгает.
 */
export function photoIndexAt(count: number, now: number): number {
  if (count <= 0) return -1;
  return Math.floor(now / PHOTO_SLOT_MS) % count;
}

/** Сколько миллисекунд до следующей смены фото. */
export function msUntilNextSlot(now: number): number {
  return PHOTO_SLOT_MS - (now % PHOTO_SLOT_MS);
}

/** «14:59» для отсчёта блокировки. */
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}
