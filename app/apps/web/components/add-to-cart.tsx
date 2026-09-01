"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/cart-context";
import { Button } from "@/components/ui";

export function AddToCart({ productId, disabled }: { productId: number; disabled?: boolean }) {
  const { addItem } = useCart();
  const [state, setState] = useState<"idle" | "loading" | "added">("idle");
  const [error, setError] = useState<string | null>(null);

  if (disabled) {
    return (
      <p className="rounded-md bg-surface-sunken px-4 py-3 text-sm text-ink-muted">
        Сейчас недоступно — уточните наличие по телефону.
      </p>
    );
  }

  async function handleAdd() {
    setState("loading");
    setError(null);
    try {
      await addItem(productId);
      setState("added");
    } catch {
      setState("idle");
      setError("Не удалось добавить товар, попробуйте ещё раз");
    }
  }

  return (
    <div>
      {state === "added" ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-ink-muted">Добавлено в корзину</span>
          <Link
            href="/cart"
            className="inline-flex min-h-10 items-center rounded-md bg-accent px-5 text-sm font-medium text-white shadow-raised transition-[background-color,scale] duration-150 hover:bg-accent-hover active:scale-[0.96]"
          >
            Перейти в корзину
          </Link>
        </div>
      ) : (
        <Button
          onClick={handleAdd}
          disabled={state === "loading"}
          className="w-full sm:w-auto sm:px-8"
        >
          {state === "loading" ? "Добавляем…" : "В корзину"}
        </Button>
      )}

      {error ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
