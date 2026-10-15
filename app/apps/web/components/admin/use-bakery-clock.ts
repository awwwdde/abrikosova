"use client";

/**
 * Часы кондитерской (011g): «сегодня» и часовой пояс из `GET /admin/clock`.
 * Пояс задаётся на бэкенде (`BUSINESS_TIMEZONE`); админка форматирует даты в нём,
 * а не в поясе браузера — копия «в 3:00» должна быть в 3:00 и в поездке.
 */

import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import type { BusinessClock } from "@/lib/api";

export function useBakeryClock(): BusinessClock | null {
  const { authFetch } = useAdminAuth();
  const [clock, setClock] = useState<BusinessClock | null>(null);

  useEffect(() => {
    authFetch<BusinessClock>("/admin/clock")
      .then(setClock)
      .catch(() => setClock(null));
  }, [authFetch]);

  return clock;
}

/** Формат даты и времени в поясе кондитерской; пока пояс не пришёл — null. */
export function useBakeryDateTime(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat | null {
  const clock = useBakeryClock();
  const key = JSON.stringify(options);
  return useMemo(
    () =>
      clock
        ? new Intl.DateTimeFormat("ru-RU", { ...JSON.parse(key), timeZone: clock.timezone })
        : null,
    [clock, key],
  );
}
