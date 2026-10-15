import {
  CatalogView,
  catalogMetadata,
  type SearchParams,
} from "@/app/(public)/catalog/catalog-view";
import { apiGet, type Category } from "@/lib/api";

type Params = Promise<{ category: string }>;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { category } = await params;
  const categories = await apiGet<Category[]>("/catalog/categories").catch(() => []);
  const current = categories.find((item) => item.slug === category);
  if (!current) return { title: "Каталог" };
  const subs = current.subcategories.map((sub) => sub.name.toLowerCase()).join(", ");
  return catalogMetadata(
    {
      title: current.name,
      description: `${current.name} кондитерской Елены Абрикосовой${subs ? `: ${subs}` : ""}. Цена, вес, порции и срок под каждой позицией.`,
      path: `/catalog/${current.slug}`,
    },
    await searchParams,
  );
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { category } = await params;
  return <CatalogView location={{ category }} searchParams={await searchParams} />;
}
