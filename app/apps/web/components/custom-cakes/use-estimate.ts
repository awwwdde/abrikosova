"use client";

/**
 * Ориентир «вес · ярусы · от X ₽» для калькулятора (008b), страницы дизайна и окна
 * заявки (008c). Формулы на клиенте нет: единственный источник — `services/custom_cakes.py`,
 * сюда приходит ответ `GET /custom-cakes/estimate`.
 *
 * Запрос — через 300 мс после изменения, предыдущий отменяется. Ошибка API не стирает
 * прошлый результат: человек видит последнее посчитанное и строку ошибки. `initial` —
 * значение, посчитанное сервером при рендере (без мигания на первом экране).
 */

import { useEffect, useRef, useState } from "react";
import { ApiError, apiFetch, type CakeEstimate } from "@/lib/api";

export function useEstimate({
  guests,
  design,
  initial = null,
}: {
  /** null — число гостей сейчас неверное, не считаем */
  guests: number | null;
  /** slug дизайна: оформление дизайна; без него — классическое («Свой дизайн») */
  design?: string | null;
  initial?: CakeEstimate | null;
}) {
  const [result, setResult] = useState<CakeEstimate | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [counted, setCounted] = useState(() =>
    initial ? `${initial.guests}|${design ?? ""}` : null,
  );
  const controller = useRef<AbortController | null>(null);
  const key = guests ? `${guests}|${design ?? ""}` : null;

  useEffect(() => {
    if (!key || key === counted) return;
    const timer = window.setTimeout(() => {
      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;
      const query = new URLSearchParams({ guests: String(guests) });
      if (design) query.set("design", design);
      apiFetch<CakeEstimate>(`/custom-cakes/estimate?${query}`, { signal: current.signal })
        .then((next) => {
          setResult(next);
          setCounted(key);
          setError(null);
        })
        .catch((err: unknown) => {
          if (current.signal.aborted) return;
          setError(
            err instanceof ApiError && err.status < 500
              ? "Не получилось посчитать — проверьте число гостей"
              : "Не получилось посчитать, попробуйте ещё раз",
          );
        });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [key, counted, guests, design]);

  useEffect(() => () => controller.current?.abort(), []);

  return { result, error };
}

/** «6 кг», «6,5 кг» из строки API «6.5» */
export const formatKg = (value: string) => `${Number(value).toLocaleString("ru-RU")} кг`;
