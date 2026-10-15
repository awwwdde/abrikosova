"use client";

/** «Страницы сайта» (011f): редактор по блокам. Страница и блок — в адресе. */

import { Suspense } from "react";
import { PageEditor } from "@/components/admin/pages/page-editor";

export default function AdminPagesPage() {
  return (
    <Suspense>
      <PageEditor />
    </Suspense>
  );
}
