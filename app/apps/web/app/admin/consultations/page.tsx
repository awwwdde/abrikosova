"use client";

/** «Заявки на торты» (011e). Фильтры — в параметрах адреса. */

import { Suspense } from "react";
import { RequestsView } from "@/components/admin/requests/requests-view";

export default function AdminConsultationsPage() {
  return (
    <Suspense>
      <RequestsView selectedId={null} />
    </Suspense>
  );
}
