import type { NextConfig } from "next";

/**
 * Изображения.
 *
 * `NEXT_PUBLIC_MEDIA_URL` — то, что видит браузер. В разработке это
 * относительный путь `/media`, который Next проксирует на API. Там публикуются
 * только каталоги фото и видео; референсы из заявок и копии БД закрыты.
 *
 * remotePatterns заполняется только для абсолютного адреса: next/image грузит
 * лишь перечисленные хосты, иначе сайт стал бы открытым прокси для чужих картинок.
 */
const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL ?? "/media";
const mediaInternalUrl = process.env.MEDIA_INTERNAL_URL;

const remotePatterns = mediaUrl.startsWith("http")
  ? [
      (() => {
        const media = new URL(mediaUrl);
        return {
          protocol: media.protocol.replace(":", "") as "http" | "https",
          hostname: media.hostname,
          port: media.port || undefined,
          pathname: `${media.pathname}/**`,
        };
      })(),
    ]
  : [];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Слэш в конце убирает middleware вместе с переносом адресов старого сайта
  // (задание 012): встроенный 308 Next срабатывал раньше middleware, и
  // /catalog/7/ давал цепочку 308 → /catalog/7 → 301 → /catalog/torty/bento
  skipTrailingSlashRedirect: true,
  // Метатеги — всегда в <head> (005b). Каталог рендерится по параметрам адреса,
  // и Next 15 для таких страниц «стримит» title/description в тело — в <head>
  // они попадают только для короткого списка ботов, где нет ни Яндекса, ни
  // Lighthouse. Цена — страница ждёт generateMetadata (запрос разделов из кэша)
  htmlLimitedBots: /.*/,
  // нужен для runner-стадии Dockerfile (COPY .next/standalone)
  output: "standalone",
  // Шрифты картинок next/og (lib/og.tsx) читаются через fs — без явного включения
  // трассировка standalone их не видит и на проде OG-картинки падали бы
  outputFileTracingIncludes: { "/**": ["./assets/og-fonts/**"] },
  images: { remotePatterns },
  async rewrites() {
    if (!mediaInternalUrl) return [];
    return [{ source: "/media/:path*", destination: `${mediaInternalUrl}/:path*` }];
  },
  /**
   * Админка (задание 011a): её нельзя встроить во фрейм чужого сайта (кликджекинг),
   * адрес админки не уходит в Referer на внешние сайты, а страницы не кэшируются
   * ни браузером, ни прокси — после выхода «назад» не покажет чужие данные.
   */
  async headers() {
    const adminHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
      { key: "Referrer-Policy", value: "same-origin" },
      { key: "Cache-Control", value: "no-store" },
    ];
    return [
      { source: "/admin", headers: adminHeaders },
      { source: "/admin/:path*", headers: adminHeaders },
    ];
  },
};

export default nextConfig;
