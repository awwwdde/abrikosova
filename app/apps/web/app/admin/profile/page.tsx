"use client";

/**
 * «Мой профиль» (011b, меню аватара): смена своего пароля и список входов.
 * API — из 011a: `POST /auth/change-password`, `GET/DELETE /auth/sessions`,
 * `POST /auth/sessions/revoke-others`.
 */

import { DeviceMobile, Desktop, LockSimple } from "@phosphor-icons/react";
import { useState, type FormEvent } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import { useAdminData } from "@/components/admin/use-admin-data";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Notice,
  Skeleton,
  useToast,
} from "@/components/admin/ui";
import { ApiError, type AdminSessionInfo } from "@/lib/api";
import { typograf } from "@/lib/format";

const dateTime = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

function NameForm() {
  const { authFetch, user, reloadUser } = useAdminAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await authFetch("/auth/me", { method: "PATCH", body: JSON.stringify({ name: name.trim() }) });
      await reloadUser();
      toast.success("Имя сохранено");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить имя");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card aria-labelledby="name-title" className="flex flex-col gap-5">
      <CardHeader id="name-title" title="Имя" />
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label="Имя и фамилия"
          hint={typograf("На главной: «Добрый день, Елена», в журнале: «Елена А.»")}
          error={error}
        >
          {(a11y) => (
            <Input
              {...a11y}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              autoComplete="name"
              required
            />
          )}
        </Field>
        <div>
          <Button type="submit" loading={saving} disabled={name.trim() === user?.name}>
            Сохранить
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PasswordForm() {
  const { authFetch } = useAdminAuth();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<{ field: "current" | "next" | "repeat"; text: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (next !== repeat) {
      setError({ field: "repeat", text: "Пароли не совпадают" });
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await authFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      setCurrent("");
      setNext("");
      setRepeat("");
      toast.success("Пароль изменён. На других устройствах нужно войти заново");
    } catch (err) {
      const text = err instanceof ApiError ? err.message : "Не удалось сменить пароль";
      // Сервер отвечает 422 с ошибкой на поле: «Текущий пароль указан неверно»
      // или текстом политики паролей про новый пароль
      setError({ field: /текущий/i.test(text) ? "current" : "next", text });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card aria-labelledby="password-title" className="flex flex-col gap-5">
      <CardHeader id="password-title" title="Пароль" />
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Текущий пароль" error={error?.field === "current" ? error.text : null}>
          {(a11y) => (
            <Input
              {...a11y}
              type="password"
              autoComplete="current-password"
              icon={<LockSimple size={18} />}
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              required
            />
          )}
        </Field>
        <Field
          label="Новый пароль"
          hint={typograf("Не короче 12 символов. Удобно взять фразу из трёх-четырёх слов")}
          error={error?.field === "next" ? error.text : null}
        >
          {(a11y) => (
            <Input
              {...a11y}
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
              minLength={12}
              maxLength={128}
              required
            />
          )}
        </Field>
        <Field label="Новый пароль ещё раз" error={error?.field === "repeat" ? error.text : null}>
          {(a11y) => (
            <Input
              {...a11y}
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={(event) => setRepeat(event.target.value)}
              required
            />
          )}
        </Field>
        <div>
          <Button type="submit" loading={saving}>
            Сменить пароль
          </Button>
        </div>
      </form>
    </Card>
  );
}

function SessionsCard() {
  const { authFetch } = useAdminAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useAdminData<AdminSessionInfo[]>("/auth/sessions");
  const [confirm, setConfirm] = useState<AdminSessionInfo | "others" | null>(null);
  const [busy, setBusy] = useState(false);

  async function revoke() {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm === "others") {
        await authFetch("/auth/sessions/revoke-others", { method: "POST" });
        toast.success("Выполнен выход на остальных устройствах");
      } else {
        await authFetch(`/auth/sessions/${confirm.id}`, { method: "DELETE" });
        toast.success("Сеанс завершён");
      }
      setConfirm(null);
      await reload();
    } catch {
      toast.error("Не удалось завершить сеанс");
    } finally {
      setBusy(false);
    }
  }

  const others = (data ?? []).filter((item) => !item.current);

  return (
    <Card aria-labelledby="sessions-title" className="flex flex-col gap-4">
      <CardHeader
        id="sessions-title"
        title="Где выполнен вход"
        action={
          others.length > 0 ? (
            <Button variant="outline" size="sm" onClick={() => setConfirm("others")}>
              Выйти на остальных
            </Button>
          ) : null
        }
      />
      {loading && !data ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : error ? (
        <Notice role="alert">{error}</Notice>
      ) : data && data.length ? (
        <ul className="flex flex-col">
          {data.map((item) => {
            const mobile = /iOS|Android/i.test(item.device);
            const Icon = mobile ? DeviceMobile : Desktop;
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 border-t border-admin-line py-3 first:border-t-0"
              >
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-admin-small bg-admin-panel text-admin-muted"
                >
                  <Icon size={20} />
                </span>
                <span className="flex min-w-0 grow flex-col gap-0.5">
                  <span className="text-[14px] font-bold">{item.device}</span>
                  <span className="text-[13px] text-admin-muted">
                    {item.ip ?? "IP неизвестен"} · активность{" "}
                    {dateTime.format(new Date(item.last_used_at))}
                  </span>
                </span>
                {item.current ? (
                  <Badge tone="green">Это устройство</Badge>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setConfirm(item)}>
                    Завершить
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState compact title="Активных входов нет" />
      )}
      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "others" ? "Выйти на остальных устройствах?" : "Завершить сеанс?"}
        text={typograf(
          confirm === "others"
            ? "Везде, кроме этого браузера, нужно будет войти заново."
            : "На этом устройстве нужно будет войти заново.",
        )}
        confirmLabel={confirm === "others" ? "Выйти везде" : "Завершить"}
        loading={busy}
        onConfirm={() => void revoke()}
        onClose={() => setConfirm(null)}
      />
    </Card>
  );
}

export default function AdminProfilePage() {
  const { user } = useAdminAuth();
  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-[34px] leading-[1.05] font-normal adm-sm:text-[42px]">
          Мой профиль
        </h1>
        <p className="text-[15px] text-admin-muted">
          {user?.email} · {user?.role === "owner" ? "владелец" : "менеджер"}
        </p>
      </div>
      <div className="grid grid-cols-1 items-start gap-5 adm-xl:grid-cols-2">
        <div className="flex flex-col gap-5">
          <NameForm />
          <PasswordForm />
        </div>
        <SessionsCard />
      </div>
    </div>
  );
}
