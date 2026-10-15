"use client";

/** «Отзывы» (011e): список с вкладками и правка в боковой карточке. */

import { Suspense } from "react";
import { ReviewsView } from "@/components/admin/reviews/reviews-view";

export default function AdminReviewsPage() {
  return (
    <Suspense>
      <ReviewsView />
    </Suspense>
  );
}
