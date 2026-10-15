"use client";

/**
 * Состояние корзины на клиенте.
 *
 * Локальной копии содержимого корзины нет: клиент только отражает то, что
 * вернул сервер. Это прямое исправление главного бага старого сайта, где
 * корзина жила и в сессии, и в localStorage и расходилась между ними.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { apiFetch, type Cart } from "@/lib/api";
import { reachGoal } from "@/lib/metrika";

type CartContextValue = {
  cart: Cart | null;
  loading: boolean;
  refresh: () => Promise<void>;
  /** Вариант товара (у пирожного он единственный) и надпись на табличке. */
  addItem: (variantId: number, quantity?: number, inscriptionText?: string) => Promise<void>;
  /**
   * `itemId` — id строки корзины: тот же вариант с другой надписью — другая строка.
   * Количество и удаление — оптимистично (007b): строка меняется сразу, при ошибке
   * API — откат и исключение, сообщение показывает вызывающий.
   */
  setQuantity: (itemId: number, quantity: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  /** Новая надпись строки; совпала с другой строкой — сервер их сольёт (007a). */
  setInscription: (itemId: number, text: string | null) => Promise<void>;
};

/** Корзина после правки строки — до ответа сервера: количество, суммы, счётчик. */
function withLine(cart: Cart, itemId: number, quantity: number): Cart {
  const items = cart.items
    .map((item) => {
      if (item.id !== itemId) return item;
      const unit = Number(item.price) + Number(item.inscription_price ?? 0);
      return { ...item, quantity, line_total: String(unit * quantity) };
    })
    .filter((item) => item.quantity > 0);
  const subtotal = items.reduce((sum, item) => sum + Number(item.line_total), 0);
  return {
    ...cart,
    items,
    total_items: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: String(subtotal),
    total_price: String(subtotal),
  };
}

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

  const addItem = useCallback(async (variantId: number, quantity = 1, inscriptionText?: string) => {
    setCart(
      await apiFetch<Cart>("/cart/items", {
        method: "POST",
        body: JSON.stringify({
          variant_id: variantId,
          quantity,
          inscription_text: inscriptionText || null,
        }),
      }),
    );
    // Вариант и наличие надписи — без текста надписи: это свободный ввод покупателя
    reachGoal("add_to_cart", {
      variant_id: variantId,
      quantity,
      inscription: Boolean(inscriptionText),
    });
  }, []);

  // Оптимистичная правка: сразу показываем, при ошибке возвращаем, что было.
  // Снимок — из ref с последней отрисованной корзиной: updater setState выполняется
  // при рендере, а не сразу, и в нём снимок к моменту отката мог ещё не появиться
  const cartRef = useRef<Cart | null>(cart);
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  const optimistic = useCallback(
    async (change: (current: Cart) => Cart, request: () => Promise<Cart>) => {
      const before = cartRef.current;
      setCart((current) => (current ? change(current) : current));
      try {
        setCart(await request());
      } catch (error) {
        setCart(before);
        throw error;
      }
    },
    [],
  );

  const setQuantity = useCallback(
    (itemId: number, quantity: number) =>
      optimistic(
        (current) => withLine(current, itemId, quantity),
        () =>
          apiFetch<Cart>(`/cart/items/${itemId}`, {
            method: "PATCH",
            body: JSON.stringify({ quantity }),
          }),
      ),
    [optimistic],
  );

  const removeItem = useCallback(
    (itemId: number) =>
      optimistic(
        (current) => withLine(current, itemId, 0),
        () => apiFetch<Cart>(`/cart/items/${itemId}`, { method: "DELETE" }),
      ),
    [optimistic],
  );

  const setInscription = useCallback(async (itemId: number, text: string | null) => {
    setCart(
      await apiFetch<Cart>(`/cart/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ inscription_text: text }),
      }),
    );
  }, []);

  const value = useMemo(
    () => ({ cart, loading, refresh, addItem, setQuantity, removeItem, setInscription }),
    [cart, loading, refresh, addItem, setQuantity, removeItem, setInscription],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/**
 * Неподвижная корзина для превью карточки товара в админке (011d): настоящий
 * `ProductCard` сайта без запросов к API корзины и без cookie `cart_id`.
 */
export function CartPreviewProvider({ children }: { children: ReactNode }) {
  const value = useMemo<CartContextValue>(
    () => ({
      cart: null,
      loading: false,
      refresh: async () => {},
      addItem: async () => {},
      setQuantity: async () => {},
      removeItem: async () => {},
      setInscription: async () => {},
    }),
    [],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart вызван вне CartProvider");
  return context;
}
