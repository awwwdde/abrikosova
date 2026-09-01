"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import { Button, Picture } from "@/components/ui";
import { ApiError } from "@/lib/api";

type ProductImage = {
  id: number;
  storage_key: string;
  is_main: boolean;
  order: number;
};

const MAX_IMAGES = 6;
const ACCEPT = "image/jpeg,image/png,image/webp";

export function ProductImages({
  productId,
  productName,
}: {
  productId: number;
  productName: string;
}) {
  const { authFetch } = useAdminAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setImages(await authFetch<ProductImage[]>(`/admin/products/${productId}/images`));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось загрузить фотографии");
    } finally {
      setLoading(false);
    }
  }, [authFetch, productId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /**
   * Загрузка идёт не через authFetch: там тело всегда JSON, а здесь нужен
   * multipart. Заголовок Content-Type для FormData браузер ставит сам —
   * задать его вручную нельзя, иначе потеряется boundary.
   */
  async function upload(files: FileList) {
    setBusy(true);
    setError(null);

    try {
      for (const file of Array.from(files).slice(0, MAX_IMAGES - images.length)) {
        const body = new FormData();
        body.append("file", file);

        const response = await authFetch<ProductImage>(`/admin/products/${productId}/images`, {
          method: "POST",
          body,
        });
        setImages((prev) => [...prev, response]);
      }
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось загрузить файл");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function setMain(image: ProductImage) {
    setBusy(true);
    try {
      await authFetch(`/admin/products/${productId}/images/${image.id}`, { method: "PATCH" });
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось назначить главное фото");
    } finally {
      setBusy(false);
    }
  }

  async function remove(image: ProductImage) {
    if (!window.confirm("Удалить фотографию? Действие необратимо.")) return;

    setBusy(true);
    try {
      await authFetch(`/admin/products/${productId}/images/${image.id}`, { method: "DELETE" });
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось удалить фото");
    } finally {
      setBusy(false);
    }
  }

  const limitReached = images.length >= MAX_IMAGES;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Фотографии</p>
          <p className="tnum text-xs text-ink-subtle">
            {images.length} из {MAX_IMAGES} · JPEG, PNG или WEBP, до 10 МБ
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => e.target.files && void upload(e.target.files)}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={busy || limitReached}
            onClick={() => inputRef.current?.click()}
            title={limitReached ? `Больше ${MAX_IMAGES} фотографий загрузить нельзя` : undefined}
          >
            {busy ? "Загружаем…" : "Загрузить фото"}
          </Button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mb-3 rounded-md bg-accent-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="aspect-square animate-pulse rounded-md bg-surface-sunken" />
          ))}
        </div>
      ) : images.length === 0 ? (
        <p className="rounded-md bg-surface-sunken px-4 py-6 text-center text-sm text-ink-muted">
          Фотографий пока нет. Первая загруженная станет главной.
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-3 md:grid-cols-6">
          {images.map((image) => (
            <li key={image.id} className="space-y-1.5">
              <Picture
                storageKey={image.storage_key}
                alt={`${productName} — фото ${image.order + 1}`}
                ratio="1/1"
                sizes="160px"
                className="rounded-md"
              />
              {image.is_main ? (
                <p className="text-center text-2xs text-accent">Главное</p>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void setMain(image)}
                  className="block w-full text-center text-2xs text-ink-subtle underline transition-colors hover:text-ink"
                >
                  Сделать главным
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove(image)}
                className="block w-full text-center text-2xs text-ink-subtle underline transition-colors hover:text-danger"
              >
                Удалить
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-ink-subtle">
        Фото автоматически сжимается и переводится в WEBP — загружайте оригиналы, не уменьшая
        заранее. Служебные данные снимка (геометка, модель камеры) при этом удаляются.
      </p>
    </section>
  );
}

/** Одиночная загрузка для разделов, где фото — поле записи (галерея, начинки). */
export function SingleImageUpload({
  prefix,
  value,
  onChange,
  label = "Изображение",
}: {
  prefix: "gallery" | "fillings" | "custom-cakes" | "reviews";
  value: string | null;
  onChange: (key: string) => void;
  label?: string;
}) {
  const { authFetch } = useAdminAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const result = await authFetch<{ storage_key: string }>(`/admin/uploads?prefix=${prefix}`, {
        method: "POST",
        body,
      });
      onChange(result.storage_key);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось загрузить файл");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      <div className="flex items-center gap-3">
        <div className="w-24">
          <Picture storageKey={value} alt={label} ratio="1/1" sizes="96px" className="rounded-md" />
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Загружаем…" : value ? "Заменить" : "Загрузить"}
          </Button>
          {error ? (
            <p role="alert" className="mt-1.5 text-xs text-danger">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
