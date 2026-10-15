"use client";

/**
 * «Страницы сайта» (011f): редактор по блокам вместо сырого JSON. Слева — блоки
 * страницы, справа — форма блока; сохраняется страница целиком (`PUT
 * /admin/pages/{key}`), сайт после этого сбрасывает кэш (уже было).
 *
 * Состояние — один объект страницы и пути к полям (`content.faq.0.answer`), а не
 * React Hook Form: блоки состоят из списков строк и вложенных списков объектов,
 * которые у RHF требуют обёрток вокруг каждой строки. Проверка та же, что
 * требует CLAUDE.md, — Zod-схема формы `schemas/pages.py` (`lib/page-editor.ts`)
 * до отправки, а серверные 422 раскладываются по тем же путям.
 */

import {
  ArrowDown,
  ArrowSquareOut,
  ArrowUp,
  FloppyDisk,
  Plus,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import {
  PAGE_BLOCKS,
  PAGE_TABS,
  type BlockSpec,
  type FieldSpec,
} from "@/components/admin/pages/blocks";
import { SingleImageUpload } from "@/components/admin/single-image-upload";
import { SingleVideoUpload } from "@/components/admin/single-video-upload";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  IconButton,
  Input,
  Notice,
  Skeleton,
  Textarea,
  useToast,
} from "@/components/admin/ui";
import { useUnsavedGuard } from "@/components/admin/use-unsaved-guard";
import { ApiError } from "@/lib/api";
import {
  cleanPage,
  getAt,
  hasPlaceholder,
  isPlaceholder,
  pageSchema,
  serverErrors,
  setAt,
  zodErrors,
  type PageKey,
  type PageValue,
} from "@/lib/page-editor";

type Errors = Record<string, string>;

function NeedsText() {
  return <Badge tone="amber">Нужен текст от заказчика</Badge>;
}

function errorUnder(errors: Errors, prefix: string): boolean {
  return Object.keys(errors).some((path) => path === prefix || path.startsWith(`${prefix}.`));
}

function TextField({
  spec,
  value,
  error,
  onChange,
}: {
  spec: {
    path: string;
    label: string;
    multiline?: boolean;
    hint?: string;
    inputMode?: "decimal" | "numeric" | "url";
    type?: "date";
  };
  value: unknown;
  error?: string;
  onChange: (next: string) => void;
}) {
  const text = value === null || value === undefined ? "" : String(value);
  return (
    <Field
      label={
        <span className="inline-flex flex-wrap items-center gap-2">
          {spec.label}
          {isPlaceholder(text) ? <NeedsText /> : null}
        </span>
      }
      hint={spec.hint}
      error={error}
    >
      {(a11y) =>
        spec.multiline ? (
          <Textarea
            {...a11y}
            rows={3}
            value={text}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <Input
            {...a11y}
            value={text}
            type={spec.type}
            inputMode={spec.inputMode}
            onChange={(event) => onChange(event.target.value)}
          />
        )
      }
    </Field>
  );
}

