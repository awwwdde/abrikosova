"use client";

/**
 * «Торты на заказ и начинки» (011f): две вкладки одного устройства.
 *   - «Начинки» — фото, название, цена за кг, «в наличии», порядок. На сайте —
 *     в «Вкусе изнутри» и в карточках тортов, где у подраздела включены начинки.
 *     С 008a — короткая строка для карточки и метки состава («Сниженный сахар»).
 *   - «Дизайны» — торты на заказ (008a): повод, ярусы, гости, оформление, фото
 *     с подписями; редактор — design-editor.tsx, цена «от» считается сервером.
 * Правка — в боковой карточке (React Hook Form + Zod), порядок — стрелками
 * и перетаскиванием, удаление — с подтверждением, фото удаляются из хранилища.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, ImageSquare, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { DragEvent } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useAdminAuth } from "@/components/admin/auth-context";
import {
  DesignEditor,
  OCCASION_OPTIONS,
  designToggleBody,
} from "@/components/admin/custom-cakes/design-editor";
import { SingleImageUpload } from "@/components/admin/single-image-upload";
import {
  Button,
  ChipToggle,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  Notice,
  Skeleton,
  Switch,
  Textarea,
  useToast,
} from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/use-admin-data";
import { useUnsavedGuard } from "@/components/admin/use-unsaved-guard";
import { dropItem, moveItem } from "@/lib/admin-catalog";
import {
  ApiError,
  DIETARY_LABELS,
  formatPrice,
  imageUrl,
  type CustomCakeAdmin,
  type DietaryTag,
  type FillingAdmin,
} from "@/lib/api";
import { parseNumber } from "@/lib/product-form";

export type Kind = "fillings" | "cakes";

/** Общий вид строки списка обеих вкладок; `raw` — исходная запись для редактора. */
type Row = {
  id: number;
  name: string;
  /** Вторая строка: короткое описание начинки или «Свадьба · 3 яруса · от 40 гостей» */
  meta: string;
  image_key: string | null;
  price: string;
  on: boolean;
  order: number;
  raw: FillingAdmin | CustomCakeAdmin;
};

const tiersLabel = (tiers: number) =>
  `${tiers} ${tiers === 1 ? "ярус" : tiers < 5 ? "яруса" : "ярусов"}`;

const CONFIG = {
  fillings: {
    path: "/admin/fillings",
    order: "/admin/fillings/order",
    switchLabel: "В наличии",
    empty: "Начинок пока нет",
    add: "Добавить начинку",
    perKg: true,
    toRow: (item: FillingAdmin): Row => ({
      id: item.id,
      name: item.name,
      meta: item.short_description || item.description,
      image_key: item.image_key,
      price: String(item.price_per_kg),
      on: item.is_available ?? true,
      order: item.order ?? 0,
      raw: item,
    }),
    toggleBody: (raw: FillingAdmin, on: boolean) => ({ ...fillingBody(raw), is_available: on }),
  },
  cakes: {
    path: "/admin/custom-cakes",
    order: "/admin/custom-cakes/order",
    switchLabel: "На сайте",
    empty: "Дизайнов пока нет",
    add: "Добавить дизайн",
    perKg: false,
    toRow: (item: CustomCakeAdmin): Row => ({
      id: item.id,
      name: item.title,
      meta: [
        OCCASION_OPTIONS.find((option) => option.value === item.occasion)?.label,
        tiersLabel(item.tiers ?? 1),
        `от ${item.min_guests} гостей`,
      ].join(" · "),
      image_key: item.images?.[0]?.storage_key ?? null,
      price: String(item.price_from),
      on: item.is_active ?? true,
      order: item.order ?? 0,
      raw: item,
    }),
    toggleBody: (raw: CustomCakeAdmin, on: boolean) => designToggleBody(raw, on),
  },
};

/** Тело PUT начинки из сохранённой записи — для переключателя в списке. */
function fillingBody(item: FillingAdmin) {
  return {
    name: item.name,
    description: item.description,
    short_description: item.short_description ?? null,
    dietary: item.dietary ?? [],
    image_key: item.image_key,
    price_per_kg: item.price_per_kg,
    is_available: item.is_available ?? true,
    order: item.order ?? 0,
  };
}

