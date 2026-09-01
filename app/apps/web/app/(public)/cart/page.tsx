"use client";

import Link from "next/link";
import { useCart } from "@/components/cart-context";
import {
  Breadcrumbs,
  Card,
  EmptyState,
  ImagePlaceholder,
  LinkButton,
  Price,
} from "@/components/ui";

function QuantityControl({
  quantity,
  onChange,
  disabled,
}: {
  quantity: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex items-center rounded-md border border-line">
      <button
        type="button"
        aria-label="Уменьшить количество"
        disabled={disabled}
        onClick={() => onChange(quantity - 1)}
        className="inline-flex size-9 items-center justify-center rounded-l-md text-ink-muted transition-[background-color,scale] duration-150 hover:bg-surface-sunken hover:text-ink active:scale-[0.96] disabled:opacity-40"
      >
        −
      </button>
      <span className="tnum w-9 text-center text-sm">{quantity}</span>
      <button
        type="button"
        aria-label="Увеличить количество"
        disabled={disabled}
        onClick={() => onChange(quantity + 1)}
        className="inline-flex size-9 items-center justify-center rounded-r-md text-ink-muted transition-[background-color,scale] duration-150 hover:bg-surface-sunken hover:text-ink active:scale-[0.96] disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}

export default function CartPage() {
  const { cart, loading, setQuantity, removeItem } = useCart();

  return (
    <div className="container-page py-10 md:py-14">
      <Breadcrumbs items={[{ href: "/", label: "Главная" }, { label: "Корзина" }]} />
      <h1 className="mt-4 text-3xl">Корзина</h1>

      {loading ? (
        <div className="mt-10 space-y-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-lg bg-surface-sunken" />
          ))}
        </div>
      ) : !cart || cart.items.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Здесь пока пусто"
            description="Загляните в каталог — там готовые позиции с доставкой и самовывозом."
            action={<LinkButton href="/catalog">Перейти в каталог</LinkButton>}
          />
        </div>
      ) : (
        <div className="mt-10 grid gap-8 md:grid-cols-12 md:gap-10">
          <ul className="space-y-3 md:col-span-8">
            {cart.items.map((item) => (
              <li key={item.product_id}>
                {/* Внешний радиус 12px при отступе 12px даёт внутренним 8px */}
                <Card className="flex gap-4 p-3">
                  <Link href={`/product/${item.slug}`} className="w-24 shrink-0">
                    <ImagePlaceholder ratio="1/1" className="rounded-md" />
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/product/${item.slug}`}
                          className="block truncate text-sm transition-colors duration-150 hover:text-accent"
                        >
                          {item.name}
                        </Link>
                        <p className="mt-0.5 text-xs text-ink-subtle">
                          <Price value={item.price} /> за штуку
                        </p>
                        {!item.is_available ? (
                          <p className="mt-1 text-xs text-danger">Товар стал недоступен</p>
                        ) : null}
                      </div>
                      <Price value={item.line_total} className="shrink-0 text-sm font-medium" />
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                      <QuantityControl
                        quantity={item.quantity}
                        onChange={(next) => setQuantity(item.product_id, next)}
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(item.product_id)}
                        className="min-h-10 rounded-sm px-2 text-xs text-ink-subtle transition-colors duration-150 hover:text-danger"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          <aside className="md:col-span-4">
            <Card className="p-6 md:sticky md:top-24">
              <p className="eyebrow mb-4">Итого</p>
              <div className="flex justify-between text-sm text-ink-muted">
                <span>Товаров</span>
                <span className="tnum">{cart.total_items}</span>
              </div>
              <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
                <span className="text-sm">К оплате</span>
                <Price value={cart.total_price} className="text-xl font-medium" />
              </div>

              <LinkButton href="/checkout" className="mt-6 w-full">
                Оформить заказ
              </LinkButton>
              <Link
                href="/catalog"
                className="mt-3 block text-center text-xs text-ink-subtle transition-colors duration-150 hover:text-ink"
              >
                Продолжить покупки
              </Link>
              <p className="mt-5 text-xs leading-relaxed text-ink-subtle">
                Оплата при получении или по договорённости. Мы перезвоним для подтверждения.
              </p>
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}
