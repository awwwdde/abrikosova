"use client";

import { useState } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import {
  AdminPageHeader,
  Cell,
  Row,
  StateBlock,
  Table,
  useAdminData,
} from "@/components/admin/data-table";
import { Button } from "@/components/ui";

type ReviewRow = {
  id: number;
  author_name: string;
  text: string;
  rating: number | null;
  is_published: boolean;
  created_at: string;
};

export default function AdminReviewsPage() {
  const { authFetch } = useAdminAuth();
  const { data, loading, error, reload } = useAdminData<ReviewRow[]>("/admin/reviews");
  const [busy, setBusy] = useState<number | null>(null);

  async function togglePublished(review: ReviewRow) {
    setBusy(review.id);
    try {
      await authFetch(`/admin/reviews/${review.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_published: !review.is_published }),
      });
      await reload();
    } finally {
      setBusy(null);
    }
  }

  async function remove(review: ReviewRow) {
    // Удаление необратимо — подтверждаем явно
    if (!window.confirm(`Удалить отзыв от «${review.author_name}»? Действие необратимо.`)) return;
    setBusy(review.id);
    try {
      await authFetch(`/admin/reviews/${review.id}`, { method: "DELETE" });
      await reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <AdminPageHeader title="Отзывы" />
      <StateBlock loading={loading} error={error} />

      {data && data.length === 0 ? <p className="text-sm text-ink-subtle">Отзывов нет</p> : null}

      {data && data.length > 0 ? (
        <Table headers={["Автор", "Текст", "Оценка", "Опубликован", "Действия"]}>
          {data.map((review) => (
            <Row key={review.id}>
              <Cell>{review.author_name}</Cell>
              <Cell>
                <span className="text-xs text-ink">{review.text}</span>
              </Cell>
              <Cell>{review.rating ?? "—"}</Cell>
              <Cell>
                <Button
                  variant="secondary"
                  disabled={busy === review.id}
                  onClick={() => void togglePublished(review)}
                >
                  {review.is_published ? "Скрыть" : "Опубликовать"}
                </Button>
              </Cell>
              <Cell>
                <Button
                  variant="danger"
                  disabled={busy === review.id}
                  onClick={() => void remove(review)}
                >
                  Удалить
                </Button>
              </Cell>
            </Row>
          ))}
        </Table>
      ) : null}
    </div>
  );
}
