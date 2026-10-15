"use client";

/**
 * «Примеры работ» (011f): сетка карточек 4:5, как на сайте, фильтр по поводу и
 * «на сайте / скрытые», порядок — перетаскивание и стрелки, `Switch` «на сайте»,
 * правка в боковой карточке (`?edit=12`, `?edit=new`).
 *
 * Порядок меняется только без фильтров: он общий для всех работ, и двигать
 * карточку внутри отфильтрованной выборки значило бы молча переставлять скрытые.
 */

import { ArrowLeft, ArrowRight, Cake, ImageSquare, Plus, Storefront } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { DragEvent } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import { WorkEditor } from "@/components/admin/gallery/work-editor";
import {
  Button,
  EmptyState,
  FilterMenu,
  IconButton,
  Notice,
  Skeleton,
  Switch,
  useToast,
} from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/use-admin-data";
import { dropItem, moveItem } from "@/lib/admin-catalog";
import { ApiError, OCCASION_LABELS, imageUrl, type GalleryItemAdmin } from "@/lib/api";
import { formatMonthYear } from "@/lib/format";

const OCCASIONS = [
  { value: "", label: "Любой повод" },
  ...Object.entries(OCCASION_LABELS).map(([value, label]) => ({ value, label })),
];
const VISIBILITY = [
  { value: "", label: "На сайте и скрытые" },
  { value: "visible", label: "На сайте" },
  { value: "hidden", label: "Скрытые" },
];

function body(item: GalleryItemAdmin, changes: Partial<GalleryItemAdmin> = {}) {
  const next = { ...item, ...changes };
  return {
    image_key: next.image_key,
    detail_image_key: next.detail_image_key,
    caption: next.caption,
    description: next.description,
    occasion: next.occasion,
    tiers: next.tiers,
    weight_grams: next.weight_grams,
    guests: next.guests,
    made_in: next.made_in,
    is_active: next.is_active,
    order: next.order,
  };
}

