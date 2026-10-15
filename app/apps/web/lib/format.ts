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
 * Вес необязателен (у сертификата его нет): без веса и порций — `null`,
 * и строку размера не выводим вовсе.
 *
 * @example formatSize(1200, 10, 12)    // "1200 г · 10–12 порций"
 * @example formatSize(150, null, null) // "150 г"
 * @example formatSize(null, null, null) // null
 */
export function formatSize(
  grams: number | null | undefined,
  min: number | null | undefined,
  max: number | null | undefined,
): string | null {
  const parts = [grams != null ? formatWeight(grams) : null, formatPortions(min, max)].filter(
    (part): part is string => part !== null,
  );
  return parts.length > 0 ? parts.join(" · ") : null;
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

const MONTHS_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
] as const;

/**
 * Дата полностью — «Редакция от 1 октября 2026 года» (правовые документы, 010b).
 * Разбор без часового пояса, как у `formatDate`. Не дата — null: строку не показываем.
 *
 * @example formatLongDate("2026-10-01") // "1 октября 2026 года"
 */
export function formatLongDate(isoDate: string | null | undefined): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate ?? "");
  const month = match ? MONTHS_GENITIVE[Number(match[2]) - 1] : undefined;
  if (!match || !month) return null;
  return `${Number(match[3])} ${month} ${match[1]} года`;
}

/**
 * Имя в Telegram из ссылки: «https://t.me/abricosova_elena» → «@abricosova_elena».
 * Ссылку вводят в админке, и `new URL` на кривом адресе бросил бы исключение и
 * уронил страницу. Здесь ничего не бросается: не распознали — null, и на странице
 * остаётся сама ссылка без подписи-имени.
 *
 * @example telegramHandle("https://t.me/abricosova_elena/") // "@abricosova_elena"
 * @example telegramHandle("не ссылка") // null
 */
export function telegramHandle(url: string | null | undefined): string | null {
  const match =
    /^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\/@?([A-Za-z0-9_]{3,64})\/?(?:[?#].*)?$/i.exec(
      (url ?? "").trim(),
    );
  return match ? `@${match[1]}` : null;
}

/**
 * Короткая дата для списков админки: «2 окт, чт» (011d). Как и `formatDate`,
 * разбирается как дата без часового пояса — иначе в поясе западнее Москвы
 * день сдвинулся бы на предыдущий.
 *
 * @example formatDayShort("2026-10-02") // "2 окт, пт"
 */
export function formatDayShort(isoDate: string): string {
  const day = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("ru-RU", { ...options, timeZone: "UTC" }).format(day).replace(".", "");
  return `${format({ day: "numeric", month: "short" })}, ${format({ weekday: "short" })}`;
}

/**
 * Срок до готовности для карточки товара, капсом по макету.
 *
 * `null` для 0 — товар на витрине, карточка показывает кнопку «+».
 * «БУДЕТ ЗАВТРА» нарисовано на макете; для 2 дней и больше состояния
 * в макете нет — сделано по аналогии: «ЧЕРЕЗ 3 ДНЯ».
 *
 * @example formatReadyIn(1) // "Будет завтра"
 * @example formatReadyIn(5) // "Через 5 дней"
 */
export function formatReadyIn(days: number): string | null {
  if (days <= 0) return null;
  if (days === 1) return "Будет завтра";
  return `Через ${days} ${pluralRu(days, ["день", "дня", "дней"])}`;
}

const MONTHS_NOMINATIVE = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
];

/**
 * Месяц и год работы из `made_in` (`YYYY-MM-DD`, день всегда 01): «август 2025».
 * Капс даёт CSS — в тексте обычный регистр, чтобы скринридер не читал по буквам.
 */
export function formatMonthYear(isoDate: string): string {
  const [year, month] = isoDate.split("-");
  return `${MONTHS_NOMINATIVE[Number(month) - 1]} ${year}`;
}

/**
 * Телефон из контактов в виде макета и ссылка `tel:`.
 *
 * В админке номер вводят как угодно («8-962-352-22-77», «+7 (962) …»);
 * российский номер из 11 цифр приводим к «+7 962 352-22-77». Всё, что
 * не распознано, показываем как ввели — лучше некрасиво, чем неправильно.
 *
 * @example formatPhone("8-962-352-22-77") // { display: "+7 962 352-22-77", href: "tel:+79623522277" }
 */
export function formatPhone(raw: string): { display: string; href: string } {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && (digits[0] === "8" || digits[0] === "7")) {
    const d = `7${digits.slice(1)}`;
    return {
      display: `+7 ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9, 11)}`,
      href: `tel:+${d}`,
    };
  }
  return { display: raw, href: `tel:${raw.replace(/[^\d+]/g, "")}` };
}

/**
 * Вес торта на заказ: от килограмма — в килограммах с запятой, меньше — в граммах.
 * Для работ так читается привычнее, чем «6000 г».
 *
 * @example formatCakeWeight(6000) // "6 кг"
 * @example formatCakeWeight(1800) // "1,8 кг"
 * @example formatCakeWeight(900)  // "900 г"
 */
