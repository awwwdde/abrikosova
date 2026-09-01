"use client";

import { AdminPageHeader } from "@/components/admin/data-table";

export default function AdminBackupsPage() {
  return (
    <div>
      <AdminPageHeader title="Резервные копии" />
      <div className="max-w-xl rounded border border-dashed border-line-strong bg-surface-sunken p-4 text-sm text-ink-muted">
        <p className="font-semibold text-ink">Раздел в разработке</p>
        <p className="mt-2">
          Здесь появятся список копий, кнопка создания копии вручную и восстановление из выбранной
          копии. Планируется плановый pg_dump с выгрузкой в объектное хранилище.
        </p>
        <p className="mt-2 text-xs">
          Раздел доступен только владельцу — у менеджера он скрыт и закрыт на бэкенде.
        </p>
      </div>
    </div>
  );
}
