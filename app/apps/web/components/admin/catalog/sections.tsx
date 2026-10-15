"use client";

/**
 * Каталог → «Разделы» (011e): разделы и подразделы. Порядок — перетаскиванием или
 * стрелками (как фото товара), переименование на месте, скрытие, флаг «показывать
 * начинки» у подраздела. Удалить можно только пустой раздел — иначе бэкенд отвечает
 * 409 с понятным текстом, и он показывается тостом.
 *
 * 005a: «Текст под списком» — абзац под сеткой товаров раздела и подраздела,
 * у раздела ещё подпись первой «таблетки» («Все торты»). Правка — по кнопке,
 * в раскрывающейся форме: текст длинный, править его на месте в строке неудобно.
 */

import {
  ArrowDown,
  ArrowUp,
  Check,
  PencilSimple,
  Plus,
  TextAlignLeft,
  Trash,
  X,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { DragEvent } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import {
  Button,
  Card,
  ConfirmDialog,
  Field,
  IconButton,
  Input,
  Notice,
  Skeleton,
  Switch,
  Textarea,
  useToast,
} from "@/components/admin/ui";
import { dropItem, moveItem } from "@/lib/admin-catalog";
import { ApiError, type CategoryAdmin, type SubCategoryAdmin } from "@/lib/api";
import { slugify } from "@/lib/slugify";

type Target =
  { kind: "category"; item: CategoryAdmin } | { kind: "subcategory"; item: SubCategoryAdmin };

// PUT заменяет запись целиком: текст под списком и подпись «Все» передаются всегда,
// иначе переименование раздела стёрло бы их
function categoryBody(item: CategoryAdmin, changes: Partial<CategoryAdmin> = {}) {
  const next = { ...item, ...changes };
  return {
    name: next.name,
    slug: next.slug,
    order: next.order,
    is_active: next.is_active,
    intro: next.intro ?? null,
    all_label: next.all_label ?? null,
  };
}

function subBody(item: SubCategoryAdmin, changes: Partial<SubCategoryAdmin> = {}) {
  const next = { ...item, ...changes };
  return {
    category_id: next.category_id,
    name: next.name,
    slug: next.slug,
    order: next.order,
    is_active: next.is_active,
    applies_fillings: next.applies_fillings,
    intro: next.intro ?? null,
  };
}

/** «Текст под списком» (и подпись «Все» у раздела) в раскрывающейся форме. */
function IntroEditor({
  label,
  intro,
  allLabel,
  onSave,
  onClose,
}: {
  label: string;
  intro: string | null | undefined;
  /** undefined — у подраздела подписи «Все» нет */
  allLabel?: string | null;
  onSave: (values: { intro: string | null; all_label?: string | null }) => Promise<void>;
  onClose: () => void;
}) {
  const [text, setText] = useState(intro ?? "");
  const [all, setAll] = useState(allLabel ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await onSave({
        intro: text.trim() || null,
        ...(allLabel !== undefined ? { all_label: all.trim() || null } : {}),
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex w-full flex-col gap-3 rounded-admin-control bg-admin-panel p-3.5"
    >
      <Field
        label={`Текст под списком: ${label}`}
        hint="Абзац под сеткой товаров на странице раздела. Пусто — абзаца нет"
      >
        {(a11y) => (
          <Textarea
            {...a11y}
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            maxLength={2000}
          />
        )}
      </Field>
      {allLabel !== undefined ? (
        <Field
          label="Подпись первой кнопки подразделов"
          hint="«Все торты», «Все десерты». Пусто — «Все»"
        >
          {(a11y) => (
            <Input
              {...a11y}
              value={all}
              onChange={(event) => setAll(event.target.value)}
              maxLength={50}
            />
          )}
        </Field>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={busy}>
          Сохранить
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Отмена
        </Button>
      </div>
    </form>
  );
}

/** Название с правкой на месте: карандаш → поле → Enter/«Сохранить», Esc — отмена. */
function InlineName({
  value,
  label,
  onSave,
  strong = false,
}: {
  value: string;
  label: string;
  onSave: (name: string) => Promise<void>;
  strong?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() || text.trim() === value) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await onSave(text.trim());
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={submit} className="flex min-w-0 grow items-center gap-1.5">
        <Input
          aria-label={`Новое название: ${label}`}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setText(value);
              setEditing(false);
            }
          }}
          maxLength={100}
          autoFocus
          className="h-9"
        />
        <IconButton label="Сохранить название" size="sm" type="submit" disabled={busy}>
          <Check size={16} weight="bold" />
        </IconButton>
        <IconButton
          label="Отменить"
          size="sm"
          onClick={() => {
            setText(value);
            setEditing(false);
          }}
        >
          <X size={16} />
        </IconButton>
      </form>
    );
  }
  return (
    <span className="flex min-w-0 grow items-center gap-1.5">
      <span className={`truncate ${strong ? "text-[15px] font-bold" : "text-sm font-semibold"}`}>
        {value}
      </span>
      <IconButton label={`Переименовать: ${label}`} size="sm" onClick={() => setEditing(true)}>
        <PencilSimple size={15} />
      </IconButton>
    </span>
  );
}

