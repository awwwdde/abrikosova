"use client";

/**
 * Глубокая ссылка на заявку (011e): список с открытой карточкой. Сюда ведут
 * заявки на главной, календарь крупных событий, поиск и колокольчик.
 */

import { useParams } from "next/navigation";
import { Suspense } from "react";
import { RequestsView } from "@/components/admin/requests/requests-view";

export default function AdminConsultationPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  return (
    <Suspense>
      <RequestsView selectedId={Number.isInteger(id) && id > 0 ? id : null} />
    </Suspense>
  );
}
