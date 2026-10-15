"use client";

/**
 * Карточка товара в админке (011d, концепт Product.dc.html).
 *
 * Форма — React Hook Form + Zod (`lib/product-form.ts`): ошибки показываются
 * у полей, серверные 422 раскладываются туда же по имени поля. Поля, которых
 * в концепте нет (адрес страницы, срок хранения, метки…), не теряются: берутся
 * из загруженного товара и уходят в `PUT` как были.
 *
 * Справа — фото, наличие и «Так увидят на сайте»: настоящий `ProductCard` сайта
 * в уменьшенном виде, а не его копия — правка карточки на сайте сразу видна здесь.
 *
 * 005a: цена, вес и порции — в блоке «Варианты» (`variants.tsx`); добавлены
 * подзаголовок, короткий состав для карточки, аллергены, упаковка, «Кому»
 * и «Можно надпись».
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { CaretLeft, FloppyDisk } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useAdminAuth } from "@/components/admin/auth-context";
import { useBreadcrumbTrail } from "@/components/admin/breadcrumbs";
import { ProductPhotos } from "@/components/admin/product-editor/photos";
import { ProductVariants } from "@/components/admin/product-editor/variants";
import {
  Button,
  Card,
  CardHeader,
  ChipToggle,
  Field,
  Input,
  Notice,
  RadioCard,
  Select,
  Skeleton,
  Switch,
  Textarea,
  useToast,
} from "@/components/admin/ui";
import { useUnsavedGuard } from "@/components/admin/use-unsaved-guard";
import { CartPreviewProvider } from "@/components/cart-context";
import { ProductCard } from "@/components/product-card";
import { slugify } from "@/lib/slugify";
import { dayMonth } from "@/lib/admin-dashboard";
import {
  ApiError,
  apiFetch,
  type BakerySettings,
  type CatalogFilterOptions,
  type CategoryAdmin,
  type ProductAdmin,
  type ProductListItem,
  TAG_LABELS,
} from "@/lib/api";
import { pluralRu, typograf } from "@/lib/format";
import {
  EMPTY_FORM,
  EMPTY_HIDDEN,
  earliestDate,
  hiddenOf,
  parseNumber,
  productSchema,
  toFormValues,
  toPayload,
  type HiddenFields,
  type ProductFormValues,
} from "@/lib/product-form";

type Loaded = {
  product: ProductAdmin | null;
  categories: CategoryAdmin[];
  filters: CatalogFilterOptions;
  today: string;
  /** Цена надписи из настроек; null — настройки только у владельца, менеджеру не видны */
  inscriptionPrice: number | null;
};

const FORM_FIELDS = new Set(Object.keys(EMPTY_FORM));

/** Метки «Новинка» / «Хит» / «Сезон» — в том же виде, что опции фильтров каталога. */
const TAG_OPTIONS = Object.entries(TAG_LABELS).map(([value, label]) => ({ value, label }));

export function ProductEditor({ productId }: { productId: number | null }) {
  const { authFetch } = useAdminAuth();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [product, categories, filters, clock, settings] = await Promise.all([
        productId ? authFetch<ProductAdmin>(`/admin/products/${productId}`) : Promise.resolve(null),
        authFetch<CategoryAdmin[]>("/admin/categories"),
        apiFetch<CatalogFilterOptions>("/catalog/filters"),
        authFetch<{ today: string }>("/admin/clock"),
        authFetch<BakerySettings>("/admin/settings").catch(() => null),
      ]);
      setLoaded({
        product,
        categories,
        filters,
        today: clock.today,
        inscriptionPrice: settings?.inscription_price ?? null,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось открыть товар");
    }
  }, [authFetch, productId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <Notice
        role="alert"
        action={
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Повторить
          </Button>
        }
      >
        {error}
      </Notice>
    );
  }
  if (!loaded) {
    return (
      // role="status": aria-label на div без роли axe не принимает (QA 011g, 005b);
      // скрытый заголовок — чтобы и пока товар грузится, на странице был H1
      <div
        role="status"
        aria-busy="true"
        aria-label="Загружаем товар"
        className="flex flex-col gap-5"
      >
        <h1 className="sr-only">Загружаем товар</h1>
        <Skeleton className="h-12 w-72" />
        <div className="grid grid-cols-1 gap-5 adm-lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <Skeleton className="h-96 rounded-admin-card" />
          <Skeleton className="h-96 rounded-admin-card" />
        </div>
      </div>
    );
  }
  return <ProductForm key={loaded.product?.id ?? "new"} loaded={loaded} />;
}

