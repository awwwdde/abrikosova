import type { Metadata } from "next";
import { NotFoundPage } from "@/components/not-found-page";

/**
 * Граница 404 внутри публичного каркаса: `notFound()` при переходе внутри сайта
 * рисуется здесь, под той же шапкой (006). Первую загрузку несуществующего товара
 * отдаёт middleware через app/not-found.tsx — со статусом 404 и готовым HTML.
 * Содержимое — тот же NotFoundPage (010b).
 */
export const metadata: Metadata = {
  title: "Страница не найдена",
  robots: { index: false, follow: true },
};

export default function PublicNotFound() {
  return <NotFoundPage />;
}
