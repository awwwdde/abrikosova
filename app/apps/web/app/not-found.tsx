import type { Metadata } from "next";
import { NotFoundPage } from "@/components/not-found-page";
import { PublicShell } from "@/components/public-shell";

/**
 * 404 для адресов, которых нет вовсе, и для несуществующего или снятого товара
 * (middleware переписывает его сюда, 006). Файл лежит вне группы (public),
 * поэтому каркас подключается здесь. Содержимое — общий NotFoundPage (010b).
 */
export const metadata: Metadata = {
  title: "Страница не найдена",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <PublicShell>
      <NotFoundPage />
    </PublicShell>
  );
}
