/** Иконка для «На экран домой» в iOS (задание 012). */

import { monogramPng } from "@/lib/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  return new Response(new Uint8Array(await monogramPng(180)), {
    headers: { "content-type": "image/png" },
  });
}
