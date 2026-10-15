"use client";

/**
 * «Фотографии» в карточке товара (011d): до 6 штук, главное — кликом по фото,
 * порядок — перетаскиванием или кнопками «влево/вправо» (клавиатурная
 * альтернатива), загрузка с прогрессом, удаление с подтверждением.
 *
 * Фото сохраняются сразу, не через «Сохранить»: файл уже в хранилище, и держать
 * его «черновиком» до сохранения формы значило бы терять загрузки при уходе.
 *
 * Подпись фото («Целиком», «Срез», «Деталь», «Упаковка», 005a) выбирается под
 * миниатюрой и тоже сохраняется сразу: её видно на странице товара.
 *
 * Маленькое фото (длинная сторона < 1200 px) не блокируется — только подпись под
 * ним: «Фото маленькое, на сайте может выглядеть размытым». Размер берём у
 * сохранённого файла: хранилище уменьшает большие фото, но не увеличивает малые.
 */

import { ArrowLeft, ArrowRight, Trash, UploadSimple, Warning } from "@phosphor-icons/react";
import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { DragEvent } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import {
  Card,
  CardHeader,
  ConfirmDialog,
  IconButton,
  Select,
  useToast,
} from "@/components/admin/ui";
import {
  ApiError,
  IMAGE_ROLE_LABELS,
  imageUrl,
  type ImageRole,
  type ProductImage,
} from "@/lib/api";
import { isSmallPhoto } from "@/lib/product-form";

const MAX_PHOTOS = 6;

type Upload = { id: string; name: string; share: number };

function usePhotoSizes(images: ProductImage[]) {
  const [small, setSmall] = useState<Record<number, boolean>>({});
  useEffect(() => {
    let cancelled = false;
    for (const image of images) {
      const src = imageUrl(image.storage_key);
      if (!src || small[image.id] !== undefined) continue;
      const probe = new window.Image();
      probe.onload = () => {
        if (!cancelled) {
          setSmall((current) => ({
            ...current,
            [image.id]: isSmallPhoto(probe.naturalWidth, probe.naturalHeight),
          }));
        }
      };
      probe.src = src;
    }
    return () => {
      cancelled = true;
    };
  }, [images, small]);
  return small;
}

