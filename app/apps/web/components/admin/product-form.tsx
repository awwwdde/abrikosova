"use client";

import { useEffect, useState } from "react";
import { Button, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { ApiError, TAG_LABELS, type ProductTag } from "@/lib/api";

export type ProductFormValues = {
  name: string;
  slug: string;
  category_id: number | "";
  subcategory_id: number | "";
  price: string;
  is_available: boolean;
  is_active: boolean;
  is_featured: boolean;
  description: string;
  composition: string;
  // Числовые поля держим строками: так пустой ввод отличим от нуля,
  // а в число превращаем при сборке запроса
  weight_grams: string;
  portions_min: string;
  portions_max: string;
  shelf_life: string;
  storage_conditions: string;
  tags: ProductTag[];
  order: number;
};

export type CategoryOption = {
  id: number;
  name: string;
  subcategories: { id: number; name: string }[];
};

export const EMPTY_PRODUCT: ProductFormValues = {
  name: "",
  slug: "",
  category_id: "",
  subcategory_id: "",
  price: "",
  is_available: true,
  is_active: true,
  is_featured: false,
  description: "",
  composition: "",
  weight_grams: "",
  portions_min: "",
  portions_max: "",
  shelf_life: "",
  storage_conditions: "",
  tags: [],
  order: 0,
};

/**
 * Транслитерация названия в slug.
 *
 * Slug участвует в URL товара, и заставлять владелицу придумывать его вручную
 * латиницей — лишний повод для ошибки. Поле остаётся редактируемым: у
 * существующего товара slug менять нельзя без потери ссылок, поэтому
 * автоподстановка работает только при создании.
 */
const TRANSLIT: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "c",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

function isPositiveInt(value: string, max: number): boolean {
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) && Number(trimmed) >= 1 && Number(trimmed) <= max;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .split("")
    .map((char) => TRANSLIT[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

export function ProductForm({
  initial,
  categories,
  submitLabel,
  lockSlug = false,
  onSubmit,
  onCancel,
}: {
  initial: ProductFormValues;
  categories: CategoryOption[];
  submitLabel: string;
  lockSlug?: boolean;
  onSubmit: (values: ProductFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<ProductFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [commonError, setCommonError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(lockSlug);

  useEffect(() => {
    setValues(initial);
    setSlugTouched(lockSlug);
  }, [initial, lockSlug]);

  function update<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const selectedCategory = categories.find((c) => c.id === values.category_id);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (values.name.trim().length < 1) next.name = "Укажите название";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug))
      next.slug = "Латиница, цифры и дефис — например tort-medovik";
    if (!values.category_id) next.category_id = "Выберите категорию";
    if (!values.subcategory_id) next.subcategory_id = "Выберите подкатегорию";
    if (!(Number.parseFloat(values.price) > 0)) next.price = "Цена должна быть больше нуля";
    if (!values.description.trim()) next.description = "Заполните описание";
    if (!values.composition.trim()) next.composition = "Заполните состав";
    if (!isPositiveInt(values.weight_grams, 100_000))
      next.weight_grams = "Вес в граммах — целое число больше нуля";
    // Те же правила, что в ProductIn на бэкенде: оба конца или ни одного, «от» ≤ «до»
    const min = values.portions_min.trim();
    const max = values.portions_max.trim();
    if (min || max) {
      if (!min || !max)
        next.portions_min = "Укажите порции «от» и «до» (для одного значения — одинаковые)";
      else if (!isPositiveInt(min, 1000) || !isPositiveInt(max, 1000))
        next.portions_min = "Порции — целые числа от 1 до 1000";
      else if (Number(min) > Number(max))
        next.portions_min = "Порции «от» не могут быть больше «до»";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setCommonError(null);
    if (!validate()) return;

    setSaving(true);
    try {
      await onSubmit(values);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      setCommonError(error instanceof ApiError ? error.message : "Не удалось сохранить");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Название" required error={errors.name}>
          <Input
            value={values.name}
            onChange={(e) => {
              update("name", e.target.value);
              // Пока slug не правили руками, он следует за названием
              if (!slugTouched) update("slug", slugify(e.target.value));
            }}
          />
        </Field>

        <Field
          label="Адрес в каталоге (slug)"
          required
          error={errors.slug}
          hint={lockSlug ? "Менять не рекомендуется: сломаются ссылки на товар" : undefined}
        >
          <Input
            value={values.slug}
            onChange={(e) => {
              setSlugTouched(true);
              update("slug", e.target.value);
            }}
          />
        </Field>

        <Field label="Категория" required error={errors.category_id}>
          <Select
            value={values.category_id}
            onChange={(e) => {
              update("category_id", e.target.value ? Number(e.target.value) : "");
              // Подкатегория принадлежит категории — при смене её надо выбрать заново
              update("subcategory_id", "");
            }}
          >
            <option value="">— выберите —</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Подкатегория"
          required
          error={errors.subcategory_id}
          hint={
            selectedCategory && selectedCategory.subcategories.length === 0
              ? "У этой категории нет подкатегорий — сначала создайте хотя бы одну"
              : undefined
          }
        >
          <Select
            value={values.subcategory_id}
            disabled={!selectedCategory}
            onChange={(e) => update("subcategory_id", e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">— выберите —</option>
            {selectedCategory?.subcategories.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Цена, ₽" required error={errors.price}>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={values.price}
            onChange={(e) => update("price", e.target.value)}
          />
        </Field>

        <Field label="Вес, г" required error={errors.weight_grams} hint="Например: 1200">
          <Input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={values.weight_grams}
            onChange={(e) => update("weight_grams", e.target.value)}
          />
        </Field>

        <Field
          label="Порций от / до"
          error={errors.portions_min ?? errors.portions_max}
          hint="Для одного значения — одинаковые числа; пусто, если порций нет"
        >
          <div className="flex gap-2">
            <Input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              aria-label="Порций от"
              value={values.portions_min}
              onChange={(e) => update("portions_min", e.target.value)}
            />
            <Input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              aria-label="Порций до"
              value={values.portions_max}
              onChange={(e) => update("portions_max", e.target.value)}
            />
          </div>
        </Field>

        <Field label="Срок годности" error={errors.shelf_life} hint="Например: 3 суток при +2…+6°C">
          <Input value={values.shelf_life} onChange={(e) => update("shelf_life", e.target.value)} />
        </Field>
      </div>

      <Field label="Условия хранения" error={errors.storage_conditions}>
        <Textarea
          value={values.storage_conditions}
          onChange={(e) => update("storage_conditions", e.target.value)}
        />
      </Field>

      <Field label="Состав" required error={errors.composition}>
        <Textarea
          value={values.composition}
          onChange={(e) => update("composition", e.target.value)}
        />
      </Field>

      <Field label="Описание" required error={errors.description}>
        <Textarea
          value={values.description}
          onChange={(e) => update("description", e.target.value)}
        />
      </Field>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Метки</legend>
        <div className="flex flex-wrap gap-4">
          {(Object.keys(TAG_LABELS) as ProductTag[]).map((tag) => (
            <Checkbox
              key={tag}
              label={TAG_LABELS[tag]}
              checked={values.tags.includes(tag)}
              onChange={(e) =>
                update(
                  "tags",
                  e.target.checked
                    ? [...values.tags, tag]
                    : values.tags.filter((item) => item !== tag),
                )
              }
            />
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-5">
        <Checkbox
          label="Показывать в каталоге"
          checked={values.is_active}
          onChange={(e) => update("is_active", e.target.checked)}
        />
        <Checkbox
          label="В наличии"
          checked={values.is_available}
          onChange={(e) => update("is_available", e.target.checked)}
        />
        <Checkbox
          label="Показывать на главной"
          checked={values.is_featured}
          onChange={(e) => update("is_featured", e.target.checked)}
        />
      </div>

      <Field label="Порядок сортировки" error={errors.order}>
        <Input
          type="number"
          value={values.order}
          onChange={(e) => update("order", Number(e.target.value) || 0)}
          className="max-w-32"
        />
      </Field>

      {commonError ? (
        <p role="alert" className="rounded-md bg-accent-soft px-4 py-3 text-sm text-danger">
          {commonError}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Сохраняем…" : submitLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
