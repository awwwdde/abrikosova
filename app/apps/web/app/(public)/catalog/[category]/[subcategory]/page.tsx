import { CatalogView } from "@/app/(public)/catalog/catalog-view";
import { apiGet, type Category } from "@/lib/api";

export const revalidate = 300;

export default async function SubCategoryPage({
  params,
}: {
  params: Promise<{ category: string; subcategory: string }>;
}) {
  const { category, subcategory } = await params;
  const categories = await apiGet<Category[]>("/catalog/categories").catch(() => []);
  return (
    <CatalogView
      categories={categories}
      activeCategory={category}
      activeSubcategory={subcategory}
    />
  );
}
