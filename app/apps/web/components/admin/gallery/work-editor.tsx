"use client";

/**
 * Правка работы из «Примеров работ» (011f) в боковой карточке: основное фото и
 * второй кадр (срез или деталь — сайт показывает его при наведении), подпись,
 * повод, ярусы, вес, гости, месяц и год, описание. Превью — настоящая `WorkCard`
 * сайта с переключателем «как при наведении».
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { Trash } from "@phosphor-icons/react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useAdminAuth } from "@/components/admin/auth-context";
import { SingleImageUpload } from "@/components/admin/single-image-upload";
import {
  Button,
  ConfirmDialog,
  Field,
  Input,
  Notice,
  Select,
  Switch,
  Textarea,
  useToast,
} from "@/components/admin/ui";
import { useUnsavedGuard } from "@/components/admin/use-unsaved-guard";
import { WorkCard } from "@/components/work-card";
import { ApiError, OCCASION_LABELS, type GalleryItemAdmin, type Occasion } from "@/lib/api";
import { parseNumber } from "@/lib/product-form";

const optionalInt = (max: number, message: string) =>
  z.string().refine((value) => {
    const number = parseNumber(value);
    return number === null || (Number.isInteger(number) && number >= 1 && number <= max);
  }, message);

const schema = z.object({
  image_key: z.string().min(1, "Загрузите основное фото"),
  detail_image_key: z.string().nullable(),
  caption: z.string().trim().min(1, "Укажите подпись").max(200, "Не длиннее 200 символов"),
  description: z.string(),
  occasion: z.string(),
  tiers: optionalInt(10, "От 1 до 10"),
  weight_grams: optionalInt(100_000, "Вес в граммах, целое число"),
  guests: optionalInt(10_000, "Целое число гостей"),
  made_in: z.string().refine((value) => value === "" || /^\d{4}-\d{2}$/.test(value), "Месяц и год"),
  is_active: z.boolean(),
});
type Values = z.infer<typeof schema>;
const FIELDS = new Set(Object.keys(schema.shape));

function toValues(item: GalleryItemAdmin | null): Values {
  return {
    image_key: item?.image_key ?? "",
    detail_image_key: item?.detail_image_key ?? null,
    caption: item?.caption ?? "",
    description: item?.description ?? "",
    occasion: item?.occasion ?? "",
    tiers: item?.tiers ? String(item.tiers) : "",
    weight_grams: item?.weight_grams ? String(item.weight_grams) : "",
    guests: item?.guests ? String(item.guests) : "",
    made_in: item?.made_in ? item.made_in.slice(0, 7) : "",
    is_active: item?.is_active ?? true,
  };
}

export function WorkEditor({
  item,
  nextOrder,
  onSaved,
  onDeleted,
}: {
  item: GalleryItemAdmin | null;
  nextOrder: number;
  onSaved: (item: GalleryItemAdmin) => void;
  onDeleted: () => void;
}) {
  const { authFetch } = useAdminAuth();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [hover, setHover] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: toValues(item),
    mode: "onTouched",
  });
  const values = useWatch({ control }) as Values;
  const { dialog } = useUnsavedGuard(isDirty && !isSubmitting);

  const submit = handleSubmit(async (form) => {
    setFormError(null);
    const body = {
      image_key: form.image_key,
      detail_image_key: form.detail_image_key || null,
      caption: form.caption.trim(),
      description: form.description.trim() || null,
      occasion: form.occasion || null,
      tiers: parseNumber(form.tiers),
      weight_grams: parseNumber(form.weight_grams),
      guests: parseNumber(form.guests),
      made_in: form.made_in ? `${form.made_in}-01` : null,
      is_active: form.is_active,
      order: item?.order ?? nextOrder,
    };
    try {
      const saved = await authFetch<GalleryItemAdmin>(
        item ? `/admin/gallery/${item.id}` : "/admin/gallery",
        {
          method: item ? "PUT" : "POST",
          body: JSON.stringify(body),
        },
      );
      reset(toValues(saved));
      toast.success(item ? "Работа сохранена" : "Работа добавлена");
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        let placed = false;
        for (const [field, message] of Object.entries(err.fieldErrors)) {
          if (FIELDS.has(field)) {
            setError(field as keyof Values, { type: "server", message });
            placed = true;
          }
        }
        if (!placed) setFormError(err.message);
      } else {
        setFormError(err instanceof ApiError ? err.message : "Не удалось сохранить работу");
      }
    }
  });

  async function remove() {
    if (!item) return;
    setDeleting(true);
    try {
      await authFetch(`/admin/gallery/${item.id}`, { method: "DELETE" });
      toast.success("Работа удалена вместе с фото");
      setConfirm(false);
      reset(toValues(null));
      onDeleted();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось удалить работу");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-labelledby="work-title"
      className="flex flex-col gap-4 p-[22px]"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="work-title" className="font-sans text-[17px] font-bold">
          {item ? "Работа" : "Новая работа"}
        </h2>
        {item ? (
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

      <div className="rounded-admin-control bg-[#fbf7f0] p-3">
        <div className="mb-2 flex justify-between gap-2">
          <span className="text-[12.5px] font-bold text-admin-muted">Так увидят на сайте</span>
          <Switch checked={hover} onChange={setHover} label="Как при наведении" />
        </div>
        {/* inert: превью — картинка, а не ссылки и кнопки в порядке Tab */}
        <div inert className="mx-auto w-[456px] [zoom:0.6]">
          <WorkCard
            title={values.caption?.trim() || "Подпись работы"}
            image={values.image_key || null}
            secondImage={values.detail_image_key}
            occasion={(values.occasion || null) as Occasion | null}
            madeIn={values.made_in ? `${values.made_in}-01` : null}
            tiers={parseNumber(values.tiers ?? "") || null}
            weightGrams={parseNumber(values.weight_grams ?? "") || null}
            guests={parseNumber(values.guests ?? "") || null}
            forceState={hover ? "hover" : undefined}
            sizes="280px"
          />
        </div>
      </div>

      <Controller
        control={control}
        name="image_key"
        render={({ field }) => (
          <div>
            <SingleImageUpload
              prefix="gallery"
              label="Основное фото"
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
      <Controller
        control={control}
        name="detail_image_key"
        render={({ field }) => (
          <SingleImageUpload
            prefix="gallery"
            label="Второй кадр"
            hint="Срез или деталь: сайт показывает его при наведении"
            optional
            value={field.value}
            onChange={(key) => field.onChange(key)}
          />
        )}
      />
      <Field label="Подпись" error={errors.caption?.message}>
        {(a11y) => <Input {...a11y} {...register("caption")} maxLength={200} />}
      </Field>
      <Field label="Повод" error={errors.occasion?.message}>
        {(a11y) => (
          <Select {...a11y} {...register("occasion")}>
            <option value="">Без повода</option>
            {Object.entries(OCCASION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Ярусы" error={errors.tiers?.message}>
          {(a11y) => <Input {...a11y} {...register("tiers")} inputMode="numeric" />}
        </Field>
        <Field label="Вес" error={errors.weight_grams?.message}>
          {(a11y) => (
            <Input {...a11y} {...register("weight_grams")} inputMode="numeric" suffix="г" />
          )}
        </Field>
        <Field label="Гости" error={errors.guests?.message}>
          {(a11y) => <Input {...a11y} {...register("guests")} inputMode="numeric" />}
        </Field>
      </div>
      <Field
        label="Месяц и год"
        hint="Когда сделан торт: «Август 2025» под фото"
        error={errors.made_in?.message}
      >
        {(a11y) => <Input {...a11y} type="month" {...register("made_in")} />}
      </Field>
      <Field label="Описание" error={errors.description?.message}>
        {(a11y) => <Textarea {...a11y} {...register("description")} rows={3} />}
      </Field>
      <Controller
        control={control}
        name="is_active"
        render={({ field }) => (
          <Switch checked={field.value} onChange={field.onChange} label="Показывать на сайте" />
        )}
      />
      {formError ? <Notice role="alert">{formError}</Notice> : null}
      <div className="flex gap-2.5">
        <Button type="submit" loading={isSubmitting} disabled={!isDirty && Boolean(item)}>
          {item ? "Сохранить" : "Добавить"}
        </Button>
        {isDirty ? (
          <Button variant="outline" onClick={() => reset()}>
            Отменить
          </Button>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirm}
        title={`Удалить «${item?.caption ?? ""}»?`}
        text="Работа пропадёт с сайта, её фото удалятся из хранилища."
        loading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setConfirm(false)}
      />
      {dialog}
    </form>
  );
}