export function formatCakeWeight(grams: number): string {
  if (grams < 1000) return `${grams} г`;
  return `${(grams / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} кг`;
}

/**
 * Подпись работы «3 яруса · 6 кг · 45 гостей»; незаполненные части пропускаются.
 *
 * @example formatWorkMeta(1, 1800, 12) // "1 ярус · 1,8 кг · 12 гостей"
 * @example formatWorkMeta(null, null, 2) // "2 гостя"
 */
export function formatWorkMeta(
  tiers: number | null | undefined,
  weightGrams: number | null | undefined,
  guests: number | null | undefined,
): string {
  return [
    tiers ? `${tiers} ${pluralRu(tiers, ["ярус", "яруса", "ярусов"])}` : null,
    weightGrams ? formatCakeWeight(weightGrams) : null,
    guests ? `${guests} ${pluralRu(guests, ["гость", "гостя", "гостей"])}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Строка карточки дизайна торта на заказ (008b): «3 яруса · от 40 гостей».
 * После «от» — родительный падеж: «от 21 гостя», «от 13 гостей».
 */
export function formatDesignMeta(tiers: number, minGuests: number): string {
  return [
    `${tiers} ${pluralRu(tiers, ["ярус", "яруса", "ярусов"])}`,
    `от ${minGuests} ${pluralRu(minGuests, ["гостя", "гостей", "гостей"])}`,
  ].join(" · ");
}

/** Неразрывный пробел. */
const NBSP = " ";

/**
 * Типографика при выводе текста (решение заказчика 30.09): короткие слова не висят
 * в конце строки, число не отрывается от слова, тире не начинает строку. Текст в базе
 * не меняется — функция применяется при выводе, в том числе к тексту из админки.
 *
 * Заменяет обычный пробел (ровно один) на неразрывный:
 * - после слова из 1–2 кириллических букв в начале слова — предлоги, союзы
 *   («в», «и», «на», «по», «не»…), в том числе после «, (, — и в начале строки;
 *   подряд идущие короткие слова («и в доме») — тоже: проверка слева не поглощает символ.
 *   Частицы сюда не входят: они клеятся к предыдущему слову, а не к следующему;
 * - перед частицами «ли», «же», «бы», «ль», «б» — только строчными;
 * - в инициалах: «Е. О.», «Абрикосова Е. О.», «Е. О. Абрикосова», «Артём Б.»;
 * - между числом и следующим словом («12 лет», «5 кг», «480 ₽»);
 * - перед тире « — » и « – ».
 *
 * Двойные пробелы и уже неразрывные не трогает, поэтому функция идемпотентна.
 * Латиница, адреса, e-mail и телефоны («+7 962 352-22-77») не портятся: правила
 * срабатывают только на кириллические слова и на «число + буква».
 *
 * @example typograf("и в доме") // "и в доме"
 * @example typograf("12 лет в профессии") // "12 лет в профессии"
 */
export function typograf(text: string): string;
export function typograf(text: string | null | undefined): string | null | undefined;
export function typograf(text: string | null | undefined): string | null | undefined {
  if (!text) return text;
  return (
    text
      // Инициалы: «Е. О.», «Абрикосова Е. О.», «Е. О. Абрикосова», «Артём Б.».
      // Инициал — одна заглавная буква с точкой, отдельным словом. «торт. В составе»
      // не инициал: после «В» нет точки
      .replace(/(?<=(?:^|[\s«(])[А-ЯЁ]\.) (?=[А-ЯЁ]\.)/gu, NBSP)
      .replace(/(?<=[А-ЯЁ][а-яё]+) (?=[А-ЯЁ]\.(?:[\s,;:)»]|$))/gu, NBSP)
      .replace(/(?<=(?:^|[\s«(])[А-ЯЁ]\.) (?=[А-ЯЁ][а-яё])/gu, NBSP)
      // Короткое слово + один пробел — кроме частиц: они клеятся к предыдущему
      // слову, не к следующему. Регистр любой («В составе»), частицы — только
      // строчные: «Ли Мин» — не частица. Дефиса слева нет: в «кто-то из» слово «то»
      // не отдельное
      .replace(
        /(?<=^|[\s«„"'(\[—–])(?!(?:ли|же|бы|ль|б)(?![а-яёА-ЯЁ]))([а-яёА-ЯЁ]{1,2}) (?=\S)/gu,
        `$1${NBSP}`,
      )
      // Частица после слова — только строчная
      .replace(/(?<=\S) (?=(?:ли|же|бы|ль|б)(?![а-яёА-ЯЁ\d]))/gu, NBSP)
      // Число + слово
      .replace(/(?<=\d) (?=[а-яёa-z₽%])/giu, NBSP)
      // Перед тире
      .replace(/(?<=\S) (?=[—–] )/gu, NBSP)
  );
}
