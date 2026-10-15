"use client";

/**
 * Обёртки появления при прокрутке (задание 004d). Секции остаются серверными
 * и передают разметку через children; тайминги — lib/motion.ts, начальное
 * скрытое состояние — CSS (globals.css, «Появление»).
 *
 * - `Reveal` — блок целиком: opacity 0→1 и сдвиг на 16px вверх;
 * - `RevealImage` — фото раскрывается маской снизу вверх, внутри лёгкий зум;
 * - `RevealGroup` — лесенка прямых детей; видимые сейчас идут по очереди,
 *   остальные (например, за краем карусели) показываются сразу;
 * - `RevealLine` — линия прорисовывается слева направо.
 */

import {
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type ElementType,
  type RefObject,
} from "react";
import { MOTION, onReveal, staggerDelay, tween } from "@/lib/motion";
import { typografNode } from "@/lib/typograf-node";

const FADE_IN = {
  opacity: [0, 1],
  transform: [`translateY(${MOTION.text.distance}px)`, "translateY(0px)"],
};

/** Первый экран (009): только сдвиг — элемент виден с первой отрисовки. */
const SHIFT_IN = {
  transform: [`translateY(${MOTION.text.distance}px)`, "translateY(0px)"],
};

type OwnProps<T extends ElementType> = { as?: T; delay?: number } & Omit<
  ComponentPropsWithoutRef<T>,
  "as"
>;

export function Reveal<T extends ElementType = "div">({
  as,
  delay = MOTION.text.afterHeading,
  children,
  ...props
}: OwnProps<T>) {
  const Tag: ElementType = as ?? "div";
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    return onReveal(ref.current, (el, firstScreen) => [
      tween(el, firstScreen ? SHIFT_IN : FADE_IN, MOTION.text.duration, delay),
    ]);
  }, [delay]);
  // Строки среди прямых детей — через типографику (неразрывные пробелы)
  return (
    <Tag ref={ref} data-reveal="fade" {...props}>
      {typografNode(children)}
    </Tag>
  );
}

/**
 * Фото: `className` — у рамки (размер, пропорции, подложка), children — картинки;
 * они лежат в слое на всю рамку, который и масштабируется.
 */
export function RevealImage({
  className = "",
  children,
  delay = 0,
}: {
  className?: string;
  children: React.ReactNode;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const element = ref.current;
    return onReveal(
      element,
      (el, firstScreen) => {
        const zoom = el.querySelector("[data-reveal-zoom]");
        const { duration, scaleFrom } = MOTION.image;
        return [
          // В первом экране фото не закрываем маской — только лёгкий зум внутри
          ...(firstScreen
            ? []
            : [
                tween(
                  el,
                  { clipPath: ["inset(100% 0% 0% 0%)", "inset(0% 0% 0% 0%)"] },
                  duration,
                  delay,
                ),
              ]),
          ...(zoom
            ? [tween(zoom, { transform: [`scale(${scaleFrom})`, "scale(1)"] }, duration, delay)]
            : []),
        ];
      },
      element.parentElement ?? element,
    );
  }, [delay]);
  return (
    <div ref={ref} data-reveal="image" className={className}>
      <div data-reveal-zoom className="absolute inset-0">
        {children}
      </div>
    </div>
  );
}

/**
 * Лесенка для прямых детей элемента `ref`. Отдельным хуком — для мест, где
 * список рисует чужой компонент (лента карусели).
 */
export function useRevealGroup(ref: RefObject<HTMLElement | null>, delay = 0) {
  useEffect(() => {
    if (!ref.current) return;
    return onReveal(ref.current, (el, firstScreen) => {
      const items = Array.from(el.children) as HTMLElement[];
      // Лесенкой — только то, что сейчас в экране по горизонтали: карточки за краем
      // карусели показываем сразу, иначе при перетаскивании они «проявлялись» бы по одной
      const visible = items.filter((item) => {
        const rect = item.getBoundingClientRect();
        return rect.width > 0 && rect.left < window.innerWidth && rect.right > 0;
      });
      for (const item of items) {
        if (!visible.includes(item)) {
          item.style.opacity = "1";
          item.style.transform = "none";
        }
      }
      return visible.map((item, index) =>
        tween(
          item,
          firstScreen ? SHIFT_IN : FADE_IN,
          MOTION.text.duration,
          staggerDelay(index, delay),
        ),
      );
    });
  }, [ref, delay]);
}

export function RevealGroup<T extends ElementType = "div">({
  as,
  delay = 0,
  ...props
}: OwnProps<T>) {
  const Tag: ElementType = as ?? "div";
  const ref = useRef<HTMLElement>(null);
  useRevealGroup(ref, delay);
  return <Tag ref={ref} data-reveal="group" {...props} />;
}

export function RevealLine({ className = "", delay = 0 }: { className?: string; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    // Линия в первом экране уже нарисована — второй раз не рисуем
    return onReveal(ref.current, (el, firstScreen) =>
      firstScreen
        ? []
        : [tween(el, { transform: ["scaleX(0)", "scaleX(1)"] }, MOTION.line.duration, delay)],
    );
  }, [delay]);
  return <span ref={ref} aria-hidden="true" data-reveal="line" className={`block ${className}`} />;
}
