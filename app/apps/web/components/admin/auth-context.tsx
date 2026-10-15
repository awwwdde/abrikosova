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
import { readJson } from "@/lib/read-json";

export type { AdminUser };

type AuthContextValue = {
  user: AdminUser | null;
  status: "loading" | "authenticated" | "anonymous";
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  authFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
  /**
   * Загрузка файла с прогрессом (011d): fetch не сообщает, сколько отправлено,
   * поэтому XMLHttpRequest. Токен тот же; истёк — обновляем и повторяем раз.
   */
  upload: <T>(path: string, form: FormData, onProgress?: (share: number) => void) => Promise<T>;
  /** Файл из API как Blob (фото-референс заявки): с токеном, не публичной ссылкой. */
  fetchBlob: (path: string) => Promise<Blob>;
  /** Перечитать `/auth/me` — после смены своего имени в профиле. */
  reloadUser: () => Promise<void>;
  /** Скачать файл из API (CSV-отчёт): с токеном, поэтому не обычной ссылкой. */
  download: (path: string, fallbackName: string) => Promise<void>;
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
      // Вкладку закрыли посреди обновления (007a): keepalive доводит запрос до конца,
      // и браузер сохраняет новый refresh-cookie — иначе следующий вход пришёл бы
      // со старым токеном, и сервер закрыл бы сессию
      keepalive: true,
    });
    // Пустое или оборванное тело (006b) — как неудачный refresh: дальше вход, а не
    // исключение, после которого экран оставался на «Проверяем сессию…»
    const data = response.ok ? await readJson<{ access_token?: string }>(response) : undefined;
    tokenRef.current = data?.access_token ?? null;
    return tokenRef.current !== null;
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
        let fieldErrors: Record<string, string> | undefined;
        let issues: { loc: (string | number)[]; msg: string }[] = [];
        const body = await readJson<{ detail?: unknown }>(response);
        if (body) {
          if (typeof body.detail === "string") detail = body.detail;
          else if (Array.isArray(body.detail)) {
            detail = (body.detail[0] as { msg?: string })?.msg ?? detail;
            // 422 FastAPI: ошибка у поля — по последнему элементу loc (011d),
            // чтобы форма показала её под нужным полем, а не одной плашкой
            fieldErrors = {};
            issues = (body.detail as { loc?: (string | number)[]; msg?: string }[]).map((item) => ({
              loc: item.loc ?? [],
              msg: item.msg ?? "",
            }));
            for (const item of body.detail as { loc?: unknown[]; msg?: string }[]) {
              const field = item.loc?.[item.loc.length - 1];
              if (typeof field === "string" && item.msg && !fieldErrors[field]) {
                fieldErrors[field] = item.msg.replace(/^Value error, /, "");
              }
            }
          }
        }
        // Тело пустое или не JSON — остаётся общий текст
        throw new ApiError(
          response.status,
          detail,
          fieldErrors,
          // Полные пути ошибок (011f): редактору страниц нужен весь loc, а не только
          // последнее имя — «answer» есть у каждого вопроса
          fieldErrors ? { issues } : undefined,
        );
      }

      if (response.status === 204) return undefined as T;
      const data = await readJson<T>(response);
      // 200 без тела — ответ оборвался: ошибка запроса, а не SyntaxError из json()
      if (data === undefined) throw new ApiError(response.status, "Сервер прислал пустой ответ");
      return data;
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
      // При открытии вкладки access-токена в памяти ещё нет — поднимаем сессию по refresh-cookie.
      // Сеть недоступна (fetch бросил) — тоже вход: «Проверяем сессию…» не должно висеть
      const alive = await refreshAccess().catch(() => false);
      if (alive) await loadUser();
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
        let retryAfter: number | null = null;
        const body = await readJson<{ detail?: unknown; retry_after?: unknown }>(response);
        if (body) {
          if (typeof body.detail === "string") detail = body.detail;
          else if (Array.isArray(body.detail))
            detail = (body.detail[0] as { msg?: string })?.msg ?? detail;
          if (typeof body.retry_after === "number") retryAfter = body.retry_after;
        }
        // Блокировка входа (429): сколько секунд ждать — для отсчёта на странице.
        // Блокировка по аккаунту присылает число в теле; лимит по IP — только заголовок
        if (response.status === 429 && retryAfter === null) {
          retryAfter = Number(response.headers.get("Retry-After")) || 60;
        }
        throw new ApiError(response.status, detail, undefined, { retry_after: retryAfter });
      }

      const data = await readJson<{ access_token?: string }>(response);
      if (!data?.access_token)
        throw new ApiError(response.status, "Не удалось войти, попробуйте ещё раз");
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

  const download = useCallback(
    async (path: string, fallbackName: string, retry = true): Promise<void> => {
      const response = await fetch(`${API_URL}${path}`, {
        credentials: "include",
        headers: tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {},
      });
      if (response.status === 401 && retry && (await refreshAccess())) {
        return download(path, fallbackName, false);
      }
      if (!response.ok) throw new ApiError(response.status, "Не удалось скачать файл");
      // Имя файла — из Content-Disposition (filename*=UTF-8''…), иначе запасное
      const header = response.headers.get("Content-Disposition") ?? "";
      const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header)?.[1];
      const name = encoded ? decodeURIComponent(encoded) : fallbackName;
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
    },
    [refreshAccess],
  );

  const upload = useCallback(
    async <T,>(
      path: string,
      form: FormData,
      onProgress?: (share: number) => void,
      retry = true,
    ): Promise<T> => {
      const send = () =>
        new Promise<{ status: number; body: string }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", `${API_URL}${path}`);
          xhr.withCredentials = true;
          if (tokenRef.current) xhr.setRequestHeader("Authorization", `Bearer ${tokenRef.current}`);
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) onProgress?.(event.loaded / event.total);
          };
          xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
          xhr.onerror = () => reject(new ApiError(0, "Нет связи с сервером"));
          xhr.send(form);
        });
      const result = await send();
      if (result.status === 401 && retry && (await refreshAccess())) {
        return upload<T>(path, form, onProgress, false);
      }
      if (result.status < 200 || result.status >= 300) {
        let detail = "Не удалось загрузить файл";
        try {
          const body = JSON.parse(result.body) as { detail?: unknown };
          if (typeof body.detail === "string") detail = body.detail;
        } catch {
          // не JSON — общий текст
        }
        throw new ApiError(result.status, detail);
      }
      try {
        return JSON.parse(result.body) as T;
      } catch {
        throw new ApiError(result.status, "Сервер прислал пустой ответ");
      }
    },
    [refreshAccess],
  );

  const fetchBlob = useCallback(
    async (path: string, retry = true): Promise<Blob> => {
      const response = await fetch(`${API_URL}${path}`, {
        credentials: "include",
        headers: tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {},
      });
      if (response.status === 401 && retry && (await refreshAccess())) {
        return fetchBlob(path, false);
      }
      if (!response.ok) throw new ApiError(response.status, "Не удалось загрузить файл");
      return response.blob();
    },
    [refreshAccess],
  );

  const value = useMemo(
    () => ({
      user,
      status,
      login,
      logout,
      authFetch: request,
      download,
      upload,
      fetchBlob,
      reloadUser: loadUser,
    }),
    [user, status, login, logout, request, download, upload, fetchBlob, loadUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAdminAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAdminAuth вызван вне AdminAuthProvider");
  return context;
}
