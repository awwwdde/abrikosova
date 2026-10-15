import type { Metadata } from "next";
import { Forum, Manrope } from "next/font/google";
import { CartProvider } from "@/components/cart-context";
import { RevealReady } from "@/components/motion/reveal-ready";
import { REVEAL_BOOT_SCRIPT } from "@/lib/reveal-boot";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import "./globals.css";

/*
  Шрифты по макету. Forum — единственное начертание 400; Manrope — вариативный,
  на макете используются 300 (подзаголовки, абзацы), 400 (меню, мета),
  600 (подписи капсом, кнопки) и 700 (цена) — вариативный файл покрывает все,
  и это один запрос вместо четырёх.
  Переменные --font-forum и --font-manrope подхватывает @theme в globals.css
  (--font-display и --font-sans); одноимённые переменные тут дали бы цикл.
*/
const forum = Forum({
  weight: "400",
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-forum",
});

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-manrope",
});

// Подтверждение прав в Яндекс.Вебмастере и Google Search Console: пусто — тега нет
const yandexVerification = process.env.NEXT_PUBLIC_YANDEX_VERIFICATION;
const googleVerification = process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION;

export const metadata: Metadata = {
  // Относительные адреса картинок и канонических ссылок достраиваются от него
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s — ${SITE_NAME}`,
  },
  description: "Торты и десерты по авторским рецептурам Елены Абрикосовой. Доставка по Москве.",
  applicationName: SITE_NAME,
  openGraph: { siteName: SITE_NAME, locale: "ru_RU", type: "website" },
  twitter: { card: "summary_large_image" },
  ...(yandexVerification || googleVerification
    ? {
        verification: {
          ...(googleVerification ? { google: googleVerification } : {}),
          ...(yandexVerification ? { yandex: yandexVerification } : {}),
        },
      }
    : {}),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: класс `js` на <html> ставит скрипт ниже до гидрации
    <html lang="ru" className={`${forum.variable} ${manrope.variable}`} suppressHydrationWarning>
      <head>
        {/* До первой отрисовки: html.js включает скрытое начальное состояние анимаций
            появления (без JS контент виден), popstate — показ без анимации при
            возврате по истории. Подробно — lib/motion.ts */}
        <script dangerouslySetInnerHTML={{ __html: REVEAL_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-canvas text-ink antialiased">
        <RevealReady />
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
