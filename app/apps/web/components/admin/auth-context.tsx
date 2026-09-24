"use client";

/**
 * Авторизация админки на клиенте.
 *
 * Access-токен живёт только в памяти вкладки: в localStorage его класть нельзя —
 * оттуда его забирает любой XSS. Долгоживущий refresh-токен лежит в httpOnly
 * cookie, которую JavaScript не видит вовсе, и обновляет access молча.
 *
 * Доступ всё равно проверяет бэкенд на каждом запросе — это лишь UX-слой,
 * который не пускает в интерфейс без сессии.
 */

import { useRouter } from "next/navigation";
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
import { API_URL, ApiError, type AdminUser } from "@/lib/api";

export type { AdminUser };

type AuthContextValue = {
  user: AdminUser | null;
  status: "loading" | "authenticated" | "anonymous";
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  authFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const tokenRef = useRef<string | null>(null);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "anonymous">("loading");

  const refreshAccess = useCallback(async (): Promise<boolean> => {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) {
      tokenRef.current = null;
      return false;
    }
    const data = (await response.json()) as { access_token: string };
    tokenRef.current = data.access_token;
    return true;
  }, []);

  const request = useCallback(
    async <T,>(path: string, init: RequestInit = {}, retry = true): Promise<T> => {
      const response = await fetch(`${API_URL}${path}`, {
        ...init,
        credentials: "include",
        headers: {
          // Только для JSON: у FormData Content-Type ставит браузер, вместе
          // с boundary — задать его вручную значит сломать разбор тела
          ...(typeof init.body === "string" ? { "Content-Type": "application/json" } : {}),
          ...(tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {}),
          ...init.headers,
        },
      });

      // Access живёт 15 минут: истёк — молча обновляем и повторяем запрос один раз
      if (response.status === 401 && retry) {
        if (await refreshAccess()) return request<T>(path, init, false);
        setUser(null);
        setStatus("anonymous");
        throw new ApiError(401, "Сессия истекла, войдите заново");
      }

      if (!response.ok) {
        let detail = "Не удалось выполнить запрос";
        try {
          const body = (await response.json()) as { detail?: unknown };
          if (typeof body.detail === "string") detail = body.detail;
          else if (Array.isArray(body.detail))
            detail = (body.detail[0] as { msg?: string })?.msg ?? detail;
        } catch {
          // тело пустое — оставляем общий текст
        }
        throw new ApiError(response.status, detail);
      }

      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    },
    [refreshAccess],
  );

  const loadUser = useCallback(async () => {
    try {
      setUser(await request<AdminUser>("/auth/me"));
      setStatus("authenticated");
    } catch {
      setUser(null);
      setStatus("anonymous");
    }
  }, [request]);

  useEffect(() => {
    void (async () => {
      // При открытии вкладки access-токена в памяти ещё нет — поднимаем сессию по refresh-cookie
      if (await refreshAccess()) await loadUser();
      else setStatus("anonymous");
    })();
  }, [refreshAccess, loadUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        let detail = "Не удалось войти";
        try {
          const body = (await response.json()) as { detail?: unknown };
          if (typeof body.detail === "string") detail = body.detail;
          else if (Array.isArray(body.detail))
            detail = (body.detail[0] as { msg?: string })?.msg ?? detail;
        } catch {
          // оставляем общий текст
        }
        throw new ApiError(response.status, detail);
      }

      const data = (await response.json()) as { access_token: string };
      tokenRef.current = data.access_token;
      await loadUser();
    },
    [loadUser],
  );

  const logout = useCallback(async () => {
    await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" });
    tokenRef.current = null;
    setUser(null);
    setStatus("anonymous");
    router.push("/admin/login");
  }, [router]);

  const value = useMemo(
    () => ({ user, status, login, logout, authFetch: request }),
    [user, status, login, logout, request],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAdminAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAdminAuth вызван вне AdminAuthProvider");
  return context;
}
