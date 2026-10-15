"use client";

/**
 * Предупреждение об уходе с несохранёнными изменениями (011d).
 *
 * У App Router нет события «перед переходом», поэтому два перехвата:
 *   - `beforeunload` — закрытие вкладки, перезагрузка, адрес вручную (окно браузера);
 *   - клик по ссылке внутри сайта (меню, крошки, «назад») — ловим на document
 *     в фазе перехвата, до обработчика `next/link`, и спрашиваем своим диалогом.
 * Кнопка «Назад» браузера через историю этим не ловится — см. отчёт 011d.
 */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/admin/ui";

export function useUnsavedGuard(dirty: boolean) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Старые браузеры показывают окно, только если задан returnValue
      event.returnValue = "";
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search)
        return;
      event.preventDefault();
      event.stopPropagation();
      setPending(`${url.pathname}${url.search}${url.hash}`);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      title="Уйти без сохранения?"
      text="Изменения в карточке пропадут. Чтобы их не потерять, нажмите «Остаться» и сохраните."
      confirmLabel="Уйти"
      cancelLabel="Остаться"
      onConfirm={() => {
        const to = pending;
        setPending(null);
        if (to) router.push(to);
      }}
      onClose={() => setPending(null)}
    />
  );

  return { dialog };
}
