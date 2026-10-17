/**
 * Картинки для соцсетей и мессенджеров (Open Graph, 1200×630) и иконки сайта —
 * генерируются next/og (задание 012).
 *
 * Шрифты — файлы из assets/og-fonts (лицензия OFL — рядом): генератор не умеет
 * woff2 и не видит шрифты next/font, а без кириллицы вместо текста были бы квадраты.
 *
 * Заголовок Forum рисует не генератор, а sharp (libvips + Pango, полноценная
 * раскладка HarfBuzz) и вставляет картинкой. Генератор мерит слово без кернинга,
 * а рисует с кернингом: после слов с сильными парами («Торты» — Т+о) оставалась
 * дыра шириной в пробел. Manrope этим не страдает и остаётся текстом.
 *
 * Фото конвертируется sharp в JPEG: генератор не читает webp, а все фото
 * хранилища — webp. Логотип — маска (logo.png), перекрашивается в бордо там же.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { typograf } from "./format";

export const OG_SIZE = { width: 1200, height: 630 };

const ROOT = process.cwd();
const FONT_DIR = path.join(ROOT, "assets", "og-fonts");
const HERO_POSTER = path.join(ROOT, "public", "media", "hero", "poster-main.jpg");
const LOGO = path.join(ROOT, "public", "brand", "logo.png");

export const COLORS = { cream: "#FBF7F0", ink: "#1A1210", muted: "#5A524F", accent: "#842124" };

type Font = { name: string; data: Buffer; weight: 400 | 600; style: "normal" };

/**
 * У каждого файла Manrope своё имя: генератор оставляет один шрифт на сочетание
 * «имя + начертание», и второй файл с тем же именем (кириллица после латиницы)
 * терялся. Поэтому в стилях — список: глиф берётся из первого шрифта, где он есть.
 */
const MANROPE = "Manrope, Manrope Latin, Manrope Ext";

export async function ogFonts(): Promise<Font[]> {
  const load = async (file: string, name: string, weight: 400 | 600): Promise<Font> => ({
    name,
    weight,
    style: "normal",
    data: await readFile(path.join(FONT_DIR, file)),
  });
  return Promise.all([
    load("manrope-cyrillic-400-normal.woff", "Manrope", 400),
    load("manrope-cyrillic-600-normal.woff", "Manrope", 600),
    load("manrope-latin-400-normal.woff", "Manrope Latin", 400),
    load("manrope-latin-600-normal.woff", "Manrope Latin", 600),
    // «₽» есть только в latin-ext
    load("manrope-latin-ext-400-normal.woff", "Manrope Ext", 400),
  ]);
}

export type TextImage = { src: string; width: number; height: number };

const escapeMarkup = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Заголовок Forum картинкой (см. шапку модуля): перенос по словам в заданную
 * ширину. typograf ставит неразрывный пробел после предлогов — «по» не повиснет
 * в конце строки (Pango переносит по обычным пробелам, неразрывные держит).
 */
