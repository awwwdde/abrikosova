"use client";

/**
 * Плавный скролл Lenis для публичной части сайта.
 *
 * Не запускается при `prefers-reduced-motion: reduce` — человеку, которого
 * укачивает от анимаций, остаётся обычная прокрутка браузера. В админке
 * Lenis не нужен: там таблицы и формы, инерция мешает.
 *
 * Экземпляр доступен через `useLenis()`: выезжающее меню останавливает
 * прокрутку страницы, пока открыто.
 */

import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const LenisContext = createContext<Lenis | null>(null);

export function useLenis() {
  return useContext(LenisContext);
}

export function LenisProvider({ children }: { children: ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let instance: Lenis | null = null;

    const start = () => {
      instance = new Lenis({ autoRaf: true });
      setLenis(instance);
    };
    const stop = () => {
      instance?.destroy();
      instance = null;
      setLenis(null);
    };

    if (!reduce.matches) start();
    // Настройку можно поменять, не перезагружая страницу
    const onChange = () => (reduce.matches ? stop() : start());
    reduce.addEventListener("change", onChange);
    return () => {
      reduce.removeEventListener("change", onChange);
      stop();
    };
  }, []);

  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>;
}
