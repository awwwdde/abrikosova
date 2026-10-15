"use client";

/**
 * «Сотрудники» (только владелец). 011c: у сотрудника появилось имя — его задают
 * при создании и правят здесь же; раздел переведён на UI-кит админки, потому что
 * форма менялась целиком. Доступ проверяет бэкенд (403 менеджеру).
 */

import { EnvelopeSimple, PencilSimple, UserPlus } from "@phosphor-icons/react";
import { useState, type FormEvent } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import { useAdminData } from "@/components/admin/use-admin-data";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  Field,
  IconButton,
  Input,
  Notice,
  RadioCard,
  Skeleton,
  useToast,
} from "@/components/admin/ui";
import { ApiError, type AdminUser } from "@/lib/api";
import { typograf } from "@/lib/format";

type Role = "owner" | "manager";

function CreateForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const { authFetch } = useAdminAuth();
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("manager");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authFetch("/admin/users", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password, role }),
      });
      toast.success(`${name.trim()} может войти в админку`);
      setName("");
      setEmail("");
      setPassword("");
      await onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось добавить сотрудника");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card aria-labelledby="create-title" className="flex flex-col gap-5">
      <CardHeader id="create-title" title="Добавить сотрудника" />
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Имя и фамилия" hint="Так сотрудник будет подписан в журнале: «Ольга Т.»">
          {(a11y) => (
            <Input
              {...a11y}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              autoComplete="off"
              required
            />
          )}
        </Field>
        <Field label="E-mail">
          {(a11y) => (
            <Input
              {...a11y}
              type="email"
              icon={<EnvelopeSimple size={18} />}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="off"
              required
            />
          )}
        </Field>
        <Field
          label="Пароль"
          hint={typograf("Не короче 12 символов. Сотрудник сможет сменить его в своём профиле")}
        >
          {(a11y) => (
            <Input
              {...a11y}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              required
            />
          )}
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[13.5px] font-bold text-admin-ink">Роль</legend>
          <div className="grid gap-3 adm-sm:grid-cols-2">
            <RadioCard
              name="role"
              value="manager"
              checked={role === "manager"}
              onChange={(value) => setRole(value as Role)}
              title="Менеджер"
              description="Заказы, заявки, каталог, отзывы"
            />
            <RadioCard
              name="role"
              value="owner"
              checked={role === "owner"}
              onChange={(value) => setRole(value as Role)}
              title="Владелец"
              description="Всё, включая сотрудников, журнал и настройки"
            />
          </div>
        </fieldset>
        {error ? <Notice role="alert">{error}</Notice> : null}
        <div>
          <Button type="submit" loading={busy} icon={<UserPlus aria-hidden="true" size={18} />}>
            Добавить
          </Button>
        </div>
      </form>
    </Card>
  );
}

function StaffRow({
  row,
  isMe,
  onChanged,
  onDeactivate,
}: {
  row: AdminUser;
  isMe: boolean;
  onChanged: () => Promise<void>;
  onDeactivate: (row: AdminUser) => void;
}) {
  const { authFetch } = useAdminAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(row.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authFetch(`/admin/users/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim() }),
      });
      toast.success("Имя сохранено");
      setEditing(false);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить имя");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card as="li" padding="sm" className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <Avatar name={row.name} tone={row.role === "owner" ? "side" : "cream"} />
      {editing ? (
        <form onSubmit={save} className="flex min-w-0 grow flex-wrap items-start gap-2">
          <div className="min-w-56 grow">
            <Field label="Имя" error={error}>
              {(a11y) => (
                <Input
                  {...a11y}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={100}
                  autoFocus
                  required
                />
              )}
            </Field>
          </div>
          <div className="flex gap-2 pt-[29px]">
            <Button type="submit" loading={busy}>
              Сохранить
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setName(row.name);
                setError(null);
              }}
            >
              Отмена
            </Button>
          </div>
        </form>
      ) : (
        <>
          <span className="flex min-w-0 grow flex-col gap-0.5">
            <span className="flex items-center gap-2 text-[14.5px] font-bold">
              {row.name}
              {isMe ? <span className="font-medium text-admin-muted">(вы)</span> : null}
              <IconButton
                label={`Изменить имя: ${row.name}`}
                size="sm"
                onClick={() => setEditing(true)}
              >
                <PencilSimple size={16} />
              </IconButton>
            </span>
            <span className="truncate text-[13px] text-admin-muted">{row.email}</span>
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={row.role === "owner" ? "accent" : "grey"}>
              {row.role === "owner" ? "Владелец" : "Менеджер"}
            </Badge>
            {row.is_active ? null : <Badge tone="grey">Отключён</Badge>}
            {!isMe && row.is_active ? (
              <Button variant="ghost" size="sm" onClick={() => onDeactivate(row)}>
                Отключить
              </Button>
            ) : null}
          </span>
        </>
      )}
    </Card>
  );
}

export default function AdminUsersPage() {
  const { authFetch, user } = useAdminAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useAdminData<AdminUser[]>("/admin/users");
  const [confirm, setConfirm] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);

  async function deactivate() {
    if (!confirm) return;
    setBusy(true);
    try {
      await authFetch(`/admin/users/${confirm.id}`, { method: "DELETE" });
      toast.success(`Доступ для ${confirm.name} отключён`);
      setConfirm(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось отключить доступ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-[34px] leading-[1.05] font-normal adm-sm:text-[42px]">
          Сотрудники
        </h1>
        <p className="text-[15px] text-admin-muted">
          {typograf("Кто входит в админку. Отключённый сотрудник выходит со всех устройств сразу")}
        </p>
      </div>
      <div className="grid grid-cols-1 items-start gap-5 adm-xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section aria-labelledby="staff-title" className="flex flex-col gap-3">
          <CardHeader id="staff-title" title="Команда" />
          {loading && !data ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : error ? (
            <Notice role="alert">{error}</Notice>
          ) : (
            <ul className="flex flex-col gap-3">
              {(data ?? []).map((row) => (
                <StaffRow
                  key={row.id}
                  row={row}
                  isMe={row.id === user?.id}
                  onChanged={reload}
                  onDeactivate={setConfirm}
                />
              ))}
            </ul>
          )}
        </section>
        <CreateForm onCreated={reload} />
      </div>
      <ConfirmDialog
        open={confirm !== null}
        title={`Отключить доступ для ${confirm?.name ?? ""}?`}
        text={typograf(
          "Сотрудник выйдет со всех устройств и не сможет войти. История действий в журнале останется.",
        )}
        confirmLabel="Отключить"
        loading={busy}
        onConfirm={() => void deactivate()}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
