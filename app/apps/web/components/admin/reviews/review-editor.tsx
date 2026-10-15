"use client";

/**
 * Правка отзыва в боковой карточке (011e) и «Добавить отзыв с Яндекса».
 *
 * Дата отзыва правится отдельно (у отзыва с Яндекса это дата на Яндекс.Картах,
 * а не день переноса в админку — отложенная находка 004b-12). Форма — React Hook
 * Form + Zod, серверные 422 — под полями.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowSquareOut, Trash } from "@phosphor-icons/react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useAdminAuth } from "@/components/admin/auth-context";
import { ProductCombobox } from "@/components/admin/product-combobox";
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
import { ApiError, type ReviewAdmin } from "@/lib/api";

const schema = z.object({
  author_name: z.string().trim().min(1, "Укажите автора").max(200, "Не длиннее 200 символов"),
  text: z.string().trim().min(1, "Текст отзыва не может быть пустым"),
  rating: z.string(),
  review_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату отзыва"),
  external_url: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || /^https:\/\/\S+$/.test(value),
      "Ссылка должна начинаться с https://",
    ),
  product_id: z.string(),
  source: z.enum(["site_form", "manual", "yandex"]),
  is_published: z.boolean(),
});

type Values = z.infer<typeof schema>;
const FIELDS = new Set(Object.keys(schema.shape));

export const SOURCE_LABELS: Record<Values["source"], string> = {
  site_form: "С сайта",
  manual: "Вручную",
  yandex: "Яндекс",
};

function toValues(review: ReviewAdmin | null, today: string, source: Values["source"]): Values {
  return {
    author_name: review?.author_name ?? "",
    text: review?.text ?? "",
    rating: review?.rating ? String(review.rating) : "",
    review_date: review ? review.created_at.slice(0, 10) : today,
    external_url: review?.external_url ?? "",
    product_id: review?.product_id ? String(review.product_id) : "",
    source: (review?.source ?? source) as Values["source"],
    is_published: review?.is_published ?? false,
  };
}

export function ReviewEditor({
  review,
  yandexUrl,
  createSource,
  today,
  onSaved,
  onDeleted,
}: {
  /** null — новый отзыв */
  review: ReviewAdmin | null;
  yandexUrl: string | null;
  createSource: Values["source"];
  today: string;
  onSaved: (review: ReviewAdmin) => void;
  onDeleted: (id: number) => void;
}) {
  const { authFetch } = useAdminAuth();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: toValues(review, today, createSource),
    mode: "onTouched",
  });
  const source = watch("source");

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    const body = {
      author_name: values.author_name,
      text: values.text,
      rating: values.rating ? Number(values.rating) : null,
      review_date: values.review_date,
      external_url: values.external_url || null,
      product_id: values.product_id ? Number(values.product_id) : null,
      source: values.source,
      is_published: values.is_published,
    };
    try {
      const saved = await authFetch<ReviewAdmin>(
        review ? `/admin/reviews/${review.id}` : "/admin/reviews",
        {
          method: review ? "PATCH" : "POST",
          body: JSON.stringify(body),
        },
      );
      reset(toValues(saved, today, createSource));
      toast.success(review ? "Отзыв сохранён" : "Отзыв добавлен");
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
        setFormError(err instanceof ApiError ? err.message : "Не удалось сохранить отзыв");
      }
    }
  });

  async function remove() {
    if (!review) return;
    setDeleting(true);
    try {
      await authFetch(`/admin/reviews/${review.id}`, { method: "DELETE" });
      toast.success("Отзыв удалён");
      setConfirm(false);
      onDeleted(review.id);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось удалить отзыв");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-labelledby="review-title"
      className="flex flex-col gap-4 p-[22px]"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="review-title" className="font-sans text-[17px] font-bold">
          {review ? "Отзыв" : source === "yandex" ? "Отзыв с Яндекса" : "Новый отзыв"}
        </h2>
        {review ? (
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

      {!review && source === "yandex" ? (
        <Notice tone="amber" role="note">
          Скопируйте автора, текст, оценку и дату с Яндекс.Карт, ссылку на отзыв вставьте в поле
          «Оригинал»: по ней гость сможет проверить, что отзыв настоящий.
        </Notice>
      ) : null}
      {!review && source === "yandex" && yandexUrl ? (
        <a
          href={yandexUrl}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-2 self-start text-[13.5px] font-bold text-admin-side no-underline hover:text-admin-hover"
        >
          <ArrowSquareOut aria-hidden="true" size={17} />
          Открыть отзывы на Яндекс.Картах<span className="sr-only"> (в новой вкладке)</span>
        </a>
      ) : null}

      <Field label="Автор" error={errors.author_name?.message}>
        {(a11y) => <Input {...a11y} {...register("author_name")} maxLength={200} />}
      </Field>
      <Field label="Текст" error={errors.text?.message}>
        {(a11y) => <Textarea {...a11y} {...register("text")} rows={5} />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Оценка" error={errors.rating?.message}>
          {(a11y) => (
            <Select {...a11y} {...register("rating")}>
              <option value="">Без оценки</option>
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={String(value)}>
                  {"★".repeat(value)} {value}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Дата отзыва" error={errors.review_date?.message}>
          {(a11y) => <Input {...a11y} type="date" {...register("review_date")} />}
        </Field>
      </div>
      <Field label="Источник" error={errors.source?.message}>
        {(a11y) => (
          <Select {...a11y} {...register("source")}>
            {Object.entries(SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field
        label="Оригинал"
        hint={source === "yandex" ? "Ссылка на отзыв на Яндекс.Картах" : "Необязательно"}
        error={errors.external_url?.message}
      >
        {(a11y) => (
          <Input {...a11y} {...register("external_url")} inputMode="url" placeholder="https://" />
        )}
      </Field>
      <Field
        label="Товар"
        hint="Отзыв покажется и в карточке этого товара"
        error={errors.product_id?.message}
      >
        {(a11y) => (
          <Controller
            control={control}
            name="product_id"
            render={({ field }) => (
              <ProductCombobox
                {...a11y}
                value={field.value}
                initialName={review?.product_name}
                emptyLabel="Без привязки к товару"
                onChange={field.onChange}
              />
            )}
          />
        )}
      </Field>
      <Controller
        control={control}
        name="is_published"
        render={({ field }) => (
          <Switch
            checked={field.value}
            onChange={field.onChange}
            label="Опубликован на сайте"
            description="Неопубликованный отзыв виден только в админке"
          />
        )}
      />
      {formError ? <Notice role="alert">{formError}</Notice> : null}
      <div className="flex gap-2.5">
        <Button type="submit" loading={isSubmitting} disabled={!isDirty && Boolean(review)}>
          {review ? "Сохранить" : "Добавить"}
        </Button>
        {isDirty ? (
          <Button variant="outline" onClick={() => reset()}>
            Отменить
          </Button>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirm}
        title="Удалить отзыв?"
        text="Отзыв пропадёт с сайта и из админки. Вернуть его можно только заново."
        loading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setConfirm(false)}
      />
    </form>
  );
}
