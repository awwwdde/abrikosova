"use client";

import { useMemo, useState } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import {
  AdminPageHeader,
  Cell,
  Row,
  StateBlock,
  Table,
  useAdminData,
} from "@/components/admin/data-table";
import { ProductImages } from "@/components/admin/product-images";
import {
  EMPTY_PRODUCT,
  ProductForm,
  slugify,
  type CategoryOption,
  type ProductFormValues,
} from "@/components/admin/product-form";
import { Button, Card, Checkbox, Field, Input, Select } from "@/components/ui";
import {
  ApiError,
  formatPrice,
  TAG_LABELS,
  type Page,
  type ProductAdmin,
  type SubCategoryAdmin,
  type CategoryAdmin,
  type ProductIn,
} from "@/lib/api";

type ProductRow = ProductAdmin;

type SubCategoryRow = SubCategoryAdmin;

type CategoryRow = CategoryAdmin;

/**
 * Поля товара, которых пока нет в форме (они появятся в задании 011).
 *
 * `PUT /admin/products/{id}` заменяет товар целиком: поле, которое форма не
 * прислала, бэкенд сбросит в значение по умолчанию — и одно сохранение цены
 * стёрло бы поводы, КБЖУ и срок изготовления. Поэтому при редактировании эти
 * поля берутся из загруженного товара и уходят обратно без изменений.
 * Набор явный и типизирован от ProductIn: если на бэкенде появится новое
 * обязательное поле, сборка payload перестанет компилироваться.
 */
type HiddenFields = Pick<
  ProductIn,
  | "kcal"
  | "proteins"
  | "fats"
  | "carbs"
  | "transport_time"
  | "lead_time_days"
  | "occasions"
  | "dietary"
>;

/** Значения по умолчанию для нового товара — те же, что в ProductIn на бэкенде. */
const EMPTY_HIDDEN: HiddenFields = {
  kcal: null,
  proteins: null,
  fats: null,
  carbs: null,
  transport_time: null,
  lead_time_days: 0,
  occasions: [],
  dietary: [],
};

function hiddenFields(product: ProductRow): HiddenFields {
  return {
    kcal: product.kcal ?? null,
    proteins: product.proteins ?? null,
    fats: product.fats ?? null,
    carbs: product.carbs ?? null,
    transport_time: product.transport_time ?? null,
    lead_time_days: product.lead_time_days,
    occasions: product.occasions,
    dietary: product.dietary,
  };
}

function toFormValues(product: ProductRow): ProductFormValues {
  return {
    name: product.name,
    slug: product.slug,
    category_id: product.category_id,
    subcategory_id: product.subcategory_id,
    price: product.price,
    is_available: product.is_available,
    is_active: product.is_active,
    is_featured: product.is_featured,
    description: product.description,
    composition: product.composition,
    weight_grams: String(product.weight_grams),
    portions_min: product.portions_min != null ? String(product.portions_min) : "",
    portions_max: product.portions_max != null ? String(product.portions_max) : "",
    shelf_life: product.shelf_life ?? "",
    storage_conditions: product.storage_conditions ?? "",
    tags: product.tags,
    order: product.order,
  };
}

function toPayload(values: ProductFormValues, hidden: HiddenFields): ProductIn {
  const portionsMin = values.portions_min.trim();
  const portionsMax = values.portions_max.trim();
  return {
    ...hidden,
    name: values.name.trim(),
    slug: values.slug.trim(),
    category_id: Number(values.category_id),
    subcategory_id: Number(values.subcategory_id),
    price: values.price,
    is_available: values.is_available,
    is_active: values.is_active,
    is_featured: values.is_featured,
    description: values.description.trim(),
    composition: values.composition.trim(),
    weight_grams: Number(values.weight_grams),
    // Пустая строка и «не заполнено» — разные вещи: в БД должен уехать null
    portions_min: portionsMin ? Number(portionsMin) : null,
    portions_max: portionsMax ? Number(portionsMax) : null,
    shelf_life: values.shelf_life.trim() || null,
    storage_conditions: values.storage_conditions.trim() || null,
    tags: values.tags,
    order: values.order,
  };
}