const DIETARY = Object.entries(DIETARY_LABELS) as [DietaryTag, string][];

const schema = z.object({
  name: z.string().trim().min(1, "Укажите название").max(100, "Не длиннее 100 символов"),
  description: z.string(),
  short_description: z.string().max(120, "Не длиннее 120 символов"),
  dietary: z.array(z.enum(["gluten_free", "lactose_free", "low_sugar"])),
  image_key: z.string().min(1, "Загрузите фото"),
  price: z.string().refine((value) => {
    const number = parseNumber(value);
    return number !== null && !Number.isNaN(number) && number > 0;
  }, "Число больше нуля"),
  on: z.boolean(),
});
type Values = z.infer<typeof schema>;

function FillingEditor({
  row,
  nextOrder,
  onDone,
}: {
  row: FillingAdmin | null;
  nextOrder: number;
  onDone: (id: number | null) => void;
}) {
  const config = CONFIG.fillings;
  const { authFetch } = useAdminAuth();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const defaults: Values = {
    name: row?.name ?? "",
    description: row?.description ?? "",
    short_description: row?.short_description ?? "",
    dietary: row?.dietary ?? [],
    image_key: row?.image_key ?? "",
    price: row ? String(Number(row.price_per_kg)) : "",
    on: row?.is_available ?? true,
  };
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
    mode: "onTouched",
  });
  const { dialog } = useUnsavedGuard(isDirty && !isSubmitting);

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const saved = await authFetch<FillingAdmin>(row ? `${config.path}/${row.id}` : config.path, {
        method: row ? "PUT" : "POST",
        body: JSON.stringify({
          name: values.name.trim(),
          description: values.description.trim(),
          short_description: values.short_description.trim() || null,
          dietary: values.dietary,
          image_key: values.image_key,
          price_per_kg: String(parseNumber(values.price)),
          is_available: values.on,
          order: row?.order ?? nextOrder,
        }),
      });
      reset(values);
      toast.success(row ? "Сохранено" : "Добавлено");
      onDone(saved.id);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Не удалось сохранить");
    }
  });

  async function remove() {
    if (!row) return;
    setDeleting(true);
    try {
      await authFetch(`${config.path}/${row.id}`, { method: "DELETE" });
      toast.success(`«${row.name}» удалено`);
      setConfirm(false);
      reset(defaults);
      onDone(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось удалить");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-labelledby="item-title"
      className="flex flex-col gap-4 p-[22px]"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="item-title" className="font-sans text-[17px] font-bold">
          {row ? row.name : config.add}
        </h2>
        {row ? (
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash aria-hidden="true" size={15} />}
            onClick={() => setConfirm(true)}
          >
            Удалить
          </Button>
        ) : null}
      </div>
      <Controller
        control={control}
        name="image_key"
        render={({ field }) => (
          <div>
            <SingleImageUpload
              prefix="fillings"
              ratio="1/1"
              value={field.value || null}
              onChange={(key) => field.onChange(key ?? "")}
            />
            {errors.image_key ? (
              <p role="alert" className="mt-1 text-[13px] font-semibold text-admin-side">
                {errors.image_key.message}
              </p>
            ) : null}
          </div>
        )}
      />
      <Field label="Название" error={errors.name?.message}>
        {(a11y) => <Input {...a11y} {...register("name")} maxLength={100} />}
      </Field>
      <Field label="Описание" error={errors.description?.message}>
        {(a11y) => <Textarea {...a11y} {...register("description")} rows={4} />}
      </Field>
      <Field
        label="Строка в карточке"
        hint="«Острота подчёркивает сладость фрукта». Пусто — описание"
        error={errors.short_description?.message}
      >
        {(a11y) => <Input {...a11y} {...register("short_description")} maxLength={120} />}
      </Field>
      <Controller
        control={control}
        name="dietary"
        render={({ field }) => (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13.5px] font-bold">Метки состава</legend>
            <div className="flex flex-wrap gap-2">
              {DIETARY.map(([value, label]) => (
                <ChipToggle
                  key={value}
                  pressed={field.value.includes(value)}
                  onChange={(on) =>
                    field.onChange(
                      on ? [...field.value, value] : field.value.filter((tag) => tag !== value),
                    )
                  }
                >
                  {label}
                </ChipToggle>
              ))}
            </div>
          </fieldset>
        )}
      />
      <Field label="Цена за кг" error={errors.price?.message}>
        {(a11y) => <Input {...a11y} {...register("price")} inputMode="decimal" suffix="₽/кг" />}
      </Field>
      <Controller
        control={control}
        name="on"
        render={({ field }) => (
          <Switch checked={field.value} onChange={field.onChange} label={config.switchLabel} />
        )}
      />
      {formError ? <Notice role="alert">{formError}</Notice> : null}
      <div className="flex gap-2.5">
        <Button type="submit" loading={isSubmitting} disabled={!isDirty && Boolean(row)}>
          {row ? "Сохранить" : "Добавить"}
        </Button>
        {isDirty ? (
          <Button variant="outline" onClick={() => reset()}>
            Отменить
          </Button>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirm}
        title={`Удалить «${row?.name ?? ""}»?`}
        text="Запись пропадёт с сайта, её фото удалится из хранилища."
        loading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setConfirm(false)}
      />
      {dialog}
    </form>
  );
}

