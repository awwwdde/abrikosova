/** Общий расчёт наличия без схем и зависимостей админской формы. */
import type { ProductAdmin } from "./api";

export type Availability = "today" | "preorder" | "out";

export function availabilityOf(
  product: Pick<ProductAdmin, "is_available" | "lead_time_days">,
): Availability {
  if (!product.is_available) return "out";
  return product.lead_time_days > 0 ? "preorder" : "today";
}