export function GalleryView() {
  const { authFetch } = useAdminAuth();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const occasion = params.get("occasion") ?? "";
  const visibility = params.get("visibility") ?? "";
  const edit = params.get("edit") ?? "";
  const { data, error, reload } = useAdminData<GalleryItemAdmin[]>("/admin/gallery");
  const [items, setItems] = useState<GalleryItemAdmin[] | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  useEffect(() => setItems(data ? [...data].sort((a, b) => a.order - b.order) : null), [data]);

  const url = (next: Record<string, string>) => {
    const query = new URLSearchParams({ occasion, visibility, edit, ...next });
    for (const [key, value] of [...query.entries()]) if (!value) query.delete(key);
    const text = query.toString();
    return `/admin/gallery${text ? `?${text}` : ""}`;
  };

  const filtered = useMemo(
    () =>
      (items ?? []).filter(
        (item) =>
          (!occasion || item.occasion === occasion) &&
          (!visibility || item.is_active === (visibility === "visible")),
      ),
    [items, occasion, visibility],
  );
  const canReorder = !occasion && !visibility;

  async function reorder(next: GalleryItemAdmin[]) {
    const previous = items;
    setItems(next);
    try {
      await authFetch("/admin/gallery/order", {
        method: "PUT",
        body: JSON.stringify({ ids: next.map((item) => item.id) }),
      });
    } catch (err) {
      setItems(previous);
      toast.error(err instanceof ApiError ? err.message : "Не удалось поменять порядок");
    }
  }

  async function toggle(item: GalleryItemAdmin, next: boolean) {
    setItems(
      (current) =>
        current?.map((row) => (row.id === item.id ? { ...row, is_active: next } : row)) ?? null,
    );
    try {
      await authFetch(`/admin/gallery/${item.id}`, {
        method: "PUT",
        body: JSON.stringify(body(item, { is_active: next })),
      });
      toast.success(next ? `«${item.caption}» снова на сайте` : `«${item.caption}» скрыта с сайта`);
    } catch (err) {
      setItems(
        (current) =>
          current?.map((row) => (row.id === item.id ? { ...row, is_active: !next } : row)) ?? null,
      );
      toast.error(err instanceof ApiError ? err.message : "Не удалось изменить видимость");
    }
  }

  function dragProps(index: number) {
    if (!canReorder || !items) return {};
    return {
      draggable: true,
      onDragStart: () => setDragging(index),
      onDragEnd: () => setDragging(null),
      onDragOver: (event: DragEvent) => event.preventDefault(),
      onDrop: (event: DragEvent) => {
        event.preventDefault();
        if (dragging !== null && dragging !== index) void reorder(dropItem(items, dragging, index));
        setDragging(null);
      },
    };
  }

  const editing =
    edit && edit !== "new" ? (items?.find((item) => String(item.id) === edit) ?? null) : null;

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[34px] leading-[1.05] font-normal adm-sm:text-[42px]">
            Примеры работ
          </h1>
          <p className="text-[15px] text-admin-muted">
            Торты на заказ, которые видны на сайте в «Примерах работ»
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <FilterMenu
            label="Повод"
            icon={<Cake size={17} />}
            value={occasion}
            options={OCCASIONS}
            onChange={(value) => router.push(url({ occasion: value }), { scroll: false })}
          />
          <FilterMenu
            label="Видимость"
            icon={<Storefront size={17} />}
            value={visibility}
            options={VISIBILITY}
            onChange={(value) => router.push(url({ visibility: value }), { scroll: false })}
          />
          <Button
            icon={<Plus aria-hidden="true" size={17} weight="bold" />}
            onClick={() => router.push(url({ edit: "new" }), { scroll: false })}
          >
            Добавить работу
          </Button>
        </div>
      </div>

      {canReorder ? null : (
        <Notice tone="amber" role="note">
          Порядок меняется без фильтров: он общий для всех работ.
        </Notice>
      )}

      <div className="grid grid-cols-1 items-start gap-5 adm-lg:grid-cols-[minmax(0,1fr)_400px]">
        <section aria-label="Работы" className={edit ? "max-adm-lg:hidden" : ""}>
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
          ) : !items ? (
            <div className="grid grid-cols-2 gap-4 adm-sm:grid-cols-3 adm-xl:grid-cols-4">
              {[0, 1, 2, 3].map((index) => (
                <Skeleton key={index} className="aspect-[4/5] rounded-admin-card" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-admin-card bg-admin-card shadow-admin-card">
              <EmptyState
                icon={<ImageSquare size={24} />}
                title="Работ нет"
                text="Добавьте работу или смените фильтр"
              />
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-4 adm-sm:grid-cols-3 adm-xl:grid-cols-4">
              {filtered.map((item) => {
                const index = items.indexOf(item);
                const src = imageUrl(item.image_key);
                const selected = String(item.id) === edit;
                const meta = [
                  item.occasion ? OCCASION_LABELS[item.occasion] : null,
                  item.made_in ? formatMonthYear(item.made_in) : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li
                    key={item.id}
                    {...dragProps(index)}
                    className={`flex flex-col overflow-hidden rounded-admin-card border-[1.5px] bg-admin-card shadow-admin-card transition-shadow duration-150 hover:shadow-admin-hover ${
                      selected ? "border-admin-side" : "border-transparent"
                    } ${dragging === index ? "opacity-50" : ""} ${item.is_active ? "" : "opacity-75"}`}
                  >
                    <Link
                      href={url({ edit: String(item.id) })}
                      scroll={false}
                      aria-current={selected ? "true" : undefined}
                      className="relative block aspect-[4/5] bg-admin-photo focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-admin-side"
                    >
                      {src ? (
                        <Image
                          src={src}
                          alt=""
                          fill
                          sizes="(min-width: 1280px) 220px, 45vw"
                          className="object-cover"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-admin-faint">
                          <ImageSquare aria-hidden="true" size={28} />
                        </span>
                      )}
                      <span className="sr-only">Изменить «{item.caption}»</span>
                    </Link>
                    <div className="flex flex-col gap-2 p-3">
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-[14px] font-bold">{item.caption}</span>
                        <span className="truncate text-[12px] text-admin-muted">
                          {meta || "Без повода"}
                        </span>
                      </span>
                      <div className="flex items-center justify-between gap-2">
                        <Switch
                          checked={item.is_active}
                          onChange={(next) => void toggle(item, next)}
                          label={`На сайте: ${item.caption}`}
                          hideLabel
                        />
                        {canReorder ? (
                          <span className="flex gap-1">
                            <IconButton
                              label={`Сдвинуть «${item.caption}» влево`}
                              size="sm"
                              disabled={index === 0}
                              onClick={() => void reorder(moveItem(items, index, -1))}
                            >
                              <ArrowLeft size={14} />
                            </IconButton>
                            <IconButton
                              label={`Сдвинуть «${item.caption}» вправо`}
                              size="sm"
                              disabled={index === items.length - 1}
                              onClick={() => void reorder(moveItem(items, index, 1))}
                            >
                              <ArrowRight size={14} />
                            </IconButton>
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside
          aria-label="Карточка работы"
          className={`overflow-hidden rounded-admin-card bg-admin-card shadow-admin-card adm-lg:sticky adm-lg:top-3 ${edit ? "" : "max-adm-lg:hidden"}`}
        >
          {edit ? (
            <Link
              href={url({ edit: "" })}
              scroll={false}
              className="flex px-[22px] pt-3 text-[13.5px] font-bold text-admin-side no-underline adm-lg:hidden"
            >
              Назад к работам
            </Link>
          ) : null}
          {editing || edit === "new" ? (
            <WorkEditor
              key={editing ? editing.id : "new"}
              item={editing}
              nextOrder={items?.length ?? 0}
              onSaved={(saved) => {
                void reload();
                if (!editing) router.replace(url({ edit: String(saved.id) }), { scroll: false });
              }}
              onDeleted={() => {
                router.replace(url({ edit: "" }), { scroll: false });
                void reload();
              }}
            />
          ) : (
            <EmptyState
              title="Выберите работу"
              text="Нажмите на фото, чтобы поправить подпись, фото или повод"
            />
          )}
        </aside>
      </div>
    </div>
  );
}
