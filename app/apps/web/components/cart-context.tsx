"use client";

/**
 * Состояние корзины на клиенте.
 *
 * Локальной копии содержимого корзины нет: клиент только отражает то, что
 * вернул сервер. Это прямое исправление главного бага старого сайта, где
 * корзина жила и в сессии, и в localStorage и расходилась между ними.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { apiFetch, type Cart } from "@/lib/api";

type CartContextValue = {
  cart: Cart | null;
  loading: boolean;
  refresh: () => Promise<void>;
  addItem: (productId: number, quantity?: number) => Promise<void>;
  setQuantity: (productId: number, quantity: number) => Promise<void>;
  removeItem: (productId: number) => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setCart(await apiFetch<Cart>("/cart"));
    } catch {
      setCart(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addItem = useCallback(async (productId: number, quantity = 1) => {
    setCart(
      await apiFetch<Cart>("/cart/items", {
        method: "POST",
        body: JSON.stringify({ product_id: productId, quantity }),
      }),
    );
  }, []);

  const setQuantity = useCallback(async (productId: number, quantity: number) => {
    setCart(
      await apiFetch<Cart>(`/cart/items/${productId}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity }),
      }),
    );
  }, []);

  const removeItem = useCallback(async (productId: number) => {
    setCart(await apiFetch<Cart>(`/cart/items/${productId}`, { method: "DELETE" }));
  }, []);

  const value = useMemo(
    () => ({ cart, loading, refresh, addItem, setQuantity, removeItem }),
    [cart, loading, refresh, addItem, setQuantity, removeItem],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart вызван вне CartProvider");
  return context;
}
