"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLenis } from "@/components/lenis-provider";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  type ComponentProps,
  type ReactNode,
} from "react";

type Navigate = (href: string, options: { replace?: boolean; scroll?: boolean }) => void;
const NavigationContext = createContext<Navigate | null>(null);

/** Внешние адреса и админка используют обычный Next Link. */
function pageDestination(href: ComponentProps<typeof Link>["href"]): string | null {
  if (typeof href !== "string") return null;
  const destination = new URL(href, window.location.href);
  if (
    destination.origin !== window.location.origin ||
    /^\/admin(?:\/|$)/.test(destination.pathname)
  ) {
    return null;
  }
  return destination.pathname + destination.search + destination.hash;
}

/**
 * Старый экран остаётся на месте до готовности нового. Браузер смешивает два
 * снимка, поэтому между ними нет пустой кремовой страницы или прыжка футера.
 * Next Link по-прежнему отвечает за prefetch, модификаторы и обычную навигацию.
 */
export function PageTransitions({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const lenis = useLenis();
  const previous = useRef(pathname);
  const navigation = useRef(0);
  const pending = useRef<{
    finish: () => void;
    transition: ViewTransition;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const entry = useRef<Animation | null>(null);

  const stopInertia = useCallback(() => {
    if (!lenis) return;
    const wasStopped = lenis.isStopped;
    lenis.stop();
    lenis.resize();
    // Открытое меню сохраняет свою блокировку; позицию задаёт навигация Next.
    if (!wasStopped) lenis.start();
  }, [lenis]);

  const cancel = useCallback(() => {
    const active = pending.current;
    if (!active) return;
    pending.current = null;
    clearTimeout(active.timer);
    active.transition.skipTransition();
    active.finish();
    delete document.documentElement.dataset.pageTransition;
  }, []);

  const navigate = useCallback<Navigate>(
    (href, options) => {
      const version = ++navigation.current;
      cancel();
      const destination = new URL(href, window.location.href);
      // Инерция старой страницы не должна продолжаться после сброса scroll в Next.
      // Остановка не меняет текущую позицию старого снимка.
      if (destination.pathname !== window.location.pathname) stopInertia();
      const push = () =>
        options.replace ? router.replace(href, options) : router.push(href, options);
      // Меню уже плавно закрывается поверх нового экрана: второй снимок меню
      // заморозил бы его exit. Здесь достаточно появления контента под панелью.
      if (
        !document.startViewTransition ||
        // Параметры фильтра, якорь и окно заявки не заменяют саму страницу.
        destination.pathname === window.location.pathname ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        document.querySelector('#mobile-menu[role="dialog"], [id^="mega-"]')
      ) {
        push();
        return;
      }
      entry.current?.cancel();
      let finish!: () => void;
      const committed = new Promise<void>((resolve) => {
        finish = resolve;
      });
      document.documentElement.dataset.pageTransition = "";
      const transition = document.startViewTransition(() => {
        // Более поздний клик или Back важнее отложенного callback снимка.
        if (navigation.current === version) push();
        return committed;
      });
      const active = {
        finish,
        transition,
        // Медленный API не должен надолго блокировать старую страницу снимком.
        // Навигация продолжается обычным способом после отмены только анимации.
        timer: setTimeout(cancel, 1800),
      };
      pending.current = active;
      void transition.ready.catch(() => {});
      void transition.finished
        .catch(() => {})
        .then(() => {
          if (pending.current !== active) return;
          clearTimeout(active.timer);
          pending.current = null;
          delete document.documentElement.dataset.pageTransition;
        });
    },
    [cancel, router, stopInertia],
  );

  useLayoutEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    // В том числе для router.push вне TransitionLink: принимаем позицию Next
    // (верх, якорь или сохранённую в истории), обнуляя прежнюю скорость Lenis.
    stopInertia();
    const active = pending.current;
    if (active) {
      // Next восстанавливает прокрутку в layout-фазе. Снимок нового экрана —
      // только после неё, иначе в переход попадёт прежняя позиция прокрутки.
      clearTimeout(active.timer);
      active.finish();
      return;
    }
    entry.current?.cancel();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Также работает для router.push из оформления и возврата по истории.
    const main = document.querySelector(".public-site > main");
    entry.current =
      main?.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 280,
        easing: "cubic-bezier(0.2, 0, 0, 1)",
      }) ?? null;
  }, [pathname, stopInertia]);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stop = () => {
      if (!preference.matches) return;
      cancel();
      entry.current?.cancel();
    };
    const onHistory = () => {
      navigation.current++;
      cancel();
      stopInertia();
    };
    preference.addEventListener("change", stop);
    // Быстрый возврат по истории отменяет предыдущий снимок, но не навигацию.
    window.addEventListener("popstate", onHistory);
    return () => {
      preference.removeEventListener("change", stop);
      window.removeEventListener("popstate", onHistory);
      onHistory();
      entry.current?.cancel();
    };
  }, [cancel, stopInertia]);

  return <NavigationContext.Provider value={navigate}>{children}</NavigationContext.Provider>;
}

export default function TransitionLink({
  href,
  onNavigate,
  replace,
  scroll,
  ...props
}: ComponentProps<typeof Link>) {
  const navigate = useContext(NavigationContext);
  return (
    <Link
      {...props}
      href={href}
      replace={replace}
      scroll={scroll}
      onNavigate={(event) => {
        let prevented = false;
        onNavigate?.({
          preventDefault() {
            prevented = true;
            event.preventDefault();
          },
        });
        if (prevented || !navigate) return;
        const destination = pageDestination(href);
        if (!destination) return;
        event.preventDefault();
        navigate(destination, { replace, scroll });
      }}
    />
  );
}
