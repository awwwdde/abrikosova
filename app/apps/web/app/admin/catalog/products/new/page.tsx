"use client";

/** Новый товар (011d): та же карточка; фото — после первого сохранения. */

import { ProductEditor } from "@/components/admin/product-editor/editor";

export default function AdminNewProductPage() {
  return <ProductEditor productId={null} />;
}
