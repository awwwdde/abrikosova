"use client";

/**
 * Резервные копии (011f, только владелица). Восстановление — двойное
 * подтверждение: окно с последствиями и ввод слова «ВОССТАНОВИТЬ» (его же
 * проверяет бэкенд). Перед восстановлением бэкенд сам снимает копию текущего
 * состояния — ошибку восстановления можно откатить.
 */

import { ArrowCounterClockwise, CloudArrowDown, Trash } from "@phosphor-icons/react";
import { useState } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ColumnLabel,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Notice,
  Skeleton,
  useToast,
} from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/use-admin-data";
import { useBakeryDateTime } from "@/components/admin/use-bakery-clock";
import { ApiError, type Backup } from "@/lib/api";

const RESTORE_CONFIRMATION = "ВОССТАНОВИТЬ";

// Время кондитерской: пояс приходит из /admin/clock (011g), а не из браузера —
// копию «в 3:00» владелица ищет по местному времени, даже если открыла админку в поездке
const DATE_TIME: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

const STATUS = {
  pending: { label: "Выполняется", tone: "blue" },
  success: { label: "Готова", tone: "green" },
  failed: { label: "Ошибка", tone: "accent" },
} as const;

function formatSize(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} МБ`;
}

function author(backup: Backup): string {
  if (backup.type === "auto") return "По расписанию";
  return backup.created_by ?? "Вручную";
}

export default function AdminBackupsPage() {
  const { authFetch } = useAdminAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useAdminData<Backup[]>("/admin/backups");
  const dateTime = useBakeryDateTime(DATE_TIME);
  // Пока пояс не пришёл, дата не показывается в поясе браузера — иначе мелькнёт
  // другое время
  const when = (iso: string) => (dateTime ? dateTime.format(new Date(iso)) : "…");
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<Backup | null>(null);
  const [restoreStep, setRestoreStep] = useState<1 | 2>(1);
  const [word, setWord] = useState("");
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [removing, setRemoving] = useState<Backup | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  async function create() {
    // Кнопка заблокирована на время запроса — второй клик не запустит вторую копию
    if (creating) return;
    setCreating(true);
    try {
      await authFetch("/admin/backups", { method: "POST" });
      toast.success("Копия создана");
      await reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось создать копию");
    } finally {
      setCreating(false);
    }
  }

  function openRestore(backup: Backup) {
    setRestoring(backup);
    setRestoreStep(1);
    setWord("");
    setRestoreError(null);
  }

  async function restore() {
    if (!restoring) return;
    if (restoreStep === 1) {
      setRestoreStep(2);
      return;
    }
    if (word.trim() !== RESTORE_CONFIRMATION) {
      setRestoreError(`Введите слово ${RESTORE_CONFIRMATION} заглавными буквами`);
      return;
    }
    setRestoreBusy(true);
    try {
      await authFetch(`/admin/backups/${restoring.id}/restore`, {
        method: "POST",
        body: JSON.stringify({ confirm: RESTORE_CONFIRMATION }),
      });
      setRestoring(null);
      toast.success("База восстановлена. Копия состояния до восстановления — в списке");
      await reload();
    } catch (err) {
      setRestoreError(err instanceof ApiError ? err.message : "Не удалось восстановить");
    } finally {
      setRestoreBusy(false);
    }
  }

  async function remove() {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      await authFetch(`/admin/backups/${removing.id}`, { method: "DELETE" });
      setRemoving(null);
      toast.success("Копия удалена");
      await reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось удалить копию");
    } finally {
      setRemoveBusy(false);
    }
  }

  const restoringDate = restoring ? when(restoring.created_at) : "";

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[34px] leading-[1.05] font-normal adm-sm:text-[42px]">
            Резервные копии
          </h1>
          <p className="text-[15px] text-admin-muted">
            Копия снимается каждую ночь и хранится в объектном хранилище
          </p>
        </div>
        <Button
          icon={<CloudArrowDown aria-hidden="true" size={18} />}
          loading={creating}
          onClick={() => void create()}
        >
          {creating ? "Создаём копию…" : "Создать копию сейчас"}
        </Button>
      </div>

      {creating ? (
        <Notice role="status">
          Снимаем копию базы — обычно это меньше минуты. Не закрывайте страницу.
        </Notice>
      ) : null}

      {error ? (
        <Notice
          role="alert"
          action={
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              Повторить
            </Button>
          }
        >
          {error}
        </Notice>
      ) : null}

      <Card aria-labelledby="backups-title" className="flex flex-col gap-4">
        <CardHeader id="backups-title" title="Копии" />
        {loading && !data ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : data && data.length === 0 ? (
          <EmptyState
            title="Копий пока нет"
            text="Первая появится ночью или после нажатия «Создать копию сейчас»"
          />
        ) : data ? (
          // На телефоне таблица прокручивается внутри карточки, а не вся страница (011g)
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[540px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-admin-line">
                  <th scope="col" className="py-2 pr-4 font-normal">
                    <ColumnLabel>Дата</ColumnLabel>
                  </th>
                  <th scope="col" className="py-2 pr-4 font-normal">
                    <ColumnLabel>Кто создал</ColumnLabel>
                  </th>
                  <th scope="col" className="py-2 pr-4 font-normal">
                    <ColumnLabel>Размер</ColumnLabel>
                  </th>
                  <th scope="col" className="py-2 pr-4 font-normal">
                    <ColumnLabel>Статус</ColumnLabel>
                  </th>
                  <th scope="col" className="py-2 font-normal">
                    <span className="sr-only">Действия</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((backup) => {
                  const status = STATUS[backup.status];
                  return (
                    <tr key={backup.id} className="border-b border-admin-line last:border-0">
                      <td className="py-3 pr-4">
                        <span className="tnum font-semibold">{when(backup.created_at)}</span>
                        {backup.note ? (
                          <span className="block text-[12.5px] text-admin-muted">
                            {backup.note}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 pr-4">{author(backup)}</td>
                      <td className="tnum py-3 pr-4">{formatSize(backup.size_bytes)}</td>
                      <td className="py-3 pr-4">
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </td>
                      <td className="py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            icon={<ArrowCounterClockwise aria-hidden="true" size={15} />}
                            disabled={backup.status !== "success"}
                            onClick={() => openRestore(backup)}
                            aria-label={`Восстановить копию от ${when(backup.created_at)}`}
                          >
                            Восстановить
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Trash aria-hidden="true" size={15} />}
                            onClick={() => setRemoving(backup)}
                            aria-label={`Удалить копию от ${when(backup.created_at)}`}
                          >
                            Удалить
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      <Card aria-labelledby="backups-about" className="flex max-w-[720px] flex-col gap-3">
        <CardHeader id="backups-about" title="Что важно знать" />
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-normal text-admin-muted">
          <li>Копия содержит все данные сайта: товары, заказы, заявки и контакты клиентов.</li>
          <li>
            Восстановление заменяет текущие данные целиком. Перед ним сайт сам снимает копию
            текущего состояния — она появится в списке с пометкой «Перед восстановлением».
          </li>
          <li>Хостинг дополнительно делает собственные снимки базы — они дополняют эти копии.</li>
        </ul>
      </Card>

      <ConfirmDialog
        open={restoring !== null}
        title={
          restoreStep === 1
            ? `Восстановить копию от ${restoringDate}?`
            : "Подтвердите восстановление"
        }
        text={
          restoreStep === 1
            ? "Все данные сайта заменятся данными из копии. Заказы, заявки, отзывы и изменения товаров после этой даты пропадут, все сотрудники выйдут из админки, сайт на несколько секунд перестанет отвечать. Перед восстановлением сайт снимет копию текущего состояния."
            : `Чтобы восстановить копию от ${restoringDate}, введите слово ${RESTORE_CONFIRMATION}.`
        }
        confirmLabel={restoreStep === 1 ? "Понятно, дальше" : "Восстановить"}
        loading={restoreBusy}
        onConfirm={() => void restore()}
        onClose={() => setRestoring(null)}
      >
        {restoreStep === 2 ? (
          <Field label="Слово для подтверждения" error={restoreError ?? undefined}>
            {(a11y) => (
              <Input
                {...a11y}
                autoFocus
                autoComplete="off"
                value={word}
                onChange={(event) => {
                  setWord(event.target.value);
                  setRestoreError(null);
                }}
              />
            )}
          </Field>
        ) : restoreError ? (
          <Notice role="alert">{restoreError}</Notice>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={removing !== null}
        title="Удалить копию?"
        text={
          removing
            ? `Копия от ${when(removing.created_at)} будет стёрта из хранилища, вернуть её нельзя.`
            : undefined
        }
        loading={removeBusy}
        onConfirm={() => void remove()}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}
