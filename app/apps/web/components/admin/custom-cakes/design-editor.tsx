"use client";

/**
 * Карточка дизайна торта на заказ (008a): адрес, повод, подзаголовок, ярусы, минимум
 * гостей, оформление и фото с подписями («Целиком», «Срез», «Деталь», «Сбоку»).
 * Цена «от» не вводится: сервер считает её из минимума гостей и цены за кг
 * оформления (Настройки → «Торты на заказ»), здесь она только показывается.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, Trash, X } from "@phosphor-icons/react";
import Image from "next/image";
import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { useAdminAuth } from "@/components/admin/auth-context";
import { SingleImageUpload } from "@/components/admin/single-image-upload";
import {
  Button,
  ConfirmDialog,
  Field,
  IconButton,
  Input,
  Notice,
  Select,
  Switch,
  Textarea,
  useToast,
} from "@/components/admin/ui";
import { useUnsavedGuard } from "@/components/admin/use-unsaved-guard";
import { ApiError, formatPrice, imageUrl, type CustomCakeAdmin } from "@/lib/api";

type Occasion = CustomCakeAdmin["occasion"];
type Decoration = NonNullable<CustomCakeAdmin["decoration"]>;
type Role = "whole" | "cut" | "detail" | "side";

export const OCCASION_OPTIONS: { value: Occasion; label: string }[] = [
  { value: "wedding", label: "Свадьба" },
  { value: "birthday", label: "День рождения" },
  { value: "kids", label: "Детский" },
  { value: "anniversary_corporate", label: "Юбилей и корпоратив" },
];
export const DECORATION_OPTIONS: { value: Decoration; label: string }[] = [
  { value: "classic", label: "Классическое оформление" },
  { value: "cream_drawing", label: "Рисунок кремом" },
  { value: "multi_tier", label: "Многоярусный" },
];
const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "whole", label: "Целиком" },
  { value: "cut", label: "Срез" },
  { value: "detail", label: "Деталь" },
  { value: "side", label: "Сбоку" },
];

const whole = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, message)
    .refine((value) => Number(value) >= min && Number(value) <= max, message);

const schema = z.object({
  title: z.string().trim().min(1, "Укажите название").max(200, "Не длиннее 200 символов"),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Латиница, цифры и дефисы: belyy-s-pionami"),
  subtitle: z.string().max(300, "Не длиннее 300 символов"),
  description: z.string().max(5000, "Не длиннее 5000 символов"),
  occasion: z.enum(["wedding", "birthday", "kids", "anniversary_corporate"]),
  tiers: whole(1, 10, "От 1 до 10"),
  min_guests: whole(1, 1000, "От 1 до 1000"),
  decoration: z.enum(["classic", "cream_drawing", "multi_tier"]),
  images: z.array(
    z.object({
      storage_key: z.string().min(1),
      role: z.enum(["whole", "cut", "detail", "side", ""]),
    }),
  ),
  is_active: z.boolean(),
});
type Values = z.infer<typeof schema>;

export function DesignEditor({
  cake,
  nextOrder,
  onDone,
}: {
  cake: CustomCakeAdmin | null;
  nextOrder: number;
  onDone: (id: number | null) => void;
}) {
  const { authFetch } = useAdminAuth();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const defaults: Values = {
    title: cake?.title ?? "",
    slug: cake?.slug ?? "",
    subtitle: cake?.subtitle ?? "",
    description: cake?.description ?? "",
    occasion: cake?.occasion ?? "birthday",
    tiers: String(cake?.tiers ?? 1),
    min_guests: String(cake?.min_guests ?? 10),
    decoration: cake?.decoration ?? "classic",
    images: (cake?.images ?? []).map((image) => ({
      storage_key: image.storage_key,
      role: image.role ?? "",
    })),
    is_active: cake?.is_active ?? true,
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
  const photos = useFieldArray({ control, name: "images" });
  const { dialog } = useUnsavedGuard(isDirty && !isSubmitting);

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const saved = await authFetch<CustomCakeAdmin>(
        cake ? `/admin/custom-cakes/${cake.id}` : "/admin/custom-cakes",
        {
          method: cake ? "PUT" : "POST",
          body: JSON.stringify(designBody(values, cake?.order ?? nextOrder)),
        },
      );
      reset(values);
      toast.success(cake ? "Сохранено" : "Добавлено");
      onDone(saved.id);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Не удалось сохранить");
    }
  });

  async function remove() {
    if (!cake) return;
    setDeleting(true);
    try {
      await authFetch(`/admin/custom-cakes/${cake.id}`, { method: "DELETE" });
      toast.success(`«${cake.title}» удалён`);
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
      aria-labelledby="design-title"
      className="flex flex-col gap-4 p-[22px]"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="design-title" className="font-sans text-[17px] font-bold">
          {cake ? cake.title : "Новый дизайн"}
        </h2>
        {cake ? (
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

      {cake ? (
        <p className="rounded-admin-control bg-admin-soft px-3.5 py-2.5 text-[13.5px]">
          <b className="tabular-nums">от {formatPrice(String(cake.price_from))}</b>
          <span className="text-admin-muted">
            {" "}
            · {String(cake.weight_kg).replace(".0", "").replace(".", ",")} кг на {cake.min_guests}{" "}
            гостей · {formatPrice(String(cake.price_per_kg))}/кг. Считается из настроек
          </span>
        </p>
      ) : null}

      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2 text-[13.5px] font-bold">Фото</legend>
        {photos.fields.length === 0 ? (
          <p className="text-[13px] text-admin-muted">Без фото на сайте будет плашка</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {photos.fields.map((field, index) => {
              const src = imageUrl(field.storage_key);
              return (
                <li key={field.id} className="flex items-center gap-2.5">
                  <span className="flex aspect-[4/5] w-12 shrink-0 overflow-hidden rounded-lg bg-admin-photo">
                    {src ? (
                      <Image
                        src={src}
                        alt=""
                        width={48}
                        height={60}
                        sizes="48px"
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </span>
                  <Select
                    aria-label={`Подпись фото ${index + 1}`}
                    {...register(`images.${index}.role`)}
                    className="min-w-0 flex-1"
                  >
                    <option value="">Без подписи</option>
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <IconButton
                    label={`Фото ${index + 1} выше`}
                    size="sm"
                    disabled={index === 0}
                    onClick={() => photos.move(index, index - 1)}
                  >
                    <ArrowUp size={14} />
                  </IconButton>
                  <IconButton
                    label={`Фото ${index + 1} ниже`}
                    size="sm"
                    disabled={index === photos.fields.length - 1}
                    onClick={() => photos.move(index, index + 1)}
                  >
                    <ArrowDown size={14} />
                  </IconButton>
                  <IconButton
                    label={`Убрать фото ${index + 1}`}
                    size="sm"
                    onClick={() => photos.remove(index)}
                  >
                    <X size={14} />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        )}
        <SingleImageUpload
          prefix="custom-cakes"
          label="Добавить фото"
          hint="Первое фото — обложка карточки"
          value={null}
          onChange={(key) => {
            if (key)
              photos.append({
                storage_key: key,
                role: photos.fields.length === 0 ? "whole" : "",
              });
          }}
        />
      </fieldset>

      <Field label="Название" error={errors.title?.message}>
        {(a11y) => <Input {...a11y} {...register("title")} maxLength={200} />}
      </Field>
      <Field label="Адрес" hint="/custom-cakes/… — латиница и дефисы" error={errors.slug?.message}>
        {(a11y) => <Input {...a11y} {...register("slug")} maxLength={200} />}
      </Field>
      <Field label="Подзаголовок" error={errors.subtitle?.message}>
        {(a11y) => <Input {...a11y} {...register("subtitle")} maxLength={300} />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Повод" error={errors.occasion?.message}>
          {(a11y) => (
            <Select {...a11y} {...register("occasion")}>
              {OCCASION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Оформление" error={errors.decoration?.message}>
          {(a11y) => (
            <Select {...a11y} {...register("decoration")}>
              {DECORATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Ярусов" error={errors.tiers?.message}>
          {(a11y) => <Input {...a11y} {...register("tiers")} inputMode="numeric" />}
        </Field>
        <Field label="Гостей от" error={errors.min_guests?.message}>
          {(a11y) => <Input {...a11y} {...register("min_guests")} inputMode="numeric" />}
        </Field>
      </div>
      <Field label="Описание" error={errors.description?.message}>
        {(a11y) => <Textarea {...a11y} {...register("description")} rows={4} />}
      </Field>
      <Controller
        control={control}
        name="is_active"
        render={({ field }) => (
          <Switch checked={field.value} onChange={field.onChange} label="На сайте" />
        )}
      />
      {formError ? <Notice role="alert">{formError}</Notice> : null}
      <div className="flex gap-2.5">
        <Button type="submit" loading={isSubmitting} disabled={!isDirty && Boolean(cake)}>
          {cake ? "Сохранить" : "Добавить"}
        </Button>
        {isDirty ? (
          <Button variant="outline" onClick={() => reset()}>
            Отменить
          </Button>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirm}
        title={`Удалить «${cake?.title ?? ""}»?`}
        text="Дизайн пропадёт с сайта, его фото удалятся из хранилища. Заявки по нему останутся."
        loading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setConfirm(false)}
      />
      {dialog}
    </form>
  );
}

/** Тело PUT/POST из значений формы. */
function designBody(values: Values, order: number) {
  return {
    title: values.title.trim(),
    slug: values.slug.trim(),
    subtitle: values.subtitle.trim() || null,
    description: values.description.trim(),
    occasion: values.occasion,
    tiers: Number(values.tiers),
    min_guests: Number(values.min_guests),
    decoration: values.decoration,
    images: values.images.map((image) => ({
      storage_key: image.storage_key,
      role: image.role || null,
    })),
    is_active: values.is_active,
    order,
  };
}

/** Тело PUT для переключателя «На сайте» в списке — всё как есть, кроме флага. */
export function designToggleBody(cake: CustomCakeAdmin, on: boolean) {
  return {
    title: cake.title,
    slug: cake.slug,
    subtitle: cake.subtitle ?? null,
    description: cake.description ?? "",
    occasion: cake.occasion,
    tiers: cake.tiers,
    min_guests: cake.min_guests,
    decoration: cake.decoration,
    images: cake.images,
    is_active: on,
    order: cake.order,
  };
}