export function ItemsView({ kind }: { kind: Kind }) {
  const config = CONFIG[kind];
  const { authFetch } = useAdminAuth();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const edit = params.get("edit") ?? "";
  const { data, error, reload } = useAdminData<(FillingAdmin | CustomCakeAdmin)[]>(config.path);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  useEffect(() => {
    // Вкладка задаёт тип ответа: «Начинки» — FillingAdmin, «Дизайны» — CustomCakeAdmin
    const toRow = config.toRow as (item: FillingAdmin | CustomCakeAdmin) => Row;
    setRows(data ? data.map(toRow).sort((a, b) => a.order - b.order) : null);
  }, [data, config]);

  const url = (next: string) => {
    const query = new URLSearchParams({ tab: kind });
    if (next) query.set("edit", next);
    return `/admin/custom-cakes?${query}`;
  };

  async function reorder(next: Row[]) {
    const previous = rows;
    setRows(next);
    try {
      await authFetch(config.order, {
        method: "PUT",
        body: JSON.stringify({ ids: next.map((row) => row.id) }),
      });
    } catch (err) {
      setRows(previous);
      toast.error(err instanceof ApiError ? err.message : "Не удалось поменять порядок");
    }
  }

  async function toggle(row: Row, on: boolean) {
    setRows(
      (current) => current?.map((item) => (item.id === row.id ? { ...item, on } : item)) ?? null,
    );
    try {
      await authFetch(`${config.path}/${row.id}`, {
        method: "PUT",
        body: JSON.stringify(
          kind === "fillings"
            ? CONFIG.fillings.toggleBody(row.raw as FillingAdmin, on)
            : CONFIG.cakes.toggleBody(row.raw as CustomCakeAdmin, on),
        ),
      });
      toast.success(`«${row.name}»: ${on ? "включено" : "выключено"}`);
    } catch (err) {
      setRows(
        (current) =>
          current?.map((item) => (item.id === row.id ? { ...item, on: !on } : item)) ?? null,
      );
      toast.error(err instanceof ApiError ? err.message : "Не удалось сохранить");
    }
  }

  const editing =
    edit && edit !== "new" ? (rows?.find((row) => String(row.id) === edit) ?? null) : null;
  const done = (id: number | null) => {
    void reload();
    router.replace(url(id ? String(id) : ""), { scroll: false });
  };

  return (
    <div className="grid grid-cols-1 items-start gap-5 adm-lg:grid-cols-[minmax(0,1fr)_400px]">
      <section
        aria-label={kind === "fillings" ? "Начинки" : "Дизайны"}
        className={`flex flex-col gap-3 ${edit ? "max-adm-lg:hidden" : ""}`}
      >
        <div className="flex justify-end">
          <Button
            icon={<Plus aria-hidden="true" size={17} weight="bold" />}
            onClick={() => router.push(url("new"), { scroll: false })}
          >
            {config.add}
          </Button>
        </div>
        {error ? (
          <Notice role="alert">{error}</Notice>
        ) : !rows ? (
          [0, 1, 2].map((index) => <Skeleton key={index} className="h-[84px] rounded-admin-card" />)
        ) : rows.length === 0 ? (
          <div className="rounded-admin-card bg-admin-card shadow-admin-card">
            <EmptyState icon={<ImageSquare size={24} />} title={config.empty} />
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((row, index) => {
              const src = imageUrl(row.image_key);
              const selected = String(row.id) === edit;
              return (
                <li
                  key={row.id}
                  draggable
                  onDragStart={() => setDragging(index)}
                  onDragEnd={() => setDragging(null)}
                  onDragOver={(event: DragEvent) => event.preventDefault()}
                  onDrop={(event: DragEvent) => {
                    event.preventDefault();
                    if (dragging !== null && dragging !== index)
                      void reorder(dropItem(rows, dragging, index));
                    setDragging(null);
                  }}
                  className={`grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-admin-card border-[1.5px] bg-admin-card px-4 py-3 shadow-admin-card adm-sm:grid-cols-[56px_minmax(0,1fr)_120px_auto_auto] ${
                    selected ? "border-admin-side" : "border-transparent"
                  } ${dragging === index ? "opacity-50" : ""}`}
                >
                  <span className="flex size-14 items-center justify-center overflow-hidden rounded-lg bg-admin-photo text-admin-faint">
                    {src ? (
                      <Image
                        src={src}
                        alt=""
                        width={56}
                        height={56}
                        sizes="56px"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImageSquare aria-hidden="true" size={22} />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[14.5px] font-bold">{row.name}</span>
                    <span className="line-clamp-1 text-[13px] text-admin-muted">{row.meta}</span>
                  </span>
                  <span className="text-[14.5px] font-bold tabular-nums adm-sm:text-right">
                    {config.perKg ? "" : "от "}
                    {formatPrice(row.price).replace(" ₽", " ₽")}
                    {config.perKg ? "/кг" : ""}
                  </span>
                  <Switch
                    checked={row.on}
                    onChange={(on) => void toggle(row, on)}
                    label={`${config.switchLabel}: ${row.name}`}
                    hideLabel
                  />
                  <span className="col-span-3 flex items-center justify-end gap-1 adm-sm:col-span-1">
                    <IconButton
                      label={`Поднять «${row.name}»`}
                      size="sm"
                      disabled={index === 0}
                      onClick={() => void reorder(moveItem(rows, index, -1))}
                    >
                      <ArrowUp size={14} />
                    </IconButton>
                    <IconButton
                      label={`Опустить «${row.name}»`}
                      size="sm"
                      disabled={index === rows.length - 1}
                      onClick={() => void reorder(moveItem(rows, index, 1))}
                    >
                      <ArrowDown size={14} />
                    </IconButton>
                    <Link
                      href={url(String(row.id))}
                      scroll={false}
                      aria-current={selected ? "true" : undefined}
                      className="ml-2 inline-flex items-center gap-[5px] text-[13.5px] font-bold text-admin-ink no-underline hover:text-admin-side"
                    >
                      <PencilSimple aria-hidden="true" size={16} />
                      Изменить<span className="sr-only"> «{row.name}»</span>
                    </Link>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <aside
        aria-label="Карточка"
        className={`overflow-hidden rounded-admin-card bg-admin-card shadow-admin-card adm-lg:sticky adm-lg:top-3 ${edit ? "" : "max-adm-lg:hidden"}`}
      >
        {(editing || edit === "new") && kind === "fillings" ? (
          <FillingEditor
            key={`fillings-${editing?.id ?? "new"}`}
            row={(editing?.raw as FillingAdmin | undefined) ?? null}
            nextOrder={rows?.length ?? 0}
            onDone={done}
          />
        ) : editing || edit === "new" ? (
          <DesignEditor
            key={`cakes-${editing?.id ?? "new"}`}
            cake={(editing?.raw as CustomCakeAdmin | undefined) ?? null}
            nextOrder={rows?.length ?? 0}
            onDone={done}
          />
        ) : (
          <EmptyState
            title="Выберите запись"
            text={
              kind === "fillings"
                ? "Нажмите «Изменить» в строке, чтобы поправить фото, текст или цену"
                : "Нажмите «Изменить» в строке, чтобы поправить дизайн и его фото"
            }
          />
        )}
      </aside>
    </div>
  );
}
