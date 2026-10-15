"use client";

/** Карточка товара (011d): `/admin/catalog/products/12`. */

import { useParams } from "next/navigation";
import { ProductEditor } from "@/components/admin/product-editor/editor";

export default function AdminProductPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  return <ProductEditor productId={Number.isInteger(id) && id > 0 ? id : null} />;
}
