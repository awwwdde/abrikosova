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
import { SingleImageUpload } from "@/components/admin/product-images";
import { Button, Field, Input, Picture } from "@/components/ui";
import { ApiError, type GalleryItemAdmin } from "@/lib/api";

type GalleryRow = GalleryItemAdmin;

export default function AdminGalleryPage() {
  const { authFetch } = useAdminAuth();
  const { data, loading, error, reload } = useAdminData<GalleryRow[]>("/admin/gallery");
  const [caption, setCaption] = useState("");
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await authFetch("/admin/gallery", {
        method: "POST",
        body: JSON.stringify({
          image_key: imageKey,
          caption: caption.trim(),
          is_active: true,
          order: (data?.length ?? 0) + 1,
        }),
      });
      setCaption("");
      setImageKey(null);
      await reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Не удалось добавить");
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: GalleryRow) {
    if (!window.confirm(`Удалить работу «${item.caption}»? Действие необратимо.`)) return;
    await authFetch(`/admin/gallery/${item.id}`, { method: "DELETE" });
    await reload();
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Примеры работ" />

      <form onSubmit={add} className="max-w-xl space-y-4 rounded-lg bg-surface p-6 shadow-raised">
        <SingleImageUpload
          prefix="gallery"
          value={imageKey}
          onChange={setImageKey}
          label="Фотография работы"
        />

        <Field label="Подпись к работе" required>
          <Input value={caption} onChange={(e) => setCaption(e.target.value)} required />
        </Field>

        <Button type="submit" disabled={busy || !caption.trim() || !imageKey}>
          Добавить работу
        </Button>
      </form>
      {formError ? (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      ) : null}
      <StateBlock loading={loading} error={error} />

      {data && data.length > 0 ? (
        <Table headers={["Фото", "Подпись", "Активна", "Порядок", "Действия"]}>
          {data.map((item) => (
            <Row key={item.id}>
              <Cell>
                <div className="w-16">
                  <Picture
                    storageKey={item.image_key}
                    alt={item.caption}
                    ratio="1/1"
                    sizes="64px"
                    className="rounded-sm"
                  />
                </div>
              </Cell>
              <Cell>{item.caption}</Cell>
              <Cell>{item.is_active ? "да" : "нет"}</Cell>
              <Cell>{item.order}</Cell>
              <Cell>
                <Button variant="danger" onClick={() => void remove(item)}>
                  Удалить
                </Button>
              </Cell>
            </Row>
          ))}
        </Table>
      ) : null}
    </div>
  );
}
