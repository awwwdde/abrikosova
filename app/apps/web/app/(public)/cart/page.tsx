/**
 * «Корзина» по кадрам new/design/pages/cart-checkout.png (007b): строки, допродажа,
 * оформление и «Ваш заказ» на одной странице. Отдельного /checkout больше нет —
 * старый адрес ведёт сюда 301 (middleware).
 *
 * Корзина читается на сервере по cookie `cart_id`, если она есть: без JS посетитель
 * видит свои строки и просьбу включить JavaScript для оформления. Страница
 * персональная — без кэша и вне индекса.
 */

import { cookies } from "next/headers";
import { CartView } from "@/components/cart/cart-view";
import { Breadcrumbs } from "@/components/ui";
import {
  apiGet,
  apiGetPrivate,
  type Cart,
  type ContactsPage,
  type ProductListItem,
} from "@/lib/api";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Корзина",
  description: "Состав заказа, дата, способ получения и контакты.",
  path: "/cart",
  noindex: true,
});
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const cartId = (await cookies()).get("cart_id")?.value;
  const [cart, contacts] = await Promise.all([
    cartId
      ? apiGetPrivate<Cart>("/cart", `cart_id=${encodeURIComponent(cartId)}`).catch(() => null)
      : Promise.resolve(null),
    apiGet<ContactsPage>("/pages/contacts").catch(() => null),
  ]);
  const content = contacts?.content;
  // Допродажа тоже с сервера: подгруженная в браузере, она появлялась над формой
  // и сдвигала «01 Получение» (CLS 0,1 в Lighthouse)
  const upsell =
    cartId && cart?.items.some((item) => item.is_cake)
      ? await apiGetPrivate<ProductListItem[]>(
          "/cart/upsell",
          `cart_id=${encodeURIComponent(cartId)}`,
        ).catch(() => null)
      : null;

  return (
    <div className="container-page pt-8 pb-20 xl:pt-[41px] xl:pb-[137px]">
      <Breadcrumbs items={[{ href: "/", label: "Главная" }, { label: "Корзина" }]} />
      <h1 className="mt-6 font-display text-section leading-[1.1] text-ink xl:mt-[22px]">
        Корзина
      </h1>
      <CartView
        initialCart={cart}
        initialUpsell={upsell}
        pickup={{
          place: content?.pickup_place ?? null,
          hours: contacts?.work_hours_weekdays ?? null,
          routeUrl: content?.route_url ?? null,
        }}
      />
    </div>
  );
}