function ListControls({
  label,
  index,
  count,
  onMove,
  onRemove,
}: {
  label: string;
  index: number;
  count: number;
  onMove: (step: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <span className="flex shrink-0 gap-1">
      <IconButton
        label={`Поднять: ${label}`}
        size="sm"
        disabled={index === 0}
        onClick={() => onMove(-1)}
      >
        <ArrowUp size={14} />
      </IconButton>
      <IconButton
        label={`Опустить: ${label}`}
        size="sm"
        disabled={index === count - 1}
        onClick={() => onMove(1)}
      >
        <ArrowDown size={14} />
      </IconButton>
      <IconButton label={`Удалить: ${label}`} size="sm" onClick={onRemove}>
        <Trash size={14} />
      </IconButton>
    </span>
  );
}

function move<T>(items: T[], index: number, step: -1 | 1): T[] {
  const next = [...items];
  const target = index + step;
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

function BlockField({
  spec,
  value,
  errors,
  update,
}: {
  spec: FieldSpec;
  value: PageValue;
  errors: Errors;
  update: (path: string, next: unknown) => void;
}) {
  const current = getAt(value, spec.path);
  if (spec.kind === "video") {
    return (
      <SingleVideoUpload
        value={(current as string | null) ?? null}
        onChange={(video, poster) => {
          update(spec.path, video);
          update("content.hero.poster_key", poster);
        }}
      />
    );
  }
  if (spec.kind === "text") {
    return (
      <TextField
        spec={spec}
        value={current}
        error={errors[spec.path]}
        onChange={(next) => update(spec.path, next)}
      />
    );
  }
  if (spec.kind === "image") {
    return (
      <SingleImageUpload
        prefix="pages"
        label={spec.label}
        hint={spec.hint}
        value={(current as string | null) ?? null}
        onChange={(key) => update(spec.path, key)}
        optional
      />
    );
  }
  const items = Array.isArray(current) ? (current as unknown[]) : [];
  if (spec.kind === "lines") {
    return (
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-1 text-[13.5px] font-bold">{spec.label}</legend>
        {spec.hint ? <p className="text-[12.5px] text-admin-muted">{spec.hint}</p> : null}
        {items.map((item, index) => {
          const path = `${spec.path}.${index}`;
          return (
            <div key={index} className="flex items-start gap-2">
              <div className="min-w-0 grow">
                <TextField
                  spec={{
                    path,
                    label: `${spec.itemLabel} ${index + 1}`,
                    multiline: spec.multiline,
                  }}
                  value={item}
                  error={errors[path]}
                  onChange={(next) => update(path, next)}
                />
              </div>
              <span className="pt-[30px]">
                <ListControls
                  label={`${spec.itemLabel} ${index + 1}`}
                  index={index}
                  count={items.length}
                  onMove={(step) => update(spec.path, move(items, index, step))}
                  onRemove={() =>
                    update(
                      spec.path,
                      items.filter((_, i) => i !== index),
                    )
                  }
                />
              </span>
            </div>
          );
        })}
        <div>
          <Button
            variant="outline"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => update(spec.path, [...items, ""])}
          >
            Добавить: {spec.itemLabel.toLowerCase()}
          </Button>
        </div>
      </fieldset>
    );
  }
  // Список объектов: вопросы, показатели, этапы, соцсети
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-[13.5px] font-bold">{spec.label}</legend>
      {spec.hint ? <p className="text-[12.5px] text-admin-muted">{spec.hint}</p> : null}
      {items.map((item, index) => {
        const base = `${spec.path}.${index}`;
        const title = `${spec.itemLabel} ${index + 1}`;
        return (
          <div
            key={index}
            className="flex flex-col gap-3 rounded-admin-control border border-admin-line p-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-[13px] font-bold text-admin-muted">
                {title}
                {hasPlaceholder(item) ? <NeedsText /> : null}
              </span>
              <ListControls
                label={title}
                index={index}
                count={items.length}
                onMove={(step) => update(spec.path, move(items, index, step))}
                onRemove={() =>
                  update(
                    spec.path,
                    items.filter((_, i) => i !== index),
                  )
                }
              />
            </div>
            {spec.fields.map((field) => {
              const path = `${base}.${field.key}`;
              if (field.kind === "image") {
                return (
                  <SingleImageUpload
                    key={field.key}
                    prefix="pages"
                    label={field.label}
                    value={(getAt(value, path) as string | null) ?? null}
                    onChange={(key) => update(path, key)}
                    optional
                  />
                );
              }
              return (
                <TextField
                  key={field.key}
                  spec={{
                    path,
                    label: field.label,
                    multiline: field.multiline,
                    inputMode: field.inputMode,
                  }}
                  value={getAt(value, path)}
                  error={errors[path]}
                  onChange={(next) => update(path, next)}
                />
              );
            })}
          </div>
        );
      })}
      {spec.max && items.length >= spec.max ? (
        <p className="text-[12.5px] text-admin-muted">Не больше {spec.max}</p>
      ) : (
        <div>
          <Button
            variant="outline"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() =>
              update(spec.path, [
                ...items,
                Object.fromEntries(spec.fields.map((field) => [field.key, ""])),
              ])
            }
          >
            Добавить: {spec.itemLabel.toLowerCase()}
          </Button>
        </div>
      )}
    </fieldset>
  );
}

