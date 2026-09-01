import { CatalogView } from "@/app/(public)/catalog/catalog-view";
import { apiGet, type Category } from "@/lib/api";

export const metadata = { title: "Каталог" };
export const revalidate = 300;

export default async function CatalogPage() {
  const categories = await apiGet<Category[]>("/catalog/categories").catch(() => []);
  return <CatalogView categories={categories} />;
}
