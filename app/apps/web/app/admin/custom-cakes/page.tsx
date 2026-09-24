"use client";

import {
  AdminPageHeader,
  Cell,
  Row,
  StateBlock,
  Table,
  useAdminData,
} from "@/components/admin/data-table";
import { formatPrice, type CustomCakeAdmin, type FillingAdmin } from "@/lib/api";

type CakeRow = CustomCakeAdmin;

type FillingRow = FillingAdmin;

export default function AdminCustomCakesPage() {
  const cakes = useAdminData<CakeRow[]>("/admin/custom-cakes");
  const fillings = useAdminData<FillingRow[]>("/admin/fillings");

  return (
    <div className="space-y-8">
      <section>
        <AdminPageHeader title="Торты на заказ" />
        <StateBlock loading={cakes.loading} error={cakes.error} />
        {cakes.data ? (
          <Table headers={["Название", "Описание", "Цена от", "Активна"]}>
            {cakes.data.map((cake) => (
              <Row key={cake.id}>
                <Cell>{cake.title}</Cell>
                <Cell>
                  <span className="text-xs text-ink-muted">{cake.description}</span>
                </Cell>
                <Cell>{formatPrice(cake.price_from)}</Cell>
                <Cell>{cake.is_active ? "да" : "нет"}</Cell>
              </Row>
            ))}
          </Table>
        ) : null}
      </section>

      <section>
        <AdminPageHeader title="Начинки" />
        <StateBlock loading={fillings.loading} error={fillings.error} />
        {fillings.data ? (
          <Table headers={["Название", "Описание", "Цена за кг", "Доступна"]}>
            {fillings.data.map((filling) => (
              <Row key={filling.id}>
                <Cell>{filling.name}</Cell>
                <Cell>
                  <span className="text-xs text-ink-muted">{filling.description}</span>
                </Cell>
                <Cell>{formatPrice(filling.price_per_kg)}</Cell>
                <Cell>{filling.is_available ? "да" : "нет"}</Cell>
              </Row>
            ))}
          </Table>
        ) : null}
      </section>
    </div>
  );
}
