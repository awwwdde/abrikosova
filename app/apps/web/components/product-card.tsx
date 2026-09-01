"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/cart-context";
import { Badge, Card, Picture, Price } from "@/components/ui";
import { TAG_LABELS, type ProductListItem } from "@/lib/api";

export function ProductCard({ product }: { product: ProductListItem }) {
  const { addItem } = useCart();
  const [state, setState] = useState<"idle" | "loading" | "added">("idle");

  async function handleAdd() {
    setState("loading");
    try {
      await addItem(product.id);
      setState("added");
    } catch {
      setState("idle");
    }
  }

  return (
    <Card interactive className="group flex h-full flex-col overflow-hidden">
      <Link href={`/product/${product.slug}`} className="relative block">
        <Picture storageKey={product.main_image} alt={product.name} ratio="4/5" />
        {product.tags.length > 0 ? (
          <div className="absolute left-3 top-3 flex flex-wrap gap-1">
            {product.tags.map((tag) => (
              <Badge key={tag} tone={tag === "hit" ? "accent" : "neutral"}>
                {TAG_LABELS[tag]}
              </Badge>
            ))}
          </div>
        ) : null}
      </Link>

      {/* Внутренний отступ 12px под внешним радиусом 12px — низ карточки
          остаётся оптически ровным */}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <Link
          href={`/product/${product.slug}`}
          className="text-sm leading-snug transition-colors duration-150 group-hover:text-accent"
        >
          {product.name}
        </Link>
        <p className="text-xs text-ink-subtle">{product.weight}</p>

        <div className="mt-3 flex items-center justify-between gap-2">
          <Price value={product.price} className="text-base font-medium" />

          {product.is_available ? (
            state === "added" ? (
              <Link
                href="/cart"
                className="inline-flex min-h-9 items-center rounded-sm px-2.5 text-xs font-medium text-accent transition-[background-color,scale] duration-150 hover:bg-accent-soft active:scale-[0.96]"
              >
                В корзине
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleAdd}
                disabled={state === "loading"}
                className="inline-flex min-h-9 items-center rounded-sm border border-line px-2.5 text-xs font-medium text-ink transition-[background-color,border-color,scale] duration-150 hover:border-line-strong hover:bg-surface-sunken active:scale-[0.96] disabled:opacity-50"
              >
                {state === "loading" ? "…" : "В корзину"}
              </button>
            )
          ) : (
            <span className="text-xs text-ink-subtle">Нет в наличии</span>
          )}
        </div>
      </div>
    </Card>
  );
}