export async function titleImage(text: string, size: number, width: number): Promise<TextImage> {
  const { data, info } = await sharp({
    text: {
      text: `<span foreground="${COLORS.ink}">${escapeMarkup(typograf(text.replace(/[ \t\n]+/g, " ").trim()))}</span>`,
      fontfile: path.join(FONT_DIR, "Forum-Regular.ttf"),
      font: `Forum ${size}`,
      // 72 dpi: размер шрифта в пунктах равен пикселям картинки
      dpi: 72,
      width,
      wrap: "word",
      rgba: true,
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { src: dataUri(data, "image/png"), width: info.width, height: info.height };
}

const dataUri = (buffer: Buffer, type: string) =>
  `data:${type};base64,${buffer.toString("base64")}`;

/** Логотип нужного цвета: альфа-канал маски + заливка цветом. */
export async function logoDataUri(color: string = COLORS.accent): Promise<string> {
  const mask = sharp(LOGO).ensureAlpha();
  const { width = 640, height = 178 } = await mask.metadata();
  const alpha = await mask.extractChannel(3).toBuffer();
  const png = await sharp({ create: { width, height, channels: 3, background: color } })
    .joinChannel(alpha)
    .png()
    .toBuffer();
  return dataUri(png, "image/png");
}

/**
 * Фото для правой части карточки: из хранилища по адресу или файл героя.
 * Не загрузилось — фото героя: картинка без фото хуже, чем с чужим тортом
 * кондитерской.
 */
export async function photoDataUri(source: string | null, width = 480): Promise<string> {
  let input: Buffer;
  try {
    if (!source) throw new Error("нет фото");
    const response = await fetch(source, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`фото ${response.status}`);
    input = Buffer.from(await response.arrayBuffer());
  } catch {
    input = await readFile(HERO_POSTER);
  }
  const jpeg = await sharp(input)
    .resize(width, OG_SIZE.height, { fit: "cover" })
    .jpeg({ quality: 82 })
    .toBuffer();
  return dataUri(jpeg, "image/jpeg");
}

/** Адрес фото из хранилища для сервера: изнутри docker-сети бакет доступен по своему имени. */
export function serverMediaUrl(key: string | null | undefined): string | null {
  if (!key || key.startsWith("placeholder/")) return null;
  const base =
    process.env.MEDIA_INTERNAL_URL ??
    (process.env.NEXT_PUBLIC_MEDIA_URL?.startsWith("http")
      ? process.env.NEXT_PUBLIC_MEDIA_URL
      : null);
  return base ? `${base}/${key}` : null;
}

/** Карточка: слева логотип, заголовок Forum и подпись, справа фото во всю высоту. */
export function OgCard({
  logo,
  photo,
  title,
  subtitle,
  footer,
}: {
  logo: string;
  photo: string;
  title: TextImage;
  subtitle?: string;
  footer?: string;
}) {
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", background: COLORS.cream }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          flex: 1,
          padding: "64px 64px 56px 72px",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- next/og рисует только <img> */}
        <img src={logo} width={216} height={60} alt="" />
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- next/og рисует только <img> */}
          <img src={title.src} width={title.width} height={title.height} alt="" />
          {subtitle ? (
            <div
              style={{
                fontFamily: MANROPE,
                fontSize: 28,
                lineHeight: 1.35,
                color: COLORS.muted,
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
        <div
          style={{
            fontFamily: MANROPE,
            fontWeight: 600,
            fontSize: 20,
            letterSpacing: 2.4,
            textTransform: "uppercase",
            color: COLORS.accent,
          }}
        >
          {footer ?? "Москва"}
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- next/og рисует только <img> */}
      <img src={photo} width={480} height={630} alt="" style={{ objectFit: "cover" }} />
    </div>
  );
}

/**
 * Временная иконка-монограмма «EA» (Forum, кремовая на бордо). Векторного
 * логотипа и отдельного знака нет (new/design/logo.svg — PNG внутри), пункт для
 * дизайнера — в README «Отложено». Буквы рисует sharp, как заголовки карточек.
 */
export async function monogramPng(size: number): Promise<Buffer> {
  const radius = Math.round(size * 0.22);
  const base = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<rect width="${size}" height="${size}" rx="${radius}" fill="${COLORS.accent}"/></svg>`,
  );
  const letters = await sharp({
    text: {
      text: `<span foreground="${COLORS.cream}">EA</span>`,
      fontfile: path.join(FONT_DIR, "Forum-Regular.ttf"),
      font: `Forum ${Math.round(size * 0.52)}`,
      dpi: 72,
      rgba: true,
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
  return sharp(base)
    .composite([
      {
        input: letters.data,
        left: Math.round((size - letters.info.width) / 2),
        // Чуть выше геометрического центра: у Forum прописные с большим нижним полем
        top: Math.round((size - letters.info.height) / 2 - size * 0.02),
      },
    ])
    .png()
    .toBuffer();
}
