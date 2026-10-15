"use client";

/**
 * Загрузка данных раздела админки с единой обработкой состояний. Был в
 * `data-table.tsx` вместе со старыми таблицами; вынесен, когда таблицы ушли (011f).
 */

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import { ApiError } from "@/lib/api";

export function useAdminData<T>(path: string | null) {
  const { authFetch } = useAdminAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError(null);
    try {
      setData(await authFetch<T>(path));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [authFetch, path]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}
