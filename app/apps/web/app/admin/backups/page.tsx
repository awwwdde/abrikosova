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
import { Button, Card } from "@/components/ui";
import { ApiError, type Backup } from "@/lib/api";

// То же слово, что проверяет бэкенд. Осмысленное подтверждение вместо «ок»:
// восстановление затирает текущие данные, и случайно его запускать нельзя.
const RESTORE_CONFIRMATION = "ВОССТАНОВИТЬ";

const TYPE_LABELS = { auto: "По расписанию", manual: "Вручную" };
const STATUS_LABELS = { pending: "Выполняется", success: "Готова", failed: "Ошибка" };

function formatSize(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export default function AdminBackupsPage() {
  const { authFetch } = useAdminAuth();
  const { data, loading, error, reload } = useAdminData<Backup[]>("/admin/backups");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function createBackup() {
    setBusy(true);
    setMessage(null);
    setActionError(null);
    try {
      await authFetch("/admin/backups", { method: "POST" });
      setMessage("Резервная копия создана");
      await reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Не удалось создать копию");
    } finally {
      setBusy(false);
    }
  }

  async function restore(backup: Backup) {
    const answer = window.prompt(
      `Восстановление заменит ВСЕ текущие данные копией от ${new Date(
        backup.created_at,
      ).toLocaleString("ru-RU")}.\n\n` +
        `Всё, что появилось после этой даты — заказы, заявки, товары — будет потеряно.\n\n` +
        `Чтобы подтвердить, введите: ${RESTORE_CONFIRMATION}`,
    );

    if (answer !== RESTORE_CONFIRMATION) {
      setMessage("Восстановление отменено");
      return;
    }

    setBusy(true);
    setMessage(null);
    setActionError(null);
    try {
      await authFetch(`/admin/backups/${backup.id}/restore`, {
        method: "POST",
        body: JSON.stringify({ confirm: RESTORE_CONFIRMATION }),
      });
      setMessage("База восстановлена. Обновите страницу, чтобы увидеть данные из копии.");
      await reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Не удалось восстановить");
    } finally {
      setBusy(false);
    }
  }

  async function remove(backup: Backup) {
    if (!window.confirm("Удалить эту резервную копию? Файл будет стёрт из хранилища.")) return;

    setBusy(true);
    try {
      await authFetch(`/admin/backups/${backup.id}`, { method: "DELETE" });
      await reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Не удалось удалить");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Резервные копии"
        description="Копии снимаются автоматически каждую ночь и хранятся в объектном хранилище"
        action={
          <Button onClick={() => void createBackup()} disabled={busy}>
            {busy ? "Работаем…" : "Создать копию сейчас"}
          </Button>
        }
      />

      {message ? (
        <p className="rounded-md bg-surface-sunken px-4 py-3 text-sm text-ink-muted">{message}</p>
      ) : null}
      {actionError ? (
        <p role="alert" className="rounded-md bg-accent-soft px-4 py-3 text-sm text-danger">
          {actionError}
        </p>
      ) : null}

      <StateBlock loading={loading} error={error} />

      {data && data.length === 0 ? (
        <p className="text-sm text-ink-subtle">
          Копий пока нет. Первая появится ночью или после нажатия «Создать копию сейчас».
        </p>
      ) : null}

      {data && data.length > 0 ? (
        <Table headers={["Дата", "Тип", "Размер", "Статус", ""]}>
          {data.map((backup) => (
            <Row key={backup.id}>
              <Cell>
                <span className="tnum">{new Date(backup.created_at).toLocaleString("ru-RU")}</span>
              </Cell>
              <Cell>{TYPE_LABELS[backup.type]}</Cell>
              <Cell>
                <span className="tnum">{formatSize(backup.size_bytes)}</span>
              </Cell>
              <Cell>
                <span className={backup.status === "failed" ? "text-danger" : undefined}>
                  {STATUS_LABELS[backup.status]}
                </span>
              </Cell>
              <Cell>
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    disabled={busy || backup.status !== "success"}
                    onClick={() => void restore(backup)}
                  >
                    Восстановить
                  </Button>
                  <Button variant="secondary" disabled={busy} onClick={() => void remove(backup)}>
                    Удалить
                  </Button>
                </div>
              </Cell>
            </Row>
          ))}
        </Table>
      ) : null}

      <Card className="max-w-2xl p-5 text-sm text-ink-muted">
        <p className="font-medium text-ink">Что важно знать</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Копия содержит все данные сайта: товары, заказы, заявки и контакты клиентов.</li>
          <li>
            Восстановление заменяет текущие данные целиком и на несколько секунд разрывает работу
            сайта. Всё, что появилось после даты копии, будет потеряно.
          </li>
          <li>
            Хостинг дополнительно делает собственные снимки базы — они не заменяют эти копии, а
            дополняют их.
          </li>
        </ul>
      </Card>
    </div>
  );
}
