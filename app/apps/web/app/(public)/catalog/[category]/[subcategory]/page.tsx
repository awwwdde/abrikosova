import {
  CatalogView,
  catalogMetadata,
  type SearchParams,
} from "@/app/(public)/catalog/catalog-view";
import { apiGet, type Category } from "@/lib/api";

type Params = Promise<{ category: string; subcategory: string }>;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { category, subcategory } = await params;
  const categories = await apiGet<Category[]>("/catalog/categories").catch(() => []);
  const current = categories.find((item) => item.slug === category);
  const sub = current?.subcategories.find((item) => item.slug === subcategory);
  if (!current || !sub) return { title: "Каталог" };
  return catalogMetadata(
    {
      title: `${sub.name} — ${current.name.toLowerCase()}`,
      description: `${current.name}, ${sub.name.toLowerCase()}: что есть на витрине и что готовим под заказ. Цена, вес, порции и срок под каждой позицией.`,
      path: `/catalog/${current.slug}/${sub.slug}`,
    },
    await searchParams,
  );
}

export default async function SubCategoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { category, subcategory } = await params;
  return <CatalogView location={{ category, subcategory }} searchParams={await searchParams} />;
}
