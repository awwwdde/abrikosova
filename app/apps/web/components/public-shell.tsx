import { Analytics } from "@/components/analytics";
import { SiteFooter } from "@/components/footer";
import { Header } from "@/components/layout";
import { LenisProvider } from "@/components/lenis-provider";
import type { HeaderMenuData } from "@/components/site-header/menu-data";
import { apiGet, type Category, type ContactsPage, type CustomCakesContentPage } from "@/lib/api";

/**
 * Каркас публичных страниц: шапка, основная область и подвал. Общий для
 * публичного layout и страницы 404 (она живёт вне группы (public), но должна
 * выглядеть как сайт).
 *
 * Контакты (телефон в шапке; адрес, часы, соцсети и реквизиты в подвале)
 * и группы каталога (колонка «Торты» подвала) — из API, правятся в админке.
 * Если API недоступен, шапка остаётся без телефона, а подвал без этих
 * колонок: страница важнее одного номера.
 */
async function load<T>(path: string, fallback: T): Promise<T> {
  try {
    return await apiGet<T>(path);
  } catch {
    return fallback;
  }
}

export async function PublicShell({ children }: { children: React.ReactNode }) {
  const [contacts, categories, cakes] = await Promise.all([
    load<ContactsPage | null>("/pages/contacts", null),
    load<Category[]>("/catalog/categories", []),
    // Мега-меню «Торты на заказ» (014): карточки поводов и строка фактов
    load<CustomCakesContentPage | null>("/pages/custom_cakes", null),
  ]);
  const hours = [contacts?.work_hours_weekdays, contacts?.work_hours_weekend]
    .filter(Boolean)
    .join(", ");
  const menu: HeaderMenuData = {
    categories,
    cakes: cakes?.content.header_menu ?? null,
    telegram: contacts?.telegram_url ?? null,
    // «Гжатская улица, 5к8 · каждый день с 9:00 до 21:00» — как в мобильном меню макета
    addressLine:
      [contacts?.address, hours ? hours.charAt(0).toLowerCase() + hours.slice(1) : null]
        .filter(Boolean)
        .join(" · ") || null,
  };
  return (
    <LenisProvider>
      <div className="public-site flex min-h-screen flex-col">
        <Header phone={contacts?.phone ?? null} menu={menu} />
        <main className="flex-1">{children}</main>
        <SiteFooter contacts={contacts} categories={categories} />
      </div>
      {/* Метрика и плашка о cookie — только здесь: в админке их быть не должно (012) */}
      <Analytics />
    </LenisProvider>
  );
}
