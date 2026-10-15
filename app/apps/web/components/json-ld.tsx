/** Разметка schema.org на странице (задание 012). Данные собирает lib/json-ld.ts. */

import { jsonLdHtml } from "@/lib/json-ld";

export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // jsonLdHtml экранирует «<»: текст из админки не закроет тег script
      dangerouslySetInnerHTML={{ __html: jsonLdHtml(data) }}
    />
  );
}
