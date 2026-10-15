import type { Metadata } from "next";
import { UnderConstruction } from "@/components/under-construction";

/**
 * Заглушка закрытых разделов. Сюда переписывает middleware.ts (адрес в браузере
 * остаётся прежним), прямой заход — 404. Ответ 200: адрес настоящий, страница будет,
 * но в поиск её пока не пускаем.
 */
export const metadata: Metadata = {
  title: "Страница в разработке",
  robots: { index: false, follow: true },
};

export default function UnderConstructionPage() {
  return <UnderConstruction title="Страница в разработке" />;
}
