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

import type Lenis from "lenis";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const LenisContext = createContext<Lenis | null>(null);

export function useLenis() {
  return useContext(LenisContext);
}

export function LenisProvider({ children }: { children: ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let instance: Lenis | null = null;
    let loading = false;
    let disposed = false;
    let generation = 0;

    // На телефоне остаётся нативная инерция. На ПК движок нужен при прокрутке,
    // а не при чтении первого экрана: до неё нет постоянного rAF и замеров страницы.
    const start = async (event: WheelEvent) => {
      if (event.ctrlKey || instance || loading || reduce.matches || !pointer.matches) return;
      loading = true;
      const version = ++generation;
      try {
        const { default: Lenis } = await import("lenis");
        if (disposed || version !== generation || reduce.matches || !pointer.matches) return;
        instance = new Lenis({ autoRaf: true });
        setLenis(instance);
      } catch {
        // При недоступном чанке браузер продолжает обычную прокрутку.
      } finally {
        loading = false;
      }
    };
    const stop = () => {
      generation++;
      instance?.destroy();
      instance = null;
      setLenis(null);
    };
    const onChange = () => {
      if (reduce.matches || !pointer.matches) stop();
    };
    window.addEventListener("wheel", start, { passive: true });
    reduce.addEventListener("change", onChange);
    pointer.addEventListener("change", onChange);
    return () => {
      disposed = true;
      window.removeEventListener("wheel", start);
      reduce.removeEventListener("change", onChange);
      pointer.removeEventListener("change", onChange);
      stop();
    };
  }, []);

  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>;
}
