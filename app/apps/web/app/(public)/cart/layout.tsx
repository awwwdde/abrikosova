/** Метаданные для клиентской страницы: noindex всегда — в выдаче ей делать нечего (012). */

import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Корзина",
  description: "Товары, которые вы выбрали.",
  path: "/cart",
  noindex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
