/**
 * Минимальный полифил для браузеров, поддерживаемых Tailwind 4 (package.json).
 * Остальные полифилы Next 15 — at/flat/flatMap/fromEntries/hasOwn/trim* и т. п. —
 * в этих браузерах уже встроены. Выполняется до гидрации вместо polyfill-module.
 */
export {};

if (typeof URL.canParse !== "function") {
  URL.canParse = function canParse(url: string | URL, base?: string | URL): boolean {
    if (arguments.length === 0) throw new TypeError("URL.canParse requires a URL");
    // Преобразование аргументов за пределами try: как у нативного метода,
    // исключение в пользовательском toString не должно превращаться в false.
    const input = `${url}`;
    const baseUrl = base === undefined ? undefined : `${base}`;
    try {
      new URL(input, baseUrl);
      return true;
    } catch {
      return false;
    }
  };
}
