/** Иконка сайта (задание 012): 32 — вкладка браузера, 192 и 512 — манифест. */

import { monogramPng } from "@/lib/og";

const SIZES = [32, 192, 512];

export function generateImageMetadata() {
  return SIZES.map((size) => ({
    id: String(size),
    size: { width: size, height: size },
    contentType: "image/png",
  }));
}

export default async function Icon({ id }: { id: string }) {
  const size = SIZES.includes(Number(id)) ? Number(id) : 32;
  return new Response(new Uint8Array(await monogramPng(size)), {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" },
  });
}
