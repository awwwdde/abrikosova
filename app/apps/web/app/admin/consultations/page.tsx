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
import { Select } from "@/components/ui";
import { CONSULTATION_STATUS_LABELS, SOURCE_LABELS, type Page } from "@/lib/api";

type RequestRow = {
  id: number;
  name: string;
  phone: string;
  description: string | null;
  source: string;
  status: string;
  consent_pd: boolean;
  consent_at: string | null;
  created_at: string;
};

const STATUSES = Object.keys(CONSULTATION_STATUS_LABELS);

export default function AdminConsultationsPage() {
  const { authFetch } = useAdminAuth();
  const [source, setSource] = useState("");
  const query = source ? `/admin/consultations?source=${source}` : "/admin/consultations";
  const { data, loading, error, reload } = useAdminData<Page<RequestRow>>(query);
  const [busy, setBusy] = useState<number | null>(null);

  async function changeStatus(id: number, status: string) {
    setBusy(id);
    try {
      await authFetch(`/admin/consultations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Заявки"
        action={
          <Select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            aria-label="Фильтр по источнику"
          >
            <option value="">Все источники</option>
            <option value="custom_cake">Торты на заказ</option>
            <option value="contact_page">Форма контактов</option>
          </Select>
        }
      />
      <StateBlock loading={loading} error={error} />

      {data && data.items.length === 0 ? (
        <p className="text-sm text-ink-subtle">Заявок нет</p>
      ) : null}

      {data && data.items.length > 0 ? (
        <Table headers={["Клиент", "Источник", "Сообщение", "Согласие", "Статус", "Создана"]}>
          {data.items.map((row) => (
            <Row key={row.id}>
              <Cell>
                <div>{row.name}</div>
                <div className="text-xs text-ink-subtle">{row.phone}</div>
              </Cell>
              <Cell>{SOURCE_LABELS[row.source] ?? row.source}</Cell>
              <Cell>
                <span className="text-xs text-ink-muted">{row.description ?? "—"}</span>
              </Cell>
              <Cell>
                {/* Подтверждение согласия на обработку ПДн — доказательство по 152-ФЗ */}
                <span className="text-xs text-ink-muted">
                  {row.consent_pd ? "да" : "нет"}
                  {row.consent_at ? (
                    <>
                      <br />
                      {new Date(row.consent_at).toLocaleString("ru-RU")}
                    </>
                  ) : null}
                </span>
              </Cell>
              <Cell>
                <Select
                  value={row.status}
                  disabled={busy === row.id}
                  onChange={(e) => void changeStatus(row.id, e.target.value)}
                  aria-label={`Статус заявки ${row.id}`}
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {CONSULTATION_STATUS_LABELS[status]}
                    </option>
                  ))}
                </Select>
              </Cell>
              <Cell>
                <span className="text-xs text-ink-subtle">
                  {new Date(row.created_at).toLocaleString("ru-RU")}
                </span>
              </Cell>
            </Row>
          ))}
        </Table>
      ) : null}
    </div>
  );
}
