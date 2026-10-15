"use client";

/**
 * Корзина целиком (007b): строки, допродажа, форма и «Ваш заказ» — или пустое
 * состояние.
 *
 * Сервер передаёт корзину, прочитанную по cookie `cart_id` (`initialCart`): без JS
 * посетитель видит свои строки, а с JS первая отрисовка не мигает скелетоном. Дальше
 * источник — контекст корзины (он же обновляет счётчик в шапке).
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCart } from "@/components/cart-context";
import { CartLines } from "@/components/cart/cart-lines";
import { Checkout, type PickupInfo } from "@/components/cart/checkout";
import { Upsell } from "@/components/cart/upsell";
import { LinkButton } from "@/components/ui";
import type { Cart, ProductListItem } from "@/lib/api";

export function CartView({
  initialCart,
  initialUpsell,
  pickup,
}: {
  initialCart: Cart | null;
  /** Допродажа, прочитанная на сервере, — чтобы блок не сдвигал форму при загрузке */
  initialUpsell: ProductListItem[] | null;
  pickup: PickupInfo;
}) {
  const { cart: live, loading } = useCart();
  const cart = loading ? initialCart : live;
  const [message, setMessage] = useState("");

  const inCart = useMemo(
    () => new Set((cart?.items ?? []).map((item) => item.product_id)),
    [cart?.items],
  );

  const status = (
    <p role="status" aria-live="polite" className="sr-only">
      {message}
    </p>
  );

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mt-[54px] pb-[160px]">
        {status}
        <h2 className="font-display text-[34px] leading-10 text-ink">В корзине пока ничего нет</h2>
        <p className="mt-[14px] text-[17px] leading-6 text-ink-muted">
          Загляните в каталог: витрина обновляется каждое утро
        </p>
        <LinkButton href="/catalog" className="mt-[30px]">
          Перейти в каталог
        </LinkButton>
      </div>
    );
  }

  return (
    <>
      {status}
      <Checkout cart={cart} pickup={pickup}>
        <CartLines items={cart.items} onMessage={setMessage} />
        <Upsell
          initialItems={initialUpsell}
          inCart={inCart}
          hasCake={cart.items.some((item) => item.is_cake)}
          onMessage={setMessage}
        />
        <Link
          href="/catalog"
          className="mt-[21px] inline-block text-[14px] font-medium text-ink underline underline-offset-[3px] transition-colors hover:text-accent"
        >
          Продолжить покупки
        </Link>
      </Checkout>
    </>
  );
}