export default function AdminCatalogPage() {
  const { authFetch } = useAdminAuth();
  const [search, setSearch] = useState("");
  const query = `/admin/products?page_size=100${search ? `&search=${encodeURIComponent(search)}` : ""}`;
  const products = useAdminData<Page<ProductRow>>(query);
  const categories = useAdminData<CategoryRow[]>("/admin/categories");

  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const categoryOptions: CategoryOption[] = useMemo(
    () =>
      (categories.data ?? []).map((category) => ({
        id: category.id,
        name: category.name,
        subcategories: category.subcategories.map((sub) => ({ id: sub.id, name: sub.name })),
      })),
    [categories.data],
  );

  async function createProduct(values: ProductFormValues) {
    await authFetch("/admin/products", {
      method: "POST",
      body: JSON.stringify(toPayload(values, EMPTY_HIDDEN)),
    });
    setMode("list");
    await products.reload();
  }

  async function updateProduct(values: ProductFormValues) {
    if (!editing) return;
    await authFetch(`/admin/products/${editing.id}`, {
      method: "PUT",
      body: JSON.stringify(toPayload(values, hiddenFields(editing))),
    });
    setMode("list");
    setEditing(null);
    await products.reload();
  }

  async function removeProduct(product: ProductRow) {
    if (!window.confirm(`Удалить товар «${product.name}»? Действие необратимо.`)) return;

    setBusy(product.id);
    setActionError(null);
    try {
      await authFetch(`/admin/products/${product.id}`, { method: "DELETE" });
      await products.reload();
    } catch (error) {
      // Товар, который уже попал в заказ, удалить нельзя — история заказов важнее
      setActionError(
        error instanceof ApiError
          ? `${error.message}. Если товар был в заказах, скройте его вместо удаления.`
          : "Не удалось удалить",
      );
    } finally {
      setBusy(null);
    }
  }

  async function toggle(product: ProductRow, field: "is_active" | "is_available" | "is_featured") {
    setBusy(product.id);
    setActionError(null);
    try {
      const values = toFormValues(product);
      await authFetch(`/admin/products/${product.id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...toPayload(values, hiddenFields(product)),
          [field]: !product[field],
        }),
      });
      await products.reload();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "Не удалось сохранить");
    } finally {
      setBusy(null);
    }
  }

  if (mode === "create" || (mode === "edit" && editing)) {
    return (
      <div className="max-w-4xl">
        <AdminPageHeader
          title={mode === "create" ? "Новый товар" : `Редактирование: ${editing?.name}`}
        />
        {/* Фото можно грузить только у сохранённого товара: они привязаны к id */}
        {mode === "edit" && editing ? (
          <Card className="mb-4 p-6 md:p-8">
            <ProductImages productId={editing.id} productName={editing.name} />
          </Card>
        ) : null}

        <Card className="p-6 md:p-8">
          <ProductForm
            initial={mode === "edit" && editing ? toFormValues(editing) : EMPTY_PRODUCT}
            categories={categoryOptions}
            submitLabel={mode === "create" ? "Создать товар" : "Сохранить"}
            lockSlug={mode === "edit"}
            onSubmit={mode === "create" ? createProduct : updateProduct}
            onCancel={() => {
              setMode("list");
              setEditing(null);
            }}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <CategoriesSection
        data={categories.data}
        loading={categories.loading}
        error={categories.error}
        reload={categories.reload}
      />

      <section>
        <AdminPageHeader
          title="Товары"
          action={
            <div className="flex gap-2">
              <Input
                type="search"
                placeholder="Поиск по названию"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Поиск товаров"
                className="w-48"
              />
              <Button
                onClick={() => setMode("create")}
                disabled={categoryOptions.length === 0}
                title={
                  categoryOptions.length === 0
                    ? "Сначала создайте категорию и подкатегорию"
                    : undefined
                }
              >
                Добавить товар
              </Button>
            </div>
          }
        />

        <StateBlock loading={products.loading} error={products.error} />

        {actionError ? (
          <p role="alert" className="mb-3 rounded-md bg-accent-soft px-4 py-3 text-sm text-danger">
            {actionError}
          </p>
        ) : null}

        {products.data ? (
          <>
            <Table
              headers={["Название", "Цена", "Метки", "В каталоге", "В наличии", "На главной", ""]}
            >
              {products.data.items.map((product) => (
                <Row key={product.id}>
                  <Cell>
                    <div>{product.name}</div>
                    <code className="text-xs text-ink-subtle">{product.slug}</code>
                  </Cell>
                  <Cell>
                    <span className="tnum">{formatPrice(product.price)}</span>
                  </Cell>
                  <Cell>
                    <span className="text-xs">
                      {product.tags.map((tag) => TAG_LABELS[tag]).join(", ") || "—"}
                    </span>
                  </Cell>
                  {(["is_active", "is_available", "is_featured"] as const).map((field) => (
                    <Cell key={field}>
                      <Button
                        variant="secondary"
                        disabled={busy === product.id}
                        onClick={() => void toggle(product, field)}
                      >
                        {product[field] ? "да" : "нет"}
                      </Button>
                    </Cell>
                  ))}
                  <Cell>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setEditing(product);
                          setMode("edit");
                        }}
                      >
                        Изменить
                      </Button>
                      <Button
                        variant="danger"
                        disabled={busy === product.id}
                        onClick={() => void removeProduct(product)}
                      >
                        Удалить
                      </Button>
                    </div>
                  </Cell>
                </Row>
              ))}
            </Table>
            <p className="mt-3 text-xs text-ink-subtle">Всего товаров: {products.data.total}</p>
          </>
        ) : null}
      </section>
    </div>
  );
}

/** Категории и подкатегории — отдельный блок со своим CRUD. */
function CategoriesSection({
  data,
  loading,
  error,
  reload,
}: {
  data: CategoryRow[] | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}) {
  const { authFetch } = useAdminAuth();
  const [name, setName] = useState("");
  const [subName, setSubName] = useState("");
  const [subCategoryId, setSubCategoryId] = useState<number | "">("");
  const [appliesFillings, setAppliesFillings] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createCategory(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await authFetch("/admin/categories", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          slug: slugify(name),
          order: (data?.length ?? 0) + 1,
          is_active: true,
        }),
      });
      setName("");
      await reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Не удалось создать категорию");
    } finally {
      setBusy(false);
    }
  }

  async function createSubcategory(event: React.FormEvent) {
    event.preventDefault();
    if (!subCategoryId) return;

    setBusy(true);
    setFormError(null);
    try {
      const parent = data?.find((c) => c.id === subCategoryId);
      await authFetch("/admin/subcategories", {
        method: "POST",
        body: JSON.stringify({
          category_id: subCategoryId,
          name: subName.trim(),
          slug: slugify(subName),
          order: (parent?.subcategories.length ?? 0) + 1,
          is_active: true,
          applies_fillings: appliesFillings,
        }),
      });
      setSubName("");
      setAppliesFillings(false);
      await reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Не удалось создать подкатегорию");
    } finally {
      setBusy(false);
    }
  }

  async function removeCategory(category: CategoryRow) {
    if (
      !window.confirm(
        `Удалить категорию «${category.name}» вместе с подкатегориями? Действие необратимо.`,
      )
    )
      return;

    try {
      await authFetch(`/admin/categories/${category.id}`, { method: "DELETE" });
      await reload();
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? `${err.message}. Возможно, в категории ещё есть товары.`
          : "Не удалось удалить",
      );
    }
  }

  async function removeSubcategory(sub: SubCategoryRow) {
    if (!window.confirm(`Удалить подкатегорию «${sub.name}»?`)) return;

    try {
      await authFetch(`/admin/subcategories/${sub.id}`, { method: "DELETE" });
      await reload();
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? `${err.message}. Возможно, в подкатегории ещё есть товары.`
          : "Не удалось удалить",
      );
    }
  }

  return (
    <section>
      <AdminPageHeader
        title="Категории"
        description="Товар нельзя создать, пока у категории нет хотя бы одной подкатегории"
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <form onSubmit={createCategory} className="flex items-end gap-3">
            <div className="flex-1">
              <Field label="Новая категория" required>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
            </div>
            <Button type="submit" disabled={busy || !name.trim()}>
              Добавить
            </Button>
          </form>
        </Card>

        <Card className="p-5">
          <form onSubmit={createSubcategory} className="space-y-3">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Field label="Новая подкатегория" required>
                  <Input value={subName} onChange={(e) => setSubName(e.target.value)} required />
                </Field>
              </div>
              <div className="flex-1">
                <Field label="В категории" required>
                  <Select
                    value={subCategoryId}
                    onChange={(e) => setSubCategoryId(e.target.value ? Number(e.target.value) : "")}
                    required
                  >
                    <option value="">— выберите —</option>
                    {data?.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Checkbox
                label="Показывать начинки в карточках товаров"
                checked={appliesFillings}
                onChange={(e) => setAppliesFillings(e.target.checked)}
              />
              <Button type="submit" disabled={busy || !subName.trim() || !subCategoryId}>
                Добавить
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {formError ? (
        <p role="alert" className="mb-3 rounded-md bg-accent-soft px-4 py-3 text-sm text-danger">
          {formError}
        </p>
      ) : null}

      <StateBlock loading={loading} error={error} />

      {data ? (
        <Table headers={["Категория", "Подкатегории", "Активна", ""]}>
          {data.map((category) => (
            <Row key={category.id}>
              <Cell>
                <div>{category.name}</div>
                <code className="text-xs text-ink-subtle">{category.slug}</code>
              </Cell>
              <Cell>
                {category.subcategories.length === 0 ? (
                  <span className="text-xs text-ink-subtle">нет подкатегорий</span>
                ) : (
                  <ul className="space-y-1">
                    {category.subcategories.map((sub) => (
                      <li key={sub.id} className="flex items-center gap-2 text-xs">
                        <span>{sub.name}</span>
                        {sub.applies_fillings ? (
                          <span className="text-ink-subtle">(с начинками)</span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void removeSubcategory(sub)}
                          className="text-ink-subtle underline transition-colors hover:text-danger"
                        >
                          удалить
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Cell>
              <Cell>{category.is_active ? "да" : "нет"}</Cell>
              <Cell>
                <Button variant="danger" onClick={() => void removeCategory(category)}>
                  Удалить
                </Button>
              </Cell>
            </Row>
          ))}
        </Table>
      ) : null}
    </section>
  );
}
