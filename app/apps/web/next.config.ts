import type { NextConfig } from "next";

/**
 * Изображения.
 *
 * `NEXT_PUBLIC_MEDIA_URL` — то, что видит браузер. В разработке это
 * относительный путь `/media`, который Next проксирует на MinIO по внутреннему
 * имени сервиса: снаружи контейнера хранилище доступно как localhost:9000,
 * а изнутри — только как minio:9000, и один абсолютный адрес не подходит обеим
 * сторонам сразу. На проде это публичный домен бакета, одинаковый для всех.
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
  // нужен для runner-стадии Dockerfile (COPY .next/standalone)
  output: "standalone",
  images: { remotePatterns },
  async rewrites() {
    if (!mediaInternalUrl) return [];
    return [{ source: "/media/:path*", destination: `${mediaInternalUrl}/:path*` }];
  },
};

export default nextConfig;
