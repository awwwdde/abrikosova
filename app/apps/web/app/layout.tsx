import type { Metadata } from "next";
import { CartProvider } from "@/components/cart-context";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Кондитерская Елены Абрикосовой",
    template: "%s — Кондитерская Елены Абрикосовой",
  },
  description: "Торты и десерты ручной работы на заказ",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
