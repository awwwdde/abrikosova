"use client";

import { CaretLeft, EnvelopeSimple, Plus, Trash } from "@phosphor-icons/react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import { useBreadcrumbTrail } from "@/components/admin/breadcrumbs";
import {
  Button,
  ButtonLink,
  Card,
  CardHeader,
  ConfirmDialog,
  Field,
  Input,
  Notice,
  Select,
  Skeleton,
  useToast,
} from "@/components/admin/ui";
import { ApiError } from "@/lib/api";
import type { components } from "@/lib/api-schema";

const ENDPOINT = "/admin/consultation-mailboxes";

type Mailbox = components["schemas"]["RequestMailboxOut"];
type MailSettings = components["schemas"]["RequestMailSettings"];

export default function RequestMailPage() {
  const { authFetch, user } = useAdminAuth();
  useBreadcrumbTrail([{ label: "Почта для заявок" }]);
  const toast = useToast();
  const [settings, setSettings] = useState<MailSettings | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Mailbox | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const owner = user?.role === "owner";

  const load = useCallback(async () => {
    setError(null);
    try {
      setSettings(await authFetch<MailSettings>(ENDPOINT, { cache: "no-store" }));
    } catch {
      setError("Не удалось загрузить настройки почты");
    }
  }, [authFetch]);

  useEffect(() => {
    if (owner) void load();
  }, [load, owner]);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const payload = {
      ...Object.fromEntries(values),
      port: Number(values.get("port")),
    };
    setBusy(true);
    setError(null);
    try {
      const mailbox = await authFetch<Mailbox>(ENDPOINT, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      form.reset();
      setSettings((current) => ({
        mailboxes: [...(current?.mailboxes ?? []), mailbox],
        server_mail_enabled: false,
      }));
      setAdding(false);
      toast.success("Почта подключена");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось подключить почту");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!removing) return;
    setBusy(true);
    setError(null);
    try {
      await authFetch(`${ENDPOINT}/${removing.id}`, { method: "DELETE" });
      setSettings(
        (current) =>
          current && {
            ...current,
            mailboxes: current.mailboxes.filter(({ id }) => id !== removing.id),
          },
      );
      toast.success("Почта удалена");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) await load();
      else setError(err instanceof ApiError ? err.message : "Не удалось удалить почту");
    } finally {
      setRemoving(null);
      setBusy(false);
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-center gap-4">
        <ButtonLink
          href="/admin/consultations"
          variant="outline"
          icon={<CaretLeft aria-hidden="true" size={17} />}
        >
          Заявки
        </ButtonLink>
        <h1 className="font-display text-[34px] leading-tight adm-sm:text-[42px]">
          Почта для заявок
        </h1>
      </div>
      {user && !owner ? <Notice>Настройки почты доступны владельцу.</Notice> : null}
      {error && !adding ? (
        <Notice
          role="alert"
          action={!settings ? <Button onClick={() => void load()}>Повторить</Button> : undefined}
        >
          {error}
        </Notice>
      ) : null}
      {owner && !settings && !error ? <Skeleton className="h-36" /> : null}
      {owner && settings ? (
        <Card className="flex flex-col gap-4">
          <CardHeader title="Куда приходят заявки" />
          <p className="text-sm text-admin-muted">
            На каждый адрес придёт номер новой заявки и ссылка на неё в админке.
          </p>
          {settings.mailboxes.length ? (
            <ul className="divide-y divide-admin-line">
              {settings.mailboxes.map((mailbox) => (
                <li key={mailbox.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="flex min-w-0 items-center gap-2 break-all">
                    <EnvelopeSimple aria-hidden="true" size={19} className="shrink-0" />
                    {mailbox.recipient ?? "Адрес недоступен. Подключите ящик заново."}
                  </span>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={busy || adding}
                    icon={<Trash aria-hidden="true" size={16} />}
                    onClick={() => setRemoving(mailbox)}
                  >
                    Удалить
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-admin-muted">
              {settings.server_mail_enabled
                ? "Пока используется почта, заданная на сервере. Первый добавленный адрес её заменит."
                : "Почта пока не подключена. Новые заявки видны в админке."}
            </p>
          )}
          {!adding ? (
            <div>
              <Button
                disabled={busy || settings.mailboxes.length >= 10}
                icon={<Plus aria-hidden="true" size={17} />}
                onClick={() => {
                  setError(null);
                  setAdding(true);
                }}
              >
                Добавить почту
              </Button>
              {settings.mailboxes.length >= 10 ? (
                <p className="mt-2 text-sm text-admin-muted">Можно подключить до 10 адресов.</p>
              ) : null}
            </div>
          ) : null}
        </Card>
      ) : null}
      {owner && adding ? (
        <Card className="flex flex-col gap-4">
          <CardHeader title="Подключить почту" />
          <form onSubmit={add} autoComplete="off" className="flex flex-col gap-4">
            <Field label="Куда отправлять заявки" hint="Адрес, на который должны приходить письма.">
              {(a11y) => <Input {...a11y} name="recipient" type="email" required maxLength={254} />}
            </Field>
            <Field
              label="Адрес отправителя"
              hint="Адрес подключаемого почтового ящика. Он будет указан в строке «От кого»."
            >
              {(a11y) => <Input {...a11y} name="sender" type="email" required maxLength={254} />}
            </Field>
            <Field
              label="Сервер исходящей почты (SMTP)"
              hint="Найдите его в настройках вашей почты. Например, smtp.yandex.ru для Яндекс Почты."
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  name="host"
                  placeholder="smtp.example.ru"
                  required
                  maxLength={253}
                />
              )}
            </Field>
            <Field label="Порт" hint="Выберите значение из настроек вашей почты.">
              {(a11y) => (
                <Select {...a11y} name="port" defaultValue="465">
                  <option value="465">465 (SSL/TLS)</option>
                  <option value="587">587 (STARTTLS)</option>
                </Select>
              )}
            </Field>
            <Field label="Логин для SMTP" hint="Обычно это полный адрес почты отправителя.">
              {(a11y) => <Input {...a11y} name="username" required maxLength={254} />}
            </Field>
            <Field
              label="Пароль для SMTP"
              hint="Если почта поддерживает пароли приложений, создайте отдельный пароль для почты в разделе безопасности вашего аккаунта."
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  maxLength={1024}
                />
              )}
            </Field>
            {error ? <Notice role="alert">{error}</Notice> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={busy}>
                Сохранить
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setAdding(false);
                  setError(null);
                }}
              >
                Отмена
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        title="Удалить почту?"
        text="Новые заявки перестанут приходить на этот адрес."
        loading={busy}
        onConfirm={() => void remove()}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}
