"use client";

/**
 * «Журнал» (011c, только владелец): лента действий целиком с фильтрами и вкладка
 * «Безопасность» — входы, блокировки, подозрения на кражу сессии с устройством и IP.
 * Тексты строит бэкенд (`services/journal.py`) — те же, что в ленте на главной.
 */

import { ClockCounterClockwise } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useAdminData } from "@/components/admin/use-admin-data";
import { ActivityTimeline } from "@/components/admin/dashboard/bottom";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Notice,
  Pagination,
  SegmentedTabs,
  Select,
  Skeleton,
} from "@/components/admin/ui";
import type { AdminUser, JournalPage } from "@/lib/api";
import { typograf } from "@/lib/format";

type Tab = "actions" | "security";

const PAGE_SIZE = 20;
const KINDS = [
  { value: "", label: "Все события" },
  { value: "catalog", label: "Каталог и витрина" },
  { value: "orders", label: "Заказы" },
  { value: "requests", label: "Заявки" },
  { value: "reviews", label: "Отзывы" },
  { value: "pages", label: "Страницы сайта" },
  { value: "staff", label: "Сотрудники" },
  { value: "system", label: "Настройки и копии" },
];

export default function AdminJournalPage() {
  const [tab, setTab] = useState<Tab>("actions");
  const [actor, setActor] = useState("");
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(1);
  const { data: staff } = useAdminData<AdminUser[]>("/admin/users");

  const params = new URLSearchParams({ tab, page: String(page), page_size: String(PAGE_SIZE) });
  if (actor) params.set("actor", actor);
  if (kind && tab === "actions") params.set("kind", kind);
  const { data, loading, error, reload } = useAdminData<JournalPage>(`/admin/journal?${params}`);

  // Новый фильтр — с первой страницы
  useEffect(() => setPage(1), [tab, actor, kind]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const now = new Date().toISOString();

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[34px] leading-[1.05] font-normal adm-sm:text-[42px]">
            Журнал
          </h1>
          <p className="text-[15px] text-admin-muted">
            {typograf("Кто, что и когда менял в админке, и что пришло с сайта")}
          </p>
        </div>
        <SegmentedTabs
          label="Раздел журнала"
          surface="card"
          value={tab}
          onChange={setTab}
          controls="journal-panel"
          options={[
            { value: "actions", label: "Действия" },
            { value: "security", label: "Безопасность" },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-5 adm-lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card aria-label="Фильтры" className="flex flex-col gap-4">
          <Field label="Кто">
            {(a11y) => (
              <Select {...a11y} value={actor} onChange={(event) => setActor(event.target.value)}>
                <option value="">Все</option>
                {tab === "actions" ? <option value="site">Сайт</option> : null}
                {(staff ?? []).map((person) => (
                  <option key={person.id} value={String(person.id)}>
                    {person.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {tab === "actions" ? (
            <Field label="Тип события">
              {(a11y) => (
                <Select {...a11y} value={kind} onChange={(event) => setKind(event.target.value)}>
                  {KINDS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : (
            <p className="text-[13px] leading-normal text-admin-muted">
              {typograf(
                "Входы и выходы, блокировки после 5 неудачных попыток и подозрения на кражу сессии.",
              )}
            </p>
          )}
          {data ? (
            <p className="text-[13px] text-admin-muted" aria-live="polite">
              Найдено: <b className="tabular-nums">{data.total}</b>
            </p>
          ) : null}
        </Card>

        <div id="journal-panel" role="tabpanel" className="flex flex-col gap-4">
          {error ? (
            <Notice
              role="alert"
              action={
                <Button variant="outline" size="sm" onClick={() => void reload()}>
                  Повторить
                </Button>
              }
            >
              {error}
            </Notice>
          ) : loading && !data ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2, 3].map((index) => (
                <Skeleton key={index} className="h-16" />
              ))}
            </div>
          ) : data && data.items.length > 0 ? (
            <>
              <div className={loading ? "opacity-60" : ""}>
                <ActivityTimeline items={data.items} now={now} when="full" />
              </div>
              <Pagination page={page} pages={pages} onChange={setPage} />
            </>
          ) : (
            <Card padding="sm">
              <EmptyState
                icon={<ClockCounterClockwise size={24} />}
                title="Записей нет"
                text={typograf("Попробуйте другой фильтр")}
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