function blockPaths(block: BlockSpec): string[] {
  return block.fields.map((field) => field.path);
}

export function PageEditor() {
  const { authFetch } = useAdminAuth();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const key = (PAGE_TABS.find((tab) => tab.key === params.get("page"))?.key ?? "home") as PageKey;
  const blocks = PAGE_BLOCKS[key];
  const blockId = blocks.find((block) => block.id === params.get("block"))?.id ?? blocks[0]!.id;
  const block = blocks.find((item) => item.id === blockId)!;
  const tab = PAGE_TABS.find((item) => item.key === key)!;

  const [value, setValue] = useState<PageValue | null>(null);
  const [initial, setInitial] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setValue(null);
    setLoadError(null);
    setErrors({});
    try {
      const page = await authFetch<PageValue>(`/admin/pages/${key}`);
      const { page_key: _ignored, ...rest } = page;
      void _ignored;
      setValue(rest);
      setInitial(JSON.stringify(rest));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Не удалось загрузить страницу");
    }
  }, [authFetch, key]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = value !== null && JSON.stringify(value) !== initial;
  const { dialog } = useUnsavedGuard(dirty && !saving);

  const update = useCallback((path: string, next: unknown) => {
    setValue((current) => (current ? setAt(current, path, next) : current));
    setErrors((current) => {
      if (!Object.keys(current).some((item) => item === path || item.startsWith(`${path}.`)))
        return current;
      return Object.fromEntries(
        Object.entries(current).filter(([item]) => item !== path && !item.startsWith(`${path}.`)),
      );
    });
  }, []);

  const blockUrl = (id: string) => `/admin/pages?page=${key}&block=${id}`;

  async function save() {
    if (!value) return;
    setFormError(null);
    const body = cleanPage(value);
    const parsed = pageSchema(key).safeParse(body);
    if (!parsed.success) {
      const found = zodErrors(parsed.error);
      setErrors(found);
      const first = blocks.find((item) => blockPaths(item).some((path) => errorUnder(found, path)));
      if (first && first.id !== blockId) router.replace(blockUrl(first.id), { scroll: false });
      setFormError("Есть ошибки в полях, они отмечены красным");
      return;
    }
    setSaving(true);
    try {
      const saved = await authFetch<PageValue>(`/admin/pages/${key}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      const { page_key: _ignored, ...rest } = saved;
      void _ignored;
      setValue(rest);
      setInitial(JSON.stringify(rest));
      setErrors({});
      toast.success("Страница сохранена. Сайт обновится в течение минуты");
    } catch (err) {
      const issues =
        (err instanceof ApiError
          ? (err.data?.issues as { loc: (string | number)[]; msg: string }[] | undefined)
          : undefined) ?? [];
      if (issues.length) {
        setErrors(serverErrors(issues));
        setFormError("Сервер не принял часть полей, они отмечены красным");
      } else {
        setFormError(err instanceof ApiError ? err.message : "Не удалось сохранить страницу");
      }
    } finally {
      setSaving(false);
    }
  }

  const blockStates = useMemo(
    () =>
      blocks.map((item) => ({
        id: item.id,
        placeholder: value
          ? blockPaths(item).some((path) => hasPlaceholder(getAt(value, path)))
          : false,
        error: blockPaths(item).some((path) => errorUnder(errors, path)),
      })),
    [blocks, value, errors],
  );

  const missing = block.optionalObject && value && getAt(value, block.optionalObject.path) == null;

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[34px] leading-[1.05] font-normal adm-sm:text-[42px]">
            Страницы сайта
          </h1>
          <p className="text-[15px] text-admin-muted">Тексты, ссылки и фото страниц по блокам</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span aria-live="polite" className="text-[13px] text-admin-muted">
            {dirty ? "Есть несохранённые изменения" : "Все изменения сохранены"}
          </span>
          <a
            href={tab.href}
            target="_blank"
            rel="noopener"
            className="inline-flex h-11 items-center gap-2 rounded-admin-control bg-admin-card px-4 text-sm font-bold text-admin-ink no-underline shadow-admin-card hover:bg-admin-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-side"
          >
            <ArrowSquareOut aria-hidden="true" size={17} />
            Открыть страницу<span className="sr-only"> (в новой вкладке)</span>
          </a>
          <Button variant="outline" disabled={!dirty || saving} onClick={() => void load()}>
            Отменить
          </Button>
          <Button
            icon={<FloppyDisk aria-hidden="true" size={18} />}
            disabled={!dirty}
            loading={saving}
            onClick={() => void save()}
          >
            Сохранить
          </Button>
        </div>
      </div>

      <nav aria-label="Страница" className="flex flex-wrap gap-2">
        {PAGE_TABS.map((item) => {
          const selected = item.key === key;
          return (
            <Link
              key={item.key}
              href={`/admin/pages?page=${item.key}`}
              scroll={false}
              aria-current={selected ? "page" : undefined}
              className={`inline-flex h-10 items-center rounded-full px-4 text-[13.5px] font-bold no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-side ${
                selected
                  ? "bg-admin-side text-admin-card"
                  : "bg-admin-card text-admin-ink shadow-admin-card hover:bg-admin-soft"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {formError ? <Notice role="alert">{formError}</Notice> : null}
      {loadError ? (
        <Notice
          role="alert"
          action={
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Повторить
            </Button>
          }
        >
          {loadError}
        </Notice>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-5 adm-lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav
          aria-label="Блоки страницы"
          className="rounded-admin-card bg-admin-card p-2 shadow-admin-card adm-lg:sticky adm-lg:top-3"
        >
          <ul className="flex flex-col gap-0.5">
            {blocks.map((item, index) => {
              const state = blockStates[index]!;
              const selected = item.id === blockId;
              return (
                <li key={item.id}>
                  <Link
                    href={blockUrl(item.id)}
                    scroll={false}
                    aria-current={selected ? "page" : undefined}
                    className={`flex items-center justify-between gap-2 rounded-admin-small px-3 py-2.5 text-[13.5px] font-semibold no-underline focus-visible:outline-2 focus-visible:outline-admin-side ${
                      selected
                        ? "bg-admin-soft text-admin-side"
                        : "text-admin-ink hover:bg-admin-panel"
                    }`}
                  >
                    {item.label}
                    <span className="flex items-center gap-1">
                      {state.placeholder ? (
                        <span
                          title="Нужен текст от заказчика"
                          className="size-2 rounded-full bg-admin-amber"
                        >
                          <span className="sr-only">: нужен текст от заказчика</span>
                        </span>
                      ) : null}
                      {state.error ? (
                        <WarningCircle
                          aria-label="есть ошибки"
                          size={16}
                          className="text-admin-side"
                        />
                      ) : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <Card aria-labelledby="block-title" className="flex flex-col gap-5">
          <CardHeader id="block-title" title={block.label} />
          {value && block.note ? (
            <Notice tone="amber" role="note">
              {block.note}
            </Notice>
          ) : null}
          {!value ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : missing && block.optionalObject ? (
            <EmptyState
              title="Блок не заполнен"
              text="Пока его нет, сайт показывает текст из макета"
              action={
                <Button
                  size="sm"
                  onClick={() => update(block.optionalObject!.path, block.optionalObject!.empty)}
                >
                  Заполнить блок
                </Button>
              }
            />
          ) : (
            block.fields.map((field) => (
              <BlockField
                key={field.path}
                spec={field}
                value={value}
                errors={errors}
                update={update}
              />
            ))
          )}
        </Card>
      </div>
      {dialog}
    </div>
  );
}
