"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";

const EASE = "cubic-bezier(0.2, 0, 0, 1)";
const locks = new Set<symbol>();
let previousOverflow = "";

function lockScroll() {
  const token = Symbol();
  if (locks.size === 0) {
    previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
  }
  locks.add(token);
  return () => {
    if (!locks.delete(token) || locks.size > 0) return;
    document.documentElement.style.overflow = previousOverflow;
  };
}

/** Нативная фокус-ловушка и блокировка остаются до конца exit, включая Esc. */
export function useDialogMotion(
  ref: RefObject<HTMLDialogElement | null>,
  open: boolean,
  kind: "drawer" | "confirm",
) {
  const release = useRef<(() => void) | null>(null);
  const interrupted = useRef<{ opacity: string; transform: string } | null>(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    let cancelled = false;
    let animation: Animation | undefined;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const close = () => {
      dialog.close();
      release.current?.();
      release.current = null;
      interrupted.current = null;
      delete dialog.dataset.motionState;
    };
    if (open) {
      const from = dialog.open ? interrupted.current : null;
      interrupted.current = null;
      if (!dialog.open) {
        dialog.showModal();
        release.current = lockScroll();
      }
      dialog.dataset.motionState = "open";
      if (!preference.matches) {
        animation = dialog.animate(
          [
            from ?? {
              opacity: kind === "drawer" ? 1 : 0,
              transform: kind === "drawer" ? "translateX(-100%)" : "translateY(6px) scale(0.98)",
            },
            { opacity: 1, transform: "none" },
          ],
          { duration: kind === "drawer" ? 260 : 180, easing: EASE },
        );
      }
    } else if (dialog.open) {
      const from = interrupted.current;
      interrupted.current = null;
      dialog.dataset.motionState = "closing";
      if (preference.matches || dialog.getClientRects().length === 0) {
        close();
      } else {
        animation = dialog.animate(
          [
            from ?? { opacity: 1, transform: "none" },
            {
              opacity: kind === "drawer" ? 1 : 0,
              transform: kind === "drawer" ? "translateX(-100%)" : "translateY(4px) scale(0.98)",
            },
          ],
          { duration: 180, easing: EASE, fill: "forwards" },
        );
        void animation.finished
          .then(() => {
            if (!cancelled) close();
          })
          .catch(() => {});
      }
    }
    const finish = () => {
      if (preference.matches) animation?.finish();
    };
    preference.addEventListener("change", finish);
    return () => {
      cancelled = true;
      preference.removeEventListener("change", finish);
      if (animation && dialog.open) {
        const style = getComputedStyle(dialog);
        interrupted.current = { opacity: style.opacity, transform: style.transform };
      }
      animation?.cancel();
    };
  }, [kind, open, ref]);

  useEffect(
    () => () => {
      ref.current?.close();
      release.current?.();
      release.current = null;
    },
    [ref],
  );
}

/** Меняется только прозрачность: fixed-панели редакторов не получают нового предка. */
export function AdminPageMotion({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const previous = useRef(pathname);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches) return;
    const animation = ref.current?.animate([{ opacity: 0.35 }, { opacity: 1 }], {
      duration: 220,
      easing: EASE,
    });
    const finish = () => {
      if (preference.matches) animation?.finish();
    };
    preference.addEventListener("change", finish);
    return () => {
      animation?.cancel();
      preference.removeEventListener("change", finish);
    };
  }, [pathname]);
  return (
    <div ref={ref} data-admin-page>
      {children}
    </div>
  );
}