function AddForm({
  placeholder,
  onAdd,
}: {
  placeholder: string;
  onAdd: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (!name.trim()) return;
        setBusy(true);
        try {
          await onAdd(name.trim());
          setName("");
        } finally {
          setBusy(false);
        }
      }}
      className="flex items-center gap-2"
    >
      <div className="w-full max-w-sm">
        <Input
          aria-label={placeholder}
          placeholder={placeholder}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={100}
        />
      </div>
      <Button type="submit" variant="outline" loading={busy} icon={<Plus size={15} />}>
        Добавить
      </Button>
    </form>
  );
}

export function SectionsEditor({
  categories: initial,
  onChanged,
}: {
  categories: CategoryAdmin[] | null;
  onChanged: () => Promise<void>;
}) {
  const { authFetch } = useAdminAuth();
  const toast = useToast();
  const [categories, setCategories] = useState<CategoryAdmin[] | null>(initial);
  const [dragging, setDragging] = useState<{ list: string; index: number } | null>(null);
  const [confirm, setConfirm] = useState<Target | null>(null);
  const [busy, setBusy] = useState(false);
  // Чей «Текст под списком» сейчас открыт: «c12» — раздел, «s34» — подраздел
  const [introOpen, setIntroOpen] = useState<string | null>(null);

  useEffect(() => setCategories(initial), [initial]);

  const call = useCallback(
    async (path: string, method: string, body?: unknown, success?: string) => {
      try {
        await authFetch(path, {
          method,
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (success) toast.success(success);
        await onChanged();
        return true;
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Не удалось сохранить");
        await onChanged();
        return false;
      }
    },
    [authFetch, onChanged, toast],
  );

  async function reorderCategories(next: CategoryAdmin[]) {
    setCategories(next);
    await call("/admin/categories/order", "PUT", { ids: next.map((item) => item.id) });
  }

  async function reorderSubs(category: CategoryAdmin, next: SubCategoryAdmin[]) {
    setCategories(
      (current) =>
        current?.map((item) =>
          item.id === category.id ? { ...item, subcategories: next } : item,
        ) ?? null,
    );
    await call(`/admin/categories/${category.id}/subcategories/order`, "PUT", {
      ids: next.map((item) => item.id),
    });
  }

  function dragProps(list: string, index: number, onDrop: (from: number) => void) {
    return {
      draggable: true,
      onDragStart: (event: DragEvent) => {
        event.stopPropagation();
        setDragging({ list, index });
      },
      onDragEnd: () => setDragging(null),
      onDragOver: (event: DragEvent) => {
        if (dragging?.list === list) event.preventDefault();
      },
      onDrop: (event: DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (dragging?.list === list && dragging.index !== index) onDrop(dragging.index);
        setDragging(null);
      },
    };
  }

  async function remove() {
    if (!confirm) return;
    setBusy(true);
    const path =
      confirm.kind === "category"
        ? `/admin/categories/${confirm.item.id}`
        : `/admin/subcategories/${confirm.item.id}`;
    const ok = await call(path, "DELETE", undefined, `«${confirm.item.name}» удалён`);
    setBusy(false);
    if (ok) setConfirm(null);
    else setConfirm(null);
  }

  if (!categories) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-32 rounded-admin-card" />
        <Skeleton className="h-32 rounded-admin-card" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Notice tone="amber" role="note">
        Порядок здесь: в таком же порядке разделы идут в меню каталога на сайте. Удалить можно
        только раздел без товаров.
      </Notice>
      <ol className="flex flex-col gap-4">
        {categories.map((category, index) => (
          <Card
            as="li"
            key={category.id}
            className={`flex flex-col gap-3 ${dragging?.list === "root" && dragging.index === index ? "opacity-50" : ""}`}
            {...dragProps(
              "root",
              index,
              (from) => void reorderCategories(dropItem(categories, from, index)),
            )}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex gap-1">
                <IconButton
                  label={`Поднять раздел «${category.name}»`}
                  size="sm"
                  disabled={index === 0}
                  onClick={() => void reorderCategories(moveItem(categories, index, -1))}
                >
                  <ArrowUp size={15} />
                </IconButton>
                <IconButton
                  label={`Опустить раздел «${category.name}»`}
                  size="sm"
                  disabled={index === categories.length - 1}
                  onClick={() => void reorderCategories(moveItem(categories, index, 1))}
                >
                  <ArrowDown size={15} />
                </IconButton>
              </span>
              <InlineName
                strong
                value={category.name}
                label={category.name}
                onSave={async (name) => {
                  await call(
                    `/admin/categories/${category.id}`,
                    "PUT",
                    categoryBody(category, { name }),
                    "Название сохранено",
                  );
                }}
              />
              <Switch
                checked={category.is_active}
                onChange={(next) =>
                  void call(
                    `/admin/categories/${category.id}`,
                    "PUT",
                    categoryBody(category, { is_active: next }),
                    next ? "Раздел снова на сайте" : "Раздел скрыт с сайта",
                  )
                }
                label="На сайте"
              />
              <IconButton
                label={`Текст под списком: «${category.name}»`}
                size="sm"
                aria-expanded={introOpen === `c${category.id}`}
                onClick={() =>
                  setIntroOpen((open) => (open === `c${category.id}` ? null : `c${category.id}`))
                }
              >
                <TextAlignLeft size={15} />
              </IconButton>
              <IconButton
                label={`Удалить раздел «${category.name}»`}
                size="sm"
                onClick={() => setConfirm({ kind: "category", item: category })}
              >
                <Trash size={15} />
              </IconButton>
              {introOpen === `c${category.id}` ? (
                <IntroEditor
                  label={category.name}
                  intro={category.intro}
                  allLabel={category.all_label ?? null}
                  onClose={() => setIntroOpen(null)}
                  onSave={async (values) => {
                    await call(
                      `/admin/categories/${category.id}`,
                      "PUT",
                      categoryBody(category, values),
                      "Текст раздела сохранён",
                    );
                  }}
                />
              ) : !category.intro ? null : (
                <p className="w-full truncate text-[12.5px] text-admin-muted adm-sm:pl-[72px]">
                  {category.intro}
                </p>
              )}
            </div>
            <ul className="flex flex-col gap-1.5 border-t border-admin-line pt-3 adm-sm:pl-[72px]">
              {category.subcategories.map((sub, subIndex) => (
                <li
                  key={sub.id}
                  className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-admin-small px-2 py-1.5 hover:bg-admin-panel ${
                    dragging?.list === `c${category.id}` && dragging.index === subIndex
                      ? "opacity-50"
                      : ""
                  }`}
                  {...dragProps(
                    `c${category.id}`,
                    subIndex,
                    (from) =>
                      void reorderSubs(category, dropItem(category.subcategories, from, subIndex)),
                  )}
                >
                  <span className="flex gap-1">
                    <IconButton
                      label={`Поднять подраздел «${sub.name}»`}
                      size="sm"
                      disabled={subIndex === 0}
                      onClick={() =>
                        void reorderSubs(category, moveItem(category.subcategories, subIndex, -1))
                      }
                    >
                      <ArrowUp size={14} />
                    </IconButton>
                    <IconButton
                      label={`Опустить подраздел «${sub.name}»`}
                      size="sm"
                      disabled={subIndex === category.subcategories.length - 1}
                      onClick={() =>
                        void reorderSubs(category, moveItem(category.subcategories, subIndex, 1))
                      }
                    >
                      <ArrowDown size={14} />
                    </IconButton>
                  </span>
                  <InlineName
                    value={sub.name}
                    label={sub.name}
                    onSave={async (name) => {
                      await call(
                        `/admin/subcategories/${sub.id}`,
                        "PUT",
                        subBody(sub, { name }),
                        "Название сохранено",
                      );
                    }}
                  />
                  <Switch
                    checked={sub.is_active}
                    onChange={(next) =>
                      void call(
                        `/admin/subcategories/${sub.id}`,
                        "PUT",
                        subBody(sub, { is_active: next }),
                      )
                    }
                    label="На сайте"
                  />
                  <Switch
                    checked={sub.applies_fillings}
                    onChange={(next) =>
                      void call(
                        `/admin/subcategories/${sub.id}`,
                        "PUT",
                        subBody(sub, { applies_fillings: next }),
                        next ? "Начинки показываются" : "Начинки скрыты",
                      )
                    }
                    label="Показывать начинки"
                  />
                  <IconButton
                    label={`Текст под списком: «${sub.name}»`}
                    size="sm"
                    aria-expanded={introOpen === `s${sub.id}`}
                    onClick={() =>
                      setIntroOpen((open) => (open === `s${sub.id}` ? null : `s${sub.id}`))
                    }
                  >
                    <TextAlignLeft size={14} />
                  </IconButton>
                  <IconButton
                    label={`Удалить подраздел «${sub.name}»`}
                    size="sm"
                    onClick={() => setConfirm({ kind: "subcategory", item: sub })}
                  >
                    <Trash size={14} />
                  </IconButton>
                  {introOpen === `s${sub.id}` ? (
                    <IntroEditor
                      label={sub.name}
                      intro={sub.intro}
                      onClose={() => setIntroOpen(null)}
                      onSave={async (values) => {
                        await call(
                          `/admin/subcategories/${sub.id}`,
                          "PUT",
                          subBody(sub, values),
                          "Текст подраздела сохранён",
                        );
                      }}
                    />
                  ) : null}
                </li>
              ))}
              <li className="pt-1.5">
                <AddForm
                  placeholder={`Новый подраздел в «${category.name}»`}
                  onAdd={async (name) => {
                    await call(
                      "/admin/subcategories",
                      "POST",
                      {
                        category_id: category.id,
                        name,
                        slug: slugify(name),
                        order: category.subcategories.length,
                        is_active: true,
                        applies_fillings: false,
                      },
                      "Подраздел добавлен",
                    );
                  }}
                />
              </li>
            </ul>
          </Card>
        ))}
      </ol>
      <Card className="flex flex-col gap-2">
        <span className="text-[13.5px] font-bold">Новый раздел</span>
        <AddForm
          placeholder="Название раздела"
          onAdd={async (name) => {
            await call(
              "/admin/categories",
              "POST",
              { name, slug: slugify(name), order: categories.length, is_active: true },
              "Раздел добавлен",
            );
          }}
        />
      </Card>
      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm
            ? `Удалить ${confirm.kind === "category" ? "раздел" : "подраздел"} «${confirm.item.name}»?`
            : ""
        }
        text={
          confirm?.kind === "category"
            ? "Вместе с разделом удалятся его пустые подразделы. Если в разделе есть товары, удаление не пройдёт."
            : "Если в подразделе есть товары, удаление не пройдёт."
        }
        loading={busy}
        onConfirm={() => void remove()}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