export function ProductPhotos({
  productId,
  onMainChange,
}: {
  productId: number;
  onMainChange: (storageKey: string | null) => void;
}) {
  const { authFetch, upload } = useAdminAuth();
  const toast = useToast();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragging, setDragging] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<ProductImage | null>(null);
  const [busy, setBusy] = useState(false);
  const small = usePhotoSizes(images);

  const apply = useCallback(
    (next: ProductImage[]) => {
      const sorted = [...next].sort((a, b) => a.order - b.order);
      setImages(sorted);
      onMainChange(sorted.find((image) => image.is_main)?.storage_key ?? null);
    },
    [onMainChange],
  );

  const reload = useCallback(async () => {
    apply(await authFetch<ProductImage[]>(`/admin/products/${productId}/images`));
  }, [apply, authFetch, productId]);

  useEffect(() => {
    void reload().catch(() => toast.error("Не удалось загрузить фото товара"));
  }, [reload, toast]);

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_PHOTOS - images.length;
    const list = Array.from(files).slice(0, room);
    if (files.length > room) toast.error(`Можно добавить ещё ${room} фото, остальные пропущены`);
    for (const file of list) {
      const id = `${file.name}-${Math.random()}`;
      setUploads((current) => [...current, { id, name: file.name, share: 0 }]);
      try {
        const form = new FormData();
        form.append("file", file);
        await upload<ProductImage>(`/admin/products/${productId}/images`, form, (share) =>
          setUploads((current) =>
            current.map((item) => (item.id === id ? { ...item, share } : item)),
          ),
        );
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : `Не удалось загрузить ${file.name}`);
      } finally {
        setUploads((current) => current.filter((item) => item.id !== id));
      }
    }
    if (inputRef.current) inputRef.current.value = "";
    await reload();
  }

  async function makeMain(image: ProductImage) {
    if (image.is_main) return;
    const previous = images;
    apply(images.map((item) => ({ ...item, is_main: item.id === image.id })));
    try {
      await authFetch(`/admin/products/${productId}/images/${image.id}`, { method: "PATCH" });
    } catch {
      apply(previous);
      toast.error("Не удалось сделать фото главным");
    }
  }

  async function reorder(ids: number[]) {
    const previous = images;
    const byId = new Map(images.map((image) => [image.id, image]));
    apply(ids.map((id, order) => ({ ...byId.get(id)!, order })));
    try {
      apply(
        await authFetch<ProductImage[]>(`/admin/products/${productId}/images/order`, {
          method: "PUT",
          body: JSON.stringify({ ids }),
        }),
      );
    } catch (err) {
      apply(previous);
      toast.error(err instanceof ApiError ? err.message : "Не удалось поменять порядок");
    }
  }

  async function setRole(image: ProductImage, role: ImageRole | null) {
    const previous = images;
    apply(images.map((item) => (item.id === image.id ? { ...item, role } : item)));
    try {
      await authFetch(`/admin/products/${productId}/images/${image.id}/role`, {
        method: "PUT",
        body: JSON.stringify({ role }),
      });
    } catch {
      apply(previous);
      toast.error("Не удалось сохранить подпись фото");
    }
  }

  function move(index: number, step: -1 | 1) {
    const ids = images.map((image) => image.id);
    const target = index + step;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    void reorder(ids);
  }

  function onDrop(event: DragEvent, targetIndex: number) {
    event.preventDefault();
    if (dragging === null || dragging === targetIndex) return;
    const ids = images.map((image) => image.id);
    const [moved] = ids.splice(dragging, 1);
    ids.splice(targetIndex, 0, moved!);
    setDragging(null);
    void reorder(ids);
  }

  async function remove() {
    if (!confirm) return;
    setBusy(true);
    try {
      await authFetch(`/admin/products/${productId}/images/${confirm.id}`, { method: "DELETE" });
      setConfirm(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось удалить фото");
    } finally {
      setBusy(false);
    }
  }

  const full = images.length + uploads.length >= MAX_PHOTOS;

  return (
    <Card aria-labelledby="photos-title" className="flex flex-col gap-[18px]">
      <CardHeader
        id="photos-title"
        title="Фотографии"
        action={
          <span className="text-[12.5px] font-bold text-admin-muted tabular-nums">
            {images.length} из {MAX_PHOTOS}
          </span>
        }
      />
      <ul className="grid grid-cols-2 gap-2.5 adm-sm:grid-cols-3">
        {images.map((image, index) => {
          const src = imageUrl(image.storage_key);
          return (
            <li
              key={image.id}
              className="flex flex-col gap-1.5"
              draggable
              onDragStart={() => setDragging(index)}
              onDragEnd={() => setDragging(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => onDrop(event, index)}
            >
              <div
                className={`group relative aspect-[4/5] overflow-hidden rounded-admin-control border-2 bg-admin-photo ${
                  image.is_main ? "border-admin-side" : "border-transparent"
                } ${dragging === index ? "opacity-50" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => void makeMain(image)}
                  aria-label={
                    image.is_main
                      ? `Фото ${index + 1}, главное`
                      : `Сделать фото ${index + 1} главным`
                  }
                  aria-pressed={image.is_main}
                  className="absolute inset-0 cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-admin-side"
                >
                  {src ? (
                    <Image src={src} alt="" fill sizes="140px" className="object-cover" />
                  ) : null}
                </button>
                {image.is_main ? (
                  <span className="pointer-events-none absolute bottom-1.5 left-1.5 flex h-[22px] items-center rounded-full bg-admin-side px-2 text-[11px] font-extrabold text-admin-card">
                    Главное
                  </span>
                ) : null}
                <div className="absolute top-1 right-1 flex gap-1">
                  <IconButton
                    label={`Удалить фото ${index + 1}`}
                    size="sm"
                    tone="soft"
                    onClick={() => setConfirm(image)}
                  >
                    <Trash size={15} />
                  </IconButton>
                </div>
                <div className="absolute top-1 left-1 flex gap-1">
                  <IconButton
                    label={`Сдвинуть фото ${index + 1} влево`}
                    size="sm"
                    tone="soft"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowLeft size={15} />
                  </IconButton>
                  <IconButton
                    label={`Сдвинуть фото ${index + 1} вправо`}
                    size="sm"
                    tone="soft"
                    disabled={index === images.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowRight size={15} />
                  </IconButton>
                </div>
              </div>
              <Select
                aria-label={`Подпись фото ${index + 1}`}
                value={image.role ?? ""}
                onChange={(event) =>
                  void setRole(image, (event.target.value || null) as ImageRole | null)
                }
              >
                <option value="">Без подписи</option>
                {(Object.keys(IMAGE_ROLE_LABELS) as ImageRole[]).map((role) => (
                  <option key={role} value={role}>
                    {IMAGE_ROLE_LABELS[role]}
                  </option>
                ))}
              </Select>
              {small[image.id] ? (
                <p className="flex items-start gap-1 text-[11.5px] leading-snug font-semibold text-admin-amber">
                  <Warning aria-hidden="true" size={14} className="mt-px shrink-0" />
                  Фото маленькое, на сайте может выглядеть размытым
                </p>
              ) : null}
            </li>
          );
        })}
        {uploads.map((item) => (
          <li
            key={item.id}
            className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-admin-control bg-admin-photo p-3"
          >
            <span className="w-full truncate text-center text-[11.5px] text-admin-muted">
              {item.name}
            </span>
            <progress
              value={Math.round(item.share * 100)}
              max={100}
              aria-label={`Загрузка ${item.name}`}
              className="h-1.5 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-admin-line [&::-webkit-progress-value]:bg-admin-side"
            />
            <span className="text-xs font-bold text-admin-side tabular-nums">
              {Math.round(item.share * 100)}%
            </span>
          </li>
        ))}
        {full ? null : (
          <li>
            <label
              htmlFor={inputId}
              className="flex aspect-[4/5] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-admin-control border-[1.5px] border-dashed border-admin-dash bg-[#fbf7f0] text-[12.5px] font-bold text-admin-side transition-colors duration-150 hover:bg-admin-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-admin-side"
            >
              <UploadSimple aria-hidden="true" size={22} />
              Загрузить
              <input
                ref={inputRef}
                id={inputId}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={(event) => void uploadFiles(event.target.files)}
              />
            </label>
          </li>
        )}
      </ul>
      <p className="text-[12.5px] leading-normal text-admin-muted">
        Нажмите на фото, чтобы сделать его главным. Порядок меняется перетаскиванием или стрелками.
        Подпись под фото видна на странице товара. Фото и подписи сохраняются сразу.
      </p>
      <ConfirmDialog
        open={confirm !== null}
        title="Удалить фото?"
        text="Файл удалится из хранилища, вернуть его можно только новой загрузкой."
        loading={busy}
        onConfirm={() => void remove()}
        onClose={() => setConfirm(null)}
      />
    </Card>
  );
}
