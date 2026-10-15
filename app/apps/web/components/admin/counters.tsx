"use client";

/**
 * Счётчики меню и колокольчика: новые заказы, заявки, отзывы на модерации.
 *
 * Один лёгкий запрос `GET /admin/counters` раз в 60 с — и только пока вкладка
 * видима: фоновая вкладка не опрашивает сервер весь день. При возврате на
 * вкладку счётчики обновляются сразу, не дожидаясь следующей минуты.
 * Главная после своих действий (опубликовала отзыв) зовёт `refresh()`.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import type { AdminCounters as Counters } from "@/lib/api";

export type { Counters };

const POLL_MS = 60_000;

type CountersValue = { counters: Counters | null; refresh: () => Promise<void> };

const CountersContext = createContext<CountersValue>({
  counters: null,
  refresh: async () => {},
});

export function CountersProvider({ children }: { children: ReactNode }) {
  const { authFetch } = useAdminAuth();
  const [counters, setCounters] = useState<Counters | null>(null);

  const refresh = useCallback(async () => {
    try {
      setCounters(await authFetch<Counters>("/admin/counters"));
    } catch {
      // Счётчики — подсказка, а не данные раздела: при ошибке оставляем прежние
    }
  }, [authFetch]);

  useEffect(() => {
    let timer: number | undefined;
    const start = () => {
      window.clearInterval(timer);
      void refresh();
      timer = window.setInterval(() => void refresh(), POLL_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") start();
      else window.clearInterval(timer);
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const value = useMemo(() => ({ counters, refresh }), [counters, refresh]);
  return <CountersContext.Provider value={value}>{children}</CountersContext.Provider>;
}

export function useCounters(): CountersValue {
  return useContext(CountersContext);
}
