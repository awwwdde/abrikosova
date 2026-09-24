/**
 * Форматирование размеров и сроков для интерфейса.
 *
 * Чистые функции без React: одна и та же подпись нужна в карточке каталога,
 * на странице товара и в корзине, и расходиться между ними она не должна.
 * Вес — всегда в граммах: так в макетах мудборда, и покупателю проще сравнивать
 * «1200 г» и «450 г», чем «1,2 кг» и «450 г».
 */

/**
 * Выбирает форму слова для числа по правилам русского языка.
 *
 * @param n — число, к которому относится слово (учитывается целая часть по модулю)
 * @param forms — формы для 1, 2–4 и 5–20: `["порция", "порции", "порций"]`
 * @example pluralRu(21, ["день", "дня", "дней"]) // "день"
 * @example pluralRu(12, ["день", "дня", "дней"]) // "дней" — 11–14 всегда «много»
 */
export function pluralRu(n: number, forms: readonly [string, string, string]): string {
  const abs = Math.abs(Math.trunc(n));
  const lastTwo = abs % 100;
  const last = abs % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

/**
 * Вес товара.
 *
 * @param grams — вес в граммах (`weight_grams` из API)
 * @example formatWeight(1200) // "1200 г"
 */
export function formatWeight(grams: number): string {
  return `${grams} г`;
}

/**
 * Количество порций; диапазон — через короткое тире.
 *
 * Склонение — по последнему числу: «2–3 порции», «10–12 порций».
 * Если на бэкенде порции не указаны (у сертификата, набора) — `null`,
 * и строку просто не показываем.
 *
 * @example formatPortions(10, 12) // "10–12 порций"
 * @example formatPortions(1, 1)   // "1 порция"
 * @example formatPortions(null, null) // null
 */
export function formatPortions(
  min: number | null | undefined,
  max: number | null | undefined,
): string | null {
  // Бэкенд требует оба поля или ни одного, но на случай половины — не теряем число
  const low = min ?? max;
  const high = max ?? min;
  if (low == null || high == null) return null;
  const range = low === high ? `${low}` : `${low}–${high}`;
  return `${range} ${pluralRu(high, ["порция", "порции", "порций"])}`;
}

/**
 * Размер товара одной строкой: вес и порции через точку-разделитель.
 *
 * @example formatSize(1200, 10, 12)   // "1200 г · 10–12 порций"
 * @example formatSize(150, null, null) // "150 г"
 */
export function formatSize(
  grams: number,
  min: number | null | undefined,
  max: number | null | undefined,
): string {
  const portions = formatPortions(min, max);
  return portions ? `${formatWeight(grams)} · ${portions}` : formatWeight(grams);
}

/**
 * Срок изготовления под заказ.
 *
 * `null` для 0: товар в наличии, про срок писать нечего.
 *
 * @example formatLeadTime(3) // "Готовим за 3 дня"
 * @example formatLeadTime(0) // null
 */
export function formatLeadTime(days: number): string | null {
  if (days <= 0) return null;
  return `Готовим за ${days} ${pluralRu(days, ["день", "дня", "дней"])}`;
}

/**
 * Дата из API (`YYYY-MM-DD`) в привычном виде `DD.MM.YYYY`.
 *
 * Разбираем строку вручную, а не через `new Date()`: дата без времени
 * трактуется как полночь UTC, и в часовых поясах западнее Гринвича
 * покупатель увидел бы предыдущий день.
 *
 * @example formatDate("2026-09-28") // "28.09.2026"
 */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}
