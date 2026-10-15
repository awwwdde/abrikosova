import {
  CatalogView,
  catalogMetadata,
  type SearchParams,
} from "@/app/(public)/catalog/catalog-view";

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }) {
  return catalogMetadata(
    {
      title: "Каталог",
      description:
        "Торты, пирожные и десерты: что есть на витрине сегодня и что готовим под заказ. Цена, вес, порции и срок под каждой позицией.",
      path: "/catalog",
    },
    await searchParams,
  );
}

export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  return <CatalogView location={{}} searchParams={await searchParams} />;
}