function ProductForm({ loaded }: { loaded: Loaded }) {
  const { authFetch } = useAdminAuth();
  const toast = useToast();
  const router = useRouter();
  const [product, setProduct] = useState(loaded.product);
  const [hidden, setHidden] = useState<HiddenFields>(product ? hiddenOf(product) : EMPTY_HIDDEN);
  const [mainImage, setMainImage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: product ? toFormValues(product) : EMPTY_FORM,
    mode: "onTouched",
  });
  const { dialog: leaveDialog } = useUnsavedGuard(isDirty && !isSubmitting);
  const values = useWatch({ control }) as ProductFormValues;

  const category = loaded.categories.find((item) => String(item.id) === values.category_id);
  const subcategories = category?.subcategories ?? [];
  const subcategory = subcategories.find((item) => String(item.id) === values.subcategory_id);

  const submit = handleSubmit(async (form) => {
    setFormError(null);
    const body = toPayload(
      form,
      product ? hidden : { ...hidden, slug: hidden.slug || slugify(form.name) },
      product?.lead_time_days ?? 0,
    );
    try {
      const saved = await authFetch<ProductAdmin>(
        product ? `/admin/products/${product.id}` : "/admin/products",
        { method: product ? "PUT" : "POST", body: JSON.stringify(body) },
      );
      setProduct(saved);
      setHidden(hiddenOf(saved));
      reset(toFormValues(saved));
      toast.success(product ? "Изменения сохранены" : "Товар создан. Теперь можно добавить фото");
      if (!product) router.replace(`/admin/catalog/products/${saved.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        let placed = false;
        for (const [field, message] of Object.entries(err.fieldErrors)) {
          const target = field === "slug" ? "name" : field;
          // «variants.0.price» — поле варианта: проверяем по первому сегменту
          if (FORM_FIELDS.has(target.split(".")[0]!)) {
            setError(target as keyof ProductFormValues, { type: "server", message });
            placed = true;
          }
        }
        if (!placed) setFormError(err.message);
      } else {
        setFormError(err instanceof ApiError ? err.message : "Не удалось сохранить товар");
      }
    }
  });

  const leadDays = parseNumber(values.lead_time_days ?? "");
  const nearest =
    values.availability === "preorder" && leadDays && Number.isInteger(leadDays) && leadDays > 0
      ? dayMonth(earliestDate(loaded.today, leadDays))
      : null;

  const preview: ProductListItem = useMemo(() => {
    // Карточка показывает только включённые варианты — как на сайте
    const variants = (values.variants ?? [])
      .filter((variant) => variant.is_active)
      .map((variant, index) => {
        const price = parseNumber(variant.price ?? "");
        return {
          id: variant.id ?? -1 - index,
          label: variant.label?.trim() || "—",
          price: price && !Number.isNaN(price) ? String(price) : "0",
          weight_grams: parseNumber(variant.weight_grams ?? "") || null,
          portions_min: parseNumber(variant.portions_min ?? "") || null,
          portions_max: parseNumber(variant.portions_max ?? "") || null,
        };
      });
    const prices = variants.map((variant) => Number(variant.price));
    return {
      id: product?.id ?? 0,
      name: values.name?.trim() || "Название товара",
      slug: hidden.slug || "preview",
      price_from: String(prices.length ? Math.min(...prices) : 0),
      has_variants: variants.length > 1,
      variants,
      is_available: values.availability !== "out",
      tags: (values.tags ?? []) as ProductListItem["tags"],
      dietary: (values.dietary ?? []) as ProductListItem["dietary"],
      occasions: (values.occasions ?? []) as ProductListItem["occasions"],
      recipients: (values.recipients ?? []) as ProductListItem["recipients"],
      allows_inscription: Boolean(values.allows_inscription),
      card_ingredients: values.card_ingredients?.trim() || null,
      lead_time_days:
        values.availability === "preorder" ? leadDays || 0 : values.sold_out_today ? 1 : 0,
      sold_out_today: values.availability === "today" && Boolean(values.sold_out_today),
      subcategory: { name: subcategory?.name ?? "", slug: subcategory?.slug ?? "" },
      card_label: hidden.card_label,
      main_image: mainImage,
    };
  }, [values, hidden, product?.id, subcategory, mainImage, leadDays]);

  const title = values.name?.trim() || (product ? product.name : "Новый товар");
  // «Каталог › Торты › Медовик» (011e): раздел — ссылкой на отфильтрованный каталог
  const savedCategory = loaded.categories.find((item) => item.id === product?.category_id);
  useBreadcrumbTrail([
    ...(savedCategory
      ? [{ label: savedCategory.name, href: `/admin/catalog?category=${savedCategory.id}` }]
      : []),
    { label: product ? product.name : "Новый товар" },
  ]);
  const note = isDirty
    ? "Есть несохранённые изменения"
    : product
      ? "Все изменения сохранены"
      : "Заполните карточку и сохраните";

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-[22px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* min-w-0: иначе длинное название растягивает ряд за край экрана, а truncate
            у заголовка не срабатывает (011g, 375px) */}
        <div className="flex max-w-full min-w-0 items-center gap-4">
          <Link
            href="/admin/catalog"
            aria-label="Назад в каталог"
            className="flex size-[42px] shrink-0 items-center justify-center rounded-admin-control bg-admin-card text-admin-ink shadow-admin-card hover:bg-admin-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-side"
          >
            <CaretLeft aria-hidden="true" size={18} weight="bold" />
          </Link>
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="truncate font-display text-[32px] leading-[1.05] font-normal adm-sm:text-[40px]">
              {title}
            </h1>
            <Controller
              control={control}
              name="is_active"
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onChange={field.onChange}
                  label={field.value ? "Показывается на сайте" : "Скрыт с сайта"}
                />
              )}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span aria-live="polite" className="mr-1.5 text-[13px] text-admin-muted">
            {note}
          </span>
          <Button
            variant="outline"
            disabled={!isDirty || isSubmitting}
            onClick={() => {
              reset();
              setFormError(null);
            }}
          >
            Отменить
          </Button>
          <Button
            type="submit"
            disabled={!isDirty}
            loading={isSubmitting}
            icon={<FloppyDisk aria-hidden="true" size={18} />}
          >
            Сохранить
          </Button>
        </div>
      </div>

      {formError ? <Notice role="alert">{formError}</Notice> : null}

      <div className="grid grid-cols-1 items-start gap-5 adm-lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Card aria-labelledby="main-title" className="flex flex-col gap-[18px]">
            <CardHeader id="main-title" title="Основное" />
            <Field
              label="Название"
              hint="Так товар называется в каталоге и в заказах"
              error={errors.name?.message}
            >
              {(a11y) => <Input {...a11y} {...register("name")} maxLength={200} />}
            </Field>
            <Field
              label="Подзаголовок"
              hint="Под названием на странице товара: «Тонкие медовые коржи и сметанный крем»"
              error={errors.subtitle?.message}
            >
              {(a11y) => <Input {...a11y} {...register("subtitle")} maxLength={120} />}
            </Field>
            <div className="grid grid-cols-1 gap-3.5 adm-sm:grid-cols-2">
              <Field label="Раздел" error={errors.category_id?.message}>
                {(a11y) => (
                  <Select
                    {...a11y}
                    {...register("category_id", {
                      onChange: () => setValue("subcategory_id", "", { shouldDirty: true }),
                    })}
                  >
                    <option value="">Выберите раздел</option>
                    {loaded.categories.map((item) => (
                      <option key={item.id} value={String(item.id)}>
                        {item.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field
                label="Подраздел"
                hint="Список зависит от раздела"
                error={errors.subcategory_id?.message}
              >
                {(a11y) => (
                  <Select {...a11y} {...register("subcategory_id")} disabled={!category}>
                    <option value="">{category ? "Выберите подраздел" : "Сначала раздел"}</option>
                    {subcategories.map((item) => (
                      <option key={item.id} value={String(item.id)}>
                        {item.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </Card>

          <ProductVariants
            control={control}
            register={register}
            errors={errors}
            inscriptionPrice={loaded.inscriptionPrice}
          />

          <Card aria-labelledby="text-title" className="flex flex-col gap-[18px]">
            <CardHeader id="text-title" title="Описание и состав" />
            <Field label="Описание" error={errors.description?.message}>
              {(a11y) => <Textarea {...a11y} {...register("description")} rows={4} />}
            </Field>
            <Field
              label="Состав"
              hint="Полный, для страницы товара"
              error={errors.composition?.message}
            >
              {(a11y) => <Textarea {...a11y} {...register("composition")} rows={2} />}
            </Field>
            <Field
              label="Состав для карточки"
              hint="Коротко, в одну строку: «мука, сметана, мёд, сгущёнка». Пусто — в каталоге строки не будет"
              error={errors.card_ingredients?.message}
            >
              {(a11y) => <Input {...a11y} {...register("card_ingredients")} maxLength={120} />}
            </Field>
            <div className="grid grid-cols-1 gap-3.5 adm-sm:grid-cols-2">
              <Field
                label="Аллергены"
                hint="«глютен, молоко, яйцо»"
                error={errors.allergens?.message}
              >
                {(a11y) => <Input {...a11y} {...register("allergens")} maxLength={200} />}
              </Field>
              <Field
                label="Упаковка"
                hint="«Коробка с окном и лентой»"
                error={errors.packaging?.message}
              >
                {(a11y) => <Input {...a11y} {...register("packaging")} maxLength={200} />}
              </Field>
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-[13.5px] font-bold">
                Пищевая ценность на 100 г{" "}
                <span className="text-[12.5px] font-medium text-admin-muted">(необязательно)</span>
              </legend>
              <div className="grid grid-cols-2 gap-3.5 adm-sm:grid-cols-4">
                <Field label="Ккал" error={errors.kcal?.message}>
                  {(a11y) => <Input {...a11y} {...register("kcal")} inputMode="decimal" />}
                </Field>
                <Field label="Белки" error={errors.proteins?.message}>
                  {(a11y) => (
                    <Input {...a11y} {...register("proteins")} inputMode="decimal" suffix="г" />
                  )}
                </Field>
                <Field label="Жиры" error={errors.fats?.message}>
                  {(a11y) => (
                    <Input {...a11y} {...register("fats")} inputMode="decimal" suffix="г" />
                  )}
                </Field>
                <Field label="Углеводы" error={errors.carbs?.message}>
                  {(a11y) => (
                    <Input {...a11y} {...register("carbs")} inputMode="decimal" suffix="г" />
                  )}
                </Field>
              </div>
            </fieldset>
          </Card>

          <Card aria-labelledby="tags-title" className="flex flex-col gap-[18px]">
            <div>
              <CardHeader id="tags-title" title="Поводы, кому и метки" />
              <p className="text-[12.5px] text-admin-muted">
                По поводам, «кому» и ограничениям покупатели фильтруют каталог. Ограничения и метки
                видны на странице товара под названием
              </p>
            </div>
            {(
              [
                // Поводы каталога — без «детского»: это «Кому: для детей» (005a)
                ["occasions", "Повод", loaded.filters.occasions],
                ["recipients", "Кому", loaded.filters.recipients],
                ["dietary", "Ограничения в питании", loaded.filters.dietary],
                // «Новинка», «Хит», «Сезон» (007a): раньше не редактировались вовсе
                ["tags", "Метки", TAG_OPTIONS],
              ] as const
            ).map(([name, legend, options]) => (
              <Controller
                key={name}
                control={control}
                name={name}
                render={({ field }) => (
                  <fieldset>
                    <legend className="mb-2.5 text-[13.5px] font-bold">{legend}</legend>
                    <div className="flex flex-wrap gap-2">
                      {options.map((option) => {
                        const on = field.value.includes(option.value);
                        return (
                          <ChipToggle
                            key={option.value}
                            pressed={on}
                            className="h-[38px]"
                            onChange={(next) =>
                              field.onChange(
                                next
                                  ? [...field.value, option.value]
                                  : field.value.filter((value) => value !== option.value),
                              )
                            }
                          >
                            <span aria-hidden="true">{on ? "✓" : "+"}</span>
                            {option.label}
                          </ChipToggle>
                        );
                      })}
                    </div>
                  </fieldset>
                )}
              />
            ))}
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          {product ? (
            <ProductPhotos productId={product.id} onMainChange={setMainImage} />
          ) : (
            <Card aria-labelledby="photos-title" className="flex flex-col gap-3">
              <CardHeader id="photos-title" title="Фотографии" />
              <p className="text-[13.5px] text-admin-muted">
                {typograf("Фото можно добавить после первого сохранения товара.")}
              </p>
            </Card>
          )}

          <Card aria-labelledby="stock-title" className="flex flex-col gap-[18px]">
            <CardHeader id="stock-title" title="Наличие" />
            <Controller
              control={control}
              name="availability"
              render={({ field }) => (
                <div
                  role="radiogroup"
                  aria-labelledby="stock-title"
                  className="flex flex-col gap-2.5"
                >
                  <RadioCard
                    name="availability"
                    value="today"
                    checked={field.value === "today"}
                    onChange={field.onChange}
                    title="В наличии сегодня"
                    description="Попадает на главную в «Готово сегодня»"
                  />
                  <RadioCard
                    name="availability"
                    value="preorder"
                    checked={field.value === "preorder"}
                    onChange={field.onChange}
                    title="Под заказ"
                    description="Покупатель выбирает дату не раньше срока"
                  />
                  <RadioCard
                    name="availability"
                    value="out"
                    checked={field.value === "out"}
                    onChange={field.onChange}
                    title="Нет в наличии"
                    description="Видно в каталоге, но заказать нельзя"
                  />
                </div>
              )}
            />
            {values.availability === "today" ? (
              <Controller
                control={control}
                name="sold_out_today"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onChange={field.onChange}
                    label="Закончилось сегодня"
                    description="До полуночи товар продаётся под заказ на завтра, потом снова в наличии"
                  />
                )}
              />
            ) : null}
            <Controller
              control={control}
              name="is_upsell"
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onChange={field.onChange}
                  label="Предлагать в корзине"
                  description="В корзине с тортом — в блоке «К торту часто берут», если товар есть сегодня"
                />
              )}
            />
            {values.availability === "preorder" ? (
              <div className="grid grid-cols-[130px_minmax(0,1fr)] items-start gap-3">
                <Field label="Готовим за" error={errors.lead_time_days?.message}>
                  {(a11y) => (
                    <Input
                      {...a11y}
                      {...register("lead_time_days")}
                      inputMode="numeric"
                      suffix="дн."
                    />
                  )}
                </Field>
                <p className="pt-9 text-[12.5px] text-admin-muted">
                  {nearest
                    ? `Ближайшая дата для покупателя: ${nearest}`
                    : "Укажите срок, и здесь появится ближайшая дата"}
                </p>
              </div>
            ) : null}
          </Card>

          <Card aria-labelledby="preview-title" className="flex flex-col gap-[18px]">
            <CardHeader id="preview-title" title="Так увидят на сайте" />
            <div className="rounded-admin-control bg-[#fbf7f0] p-3.5">
              {/* inert: превью не кликается и не попадает в порядок Tab — это картинка, не форма */}
              <div inert className="mx-auto w-[336px] origin-top [zoom:0.62]">
                <CartPreviewProvider>
                  <ProductCard product={preview} sizes="210px" />
                </CartPreviewProvider>
              </div>
            </div>
            <p className="text-[12.5px] text-admin-muted">
              {values.is_active
                ? values.availability === "preorder" && leadDays
                  ? `Под заказ за ${leadDays} ${pluralRu(leadDays, ["день", "дня", "дней"])}`
                  : values.availability === "out"
                    ? "Нет в наличии: кнопка «в корзину» неактивна"
                    : values.sold_out_today
                      ? "Закончилось сегодня: можно заказать на завтра"
                      : "Можно забрать сегодня"
                : "Скрыт: на сайте его не видно"}
            </p>
          </Card>
        </div>
      </div>
      {leaveDialog}
    </form>
  );
}
