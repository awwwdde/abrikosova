"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import { AdminPageHeader } from "@/components/admin/data-table";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { ApiError, type PageContent } from "@/lib/api";

const PAGE_KEYS = [
  { value: "home", label: "Главная" },
  { value: "about", label: "О нас" },
  { value: "custom_cakes", label: "Торты на заказ" },
  { value: "contacts", label: "Контакты" },
];

export default function AdminPagesPage() {
  const { authFetch } = useAdminAuth();
  const [pageKey, setPageKey] = useState("contacts");
  const [page, setPage] = useState<PageContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessage(null);
    setError(null);

    authFetch<PageContent>(`/admin/pages/${pageKey}`)
      .then((result) => {
        if (!cancelled) setPage(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Ошибка загрузки");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authFetch, pageKey]);

  function update(field: keyof PageContent, value: string) {
    setPage((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!page) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await authFetch(`/admin/pages/${pageKey}`, {
        method: "PUT",
        body: JSON.stringify({
          content: page.content ?? {},
          address: page.address || null,
          phone: page.phone || null,
          work_hours_weekdays: page.work_hours_weekdays || null,
          work_hours_weekend: page.work_hours_weekend || null,
          delivery_hours: page.delivery_hours || null,
          map_embed_code: page.map_embed_code || null,
        }),
      });
      setMessage("Сохранено");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Контент страниц"
        action={
          <Select
            value={pageKey}
            onChange={(e) => setPageKey(e.target.value)}
            aria-label="Страница"
          >
            {PAGE_KEYS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        }
      />

      {loading ? <p className="text-sm text-ink-subtle">Загружаем…</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      {page && !loading ? (
        <form onSubmit={save} className="max-w-xl space-y-4">
          <Field label="Адрес">
            <Input value={page.address ?? ""} onChange={(e) => update("address", e.target.value)} />
          </Field>
          <Field label="Телефон">
            <Input value={page.phone ?? ""} onChange={(e) => update("phone", e.target.value)} />
          </Field>
          <Field label="Часы работы (будни)">
            <Input
              value={page.work_hours_weekdays ?? ""}
              onChange={(e) => update("work_hours_weekdays", e.target.value)}
            />
          </Field>
          <Field label="Часы работы (выходные)">
            <Input
              value={page.work_hours_weekend ?? ""}
              onChange={(e) => update("work_hours_weekend", e.target.value)}
            />
          </Field>
          <Field label="Часы доставки">
            <Input
              value={page.delivery_hours ?? ""}
              onChange={(e) => update("delivery_hours", e.target.value)}
            />
          </Field>
          <Field
            label="Код виджета карты"
            hint="Вставляется на страницу контактов. Используйте код только от сервиса карт."
          >
            <Textarea
              value={page.map_embed_code ?? ""}
              onChange={(e) => update("map_embed_code", e.target.value)}
            />
          </Field>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Сохраняем…" : "Сохранить"}
            </Button>
            {message ? <span className="text-sm text-ink-muted">{message}</span> : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
