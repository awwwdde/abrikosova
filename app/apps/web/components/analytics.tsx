"use client";

/**
 * Яндекс.Метрика и плашка о cookie (задание 012). Только публичная часть: компонент
 * стоит в PublicShell, в админке и на странице входа его нет.
 *
 * - Без ID счётчика (NEXT_PUBLIC_YANDEX_METRIKA_ID) — ни плашки, ни скрипта.
 * - Счётчик грузится после «Понятно» (решение по умолчанию; «сразу» — вопрос
 *   заказчику в README). Согласие — cookie на год.
 * - `defer: true` и `hit` на каждый переход: App Router меняет страницы без
 *   перезагрузки, и без этого Метрика видела бы только первую. Первый hit тоже
 *   наш — так первая страница не считается дважды.
 * - Цели «Нажал на телефон» и «Перешёл в Telegram» — один обработчик кликов на
 *   документе: ссылки разбросаны по шапке, подвалу и страницам.
 */

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";
import { Suspense, useEffect, useState } from "react";
import {
  CONSENT_COOKIE,
  goalForHref,
  hasConsent,
  METRIKA_ID,
  reachGoal,
  WEBVISOR,
} from "@/lib/metrika";

type Ym = ((id: number, method: string, ...args: unknown[]) => void) & {
  a?: unknown[][];
  l?: number;
};

function ym(...args: [string, ...unknown[]]) {
  (window as unknown as { ym?: Ym }).ym?.(Number(METRIKA_ID), ...args);
}

/** Hit на каждый переход App Router (адрес с параметрами — как видит посетитель). */
function PageHits() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    ym("hit", `${window.location.origin}${pathname}${search ? `?${search}` : ""}`, {
      title: document.title,
      referer: document.referrer,
    });
  }, [pathname, search]);
  return null;
}

function Counter() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Очередь вызовов, как в стандартном загрузчике: init и hit копятся, пока
    // tag.js грузится. init — первым, поэтому hit-ы рендерятся только после него
    const w = window as unknown as { ym?: Ym };
    if (!w.ym) {
      const stub: Ym = (...args: unknown[]) => {
        (stub.a ??= []).push(args);
      };
      stub.l = Date.now();
      w.ym = stub;
    }
    ym("init", {
      defer: true,
      clickmap: true,
      trackLinks: true,
      accurateTrackBounce: true,
      webvisor: WEBVISOR,
    });
    setReady(true);

    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a");
      const goal = goalForHref(link?.getAttribute("href") ?? null);
      if (goal) reachGoal(goal);
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return (
    <>
      <Script src="https://mc.yandex.ru/metrika/tag.js" strategy="afterInteractive" />
      {/* useSearchParams без Suspense переводит страницу в клиентский рендер */}
      {ready ? (
        <Suspense fallback={null}>
          <PageHits />
        </Suspense>
      ) : null}
    </>
  );
}

export function Analytics() {
  // null — ещё не прочитали cookie (до гидрации): ни плашки, ни счётчика,
  // чтобы плашка не мелькала у тех, кто уже согласился
  const [consent, setConsent] = useState<boolean | null>(null);

  useEffect(() => {
    setConsent(hasConsent(document.cookie));
  }, []);

  if (!METRIKA_ID || consent === null) return null;
  if (consent) return <Counter />;

  return (
    <div
      role="region"
      aria-label="Уведомление о cookie"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-canvas/95 backdrop-blur-sm"
    >
      <div className="container-page flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-muted">
          Сайт использует cookie и Яндекс.Метрику для статистики. Подробнее — в{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">
            политике конфиденциальности
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={() => {
            document.cookie = `${CONSENT_COOKIE}=1; Max-Age=31536000; Path=/; SameSite=Lax`;
            setConsent(true);
          }}
          className="inline-flex min-h-10 shrink-0 items-center justify-center bg-accent px-5 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Понятно
        </button>
      </div>
    </div>
  );
}
