import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Кондитерская Елены Абрикосовой",
  description: "Торты и десерты ручной работы на заказ",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
