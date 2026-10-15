"use client";

/** «Примеры работ» (011f): сетка, порядок и правка в боковой карточке. */

import { Suspense } from "react";
import { GalleryView } from "@/components/admin/gallery/gallery-view";

export default function AdminGalleryPage() {
  return (
    <Suspense>
      <GalleryView />
    </Suspense>
  );
}
