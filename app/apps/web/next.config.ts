import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // нужен для runner-стадии Dockerfile (COPY .next/standalone)
  output: "standalone",
  images: {
    // Боевые изображения лежат в S3 Object Storage Timeweb Cloud (см. 05-nonfunctional-and-acceptance.md).
    // Конкретный хост бакета добавляется сюда на этапе загрузки изображений (Этап 3).
    remotePatterns: [],
  },
};

export default nextConfig;
