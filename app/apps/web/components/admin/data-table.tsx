"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import { ApiError } from "@/lib/api";

/** Загрузка данных раздела админки с единой обработкой состояний. */
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

export function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg bg-surface shadow-raised">
      <table className="w-full min-w-[42rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            {headers.map((header) => (
              <th
                key={header}
                className="px-4 py-3 text-2xs font-medium tracking-wide text-ink-subtle uppercase"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return (
    <tr className="border-b border-line align-middle transition-colors duration-150 last:border-b-0 hover:bg-surface-sunken/60">
      {children}
    </tr>
  );
}

export function Cell({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3">{children}</td>;
}

export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function StateBlock({ loading, error }: { loading: boolean; error: string | null }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-md bg-surface-sunken" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p role="alert" className="rounded-md bg-accent-soft px-4 py-3 text-sm text-danger">
        {error}
      </p>
    );
  }

  return null;
}
