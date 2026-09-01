"use client";

import { useState } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import {
  AdminPageHeader,
  Cell,
  Row,
  StateBlock,
  Table,
  useAdminData,
} from "@/components/admin/data-table";
import { Button, Field, Input, Select } from "@/components/ui";
import { ApiError } from "@/lib/api";

type UserRow = {
  id: number;
  email: string;
  role: "owner" | "manager";
  is_active: boolean;
  created_at: string;
};

export default function AdminUsersPage() {
  const { authFetch, user } = useAdminAuth();
  const { data, loading, error, reload } = useAdminData<UserRow[]>("/admin/users");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"owner" | "manager">("manager");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await authFetch("/admin/users", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password, role }),
      });
      setEmail("");
      setPassword("");
      await reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Не удалось создать пользователя");
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(row: UserRow) {
    if (!window.confirm(`Отключить доступ для ${row.email}?`)) return;
    try {
      await authFetch(`/admin/users/${row.id}`, { method: "DELETE" });
      await reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Не удалось отключить");
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Пользователи" />

      <form
        onSubmit={create}
        className="max-w-md space-y-4 rounded-lg bg-surface p-6 shadow-raised"
      >
        <p className="eyebrow">Добавить сотрудника</p>

        <Field label="E-mail" required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>

        <Field label="Пароль" required hint="Не менее 12 символов">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={12}
            required
            autoComplete="new-password"
          />
        </Field>

        <Field label="Роль" required>
          <Select value={role} onChange={(e) => setRole(e.target.value as "owner" | "manager")}>
            <option value="manager">Менеджер — без пользователей и бэкапов</option>
            <option value="owner">Владелец — полный доступ</option>
          </Select>
        </Field>

        {formError ? (
          <p role="alert" className="text-xs text-danger">
            {formError}
          </p>
        ) : null}

        <Button type="submit" disabled={busy}>
          {busy ? "Создаём…" : "Создать"}
        </Button>
      </form>

      <StateBlock loading={loading} error={error} />

      {data ? (
        <Table headers={["E-mail", "Роль", "Активен", "Создан", "Действия"]}>
          {data.map((row) => (
            <Row key={row.id}>
              <Cell>
                {row.email}
                {row.id === user?.id ? (
                  <span className="ml-1 text-xs text-ink-subtle">(вы)</span>
                ) : null}
              </Cell>
              <Cell>{row.role === "owner" ? "Владелец" : "Менеджер"}</Cell>
              <Cell>{row.is_active ? "да" : "нет"}</Cell>
              <Cell>
                <span className="text-xs text-ink-subtle">
                  {new Date(row.created_at).toLocaleDateString("ru-RU")}
                </span>
              </Cell>
              <Cell>
                {row.id === user?.id || !row.is_active ? (
                  <span className="text-xs text-ink-subtle">—</span>
                ) : (
                  <Button variant="danger" onClick={() => void deactivate(row)}>
                    Отключить
                  </Button>
                )}
              </Cell>
            </Row>
          ))}
        </Table>
      ) : null}
    </div>
  );
}
