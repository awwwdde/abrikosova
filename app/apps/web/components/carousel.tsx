"use client";

/**
 * Карусель витрины и работ по макету: горизонтальный ряд карточек, крайняя
 * обрезана правым краем окна, стрелки в заголовке секции.
 *
 * Реализация — нативная прокрутка + CSS scroll-snap, JS только считает,
 * можно ли листать дальше, и прокручивает на ширину видимых карточек.
 * Поэтому свайп на тач-экранах, горизонтальная прокрутка тачпадом и
 * колёсиком с Shift работают без библиотек — это поведение браузера.
 * Мышью ленту можно тянуть, зажав кнопку (`useDragScroll`).
 */

import Link from "@/components/page-transition";
import {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
  type ReactNode,
} from "react";
import { useRevealGroup } from "@/components/motion";
import { ArrowButton, SectionHeader } from "@/components/ui";
import { MOTION } from "@/lib/motion";
import { pluralRu } from "@/lib/format";
import { typograf } from "@/lib/format";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useCarousel() {
  const trackRef = useRef<HTMLUListElement>(null);
  // До первого замера — «в начале ленты»: так она выглядит в подавляющем большинстве
  // случаев, и «Вперёд» не мигает неактивной на медленном устройстве. Если листать
  // некуда, первый же замер её отключит
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    // Допуск в 2px: дробные ширины дают остаток при прокрутке до конца
    setEdges({
      start: track.scrollLeft <= 2,
      end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 2,
    });
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    update();
    track.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(track);
    return () => {
      track.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [update]);

  /**
   * Шаг — карточки, целиком видимые в контейнере страницы (без выхода за край
   * окна). На 1512 это 4 товара или 3 работы — ровно «страница» ряда.
   */
  const step = useCallback((direction: 1 | -1, whole = true) => {
    const track = trackRef.current;
    const first = track?.firstElementChild as HTMLElement | null;
    if (!track || !first) return;
    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
    const itemWidth = first.getBoundingClientRect().width + gap;
    const visible = track.parentElement?.clientWidth ?? track.clientWidth;
    const count = whole ? Math.max(1, Math.floor((visible + gap) / itemWidth)) : 1;
    track.scrollBy({
      left: direction * count * itemWidth,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, []);

  return { trackRef, atStart: edges.start, atEnd: edges.end, step };
}

/** Порог в пикселях: меньше — это клик по карточке, а не перетаскивание. */
const DRAG_THRESHOLD = 5;

/**
 * Перетаскивание ленты мышью: зажал и потянул — лента едет за курсором,
 * отпустил — доезжает до ближайшей карточки. Тач-экраны не трогаем: там
 * работает нативный свайп, и он лучше любой эмуляции.
 *
 * Пока тянем, scroll-snap выключен — иначе браузер на каждом шаге тянет
 * ленту к ближайшей точке привязки, и она дёргается. Клик, которым закончилось
 * перетаскивание, гасится: иначе отпускание кнопки над карточкой открывало бы товар.
 */
function useDragScroll(trackRef: RefObject<HTMLUListElement | null>) {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let pointerId: number | null = null;
    let startX = 0;
    let startScroll = 0;
    let lastX = 0;
    let lastTime = 0;
    let velocity = 0; // px/мс, знак — направление движения курсора
    let moved = false;

    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      pointerId = event.pointerId;
      startX = lastX = event.clientX;
      startScroll = track.scrollLeft;
      lastTime = performance.now();
      velocity = 0;
      moved = false;
    };

    const onMove = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return;
      const dx = event.clientX - startX;
      if (!moved) {
        if (Math.abs(dx) < DRAG_THRESHOLD) return;
        moved = true;
        track.setPointerCapture(event.pointerId);
        track.style.scrollSnapType = "none";
        track.style.scrollBehavior = "auto";
        setDragging(true);
      }
      const now = performance.now();
      velocity = (event.clientX - lastX) / Math.max(now - lastTime, 1);
      lastX = event.clientX;
      lastTime = now;
      track.scrollLeft = startScroll - dx;
    };

    const onUp = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return;
      pointerId = null;
      if (!moved) return;
      setDragging(false);

      // Доводка до карточки: ближайшая по положению, а при быстром броске —
      // следующая в сторону броска, чтобы лента не «отпрыгивала» назад
      const first = track.firstElementChild as HTMLElement | null;
      const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
      const item = first ? first.getBoundingClientRect().width + gap : 0;
      track.style.scrollSnapType = "";
      track.style.scrollBehavior = "";
      if (item > 0) {
        let index = track.scrollLeft / item;
        if (velocity < -0.3) index = Math.ceil(index);
        else if (velocity > 0.3) index = Math.floor(index);
        else index = Math.round(index);
        track.scrollTo({
          left: index * item,
          behavior: prefersReducedMotion() ? "auto" : "smooth",
        });
      }

      // Гасим клик, который браузер пришлёт сразу после отпускания
      const swallow = (click: MouseEvent) => {
        click.preventDefault();
        click.stopPropagation();
      };
      track.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => track.removeEventListener("click", swallow, { capture: true }), 0);
    };

    // Картинки и ссылки браузер умеет таскать сам — это мешало бы перетаскиванию
    const onDragStart = (event: DragEvent) => event.preventDefault();

    track.addEventListener("pointerdown", onDown);
    track.addEventListener("pointermove", onMove);
    track.addEventListener("pointerup", onUp);
    track.addEventListener("pointercancel", onUp);
    track.addEventListener("dragstart", onDragStart);
    return () => {
      track.removeEventListener("pointerdown", onDown);
      track.removeEventListener("pointermove", onMove);
      track.removeEventListener("pointerup", onUp);
      track.removeEventListener("pointercancel", onUp);
      track.removeEventListener("dragstart", onDragStart);
    };
  }, [trackRef]);

  return dragging;
}

export function Carousel({
  title,
  subtitle,
  action,
  label,
  itemClassName,
  subtitleGap,
  headerGap,
  align = "stretch",
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** Отступ заголовок → подзаголовок (на макете у секций главной разный) */
  subtitleGap?: string;
  /** Отступ заголовка секции до ленты (по умолчанию 63px, как на главной) */
  headerGap?: string;
  /** Подпись для скринридера, по умолчанию — заголовок секции */
  label?: string;
  /** Ширина карточки: w-[336px] для витрины, w-[456px] для работ (на 1512) */
  itemClassName: string;
  /**
   * `stretch` — карточки ленты одной высоты по самой высокой: у товаров цены
   * должны стоять в ряд. `start` — естественная высота: у работ выравнивать
   * по низу нечего, а название в две строки иначе растягивало бы всю секцию.
   */
  align?: "stretch" | "start";
  children: ReactNode;
}) {
  const { trackRef, atStart, atEnd, step } = useCarousel();
  const dragging = useDragScroll(trackRef);
  // Карточки первого экрана появляются лесенкой, один раз при входе ленты в экран
  useRevealGroup(trackRef, MOTION.text.afterHeading);

  function onKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1, false);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1, false);
    }
  }

  return (
    <section aria-roledescription="карусель" aria-label={label ?? title}>
      <SectionHeader
        title={title}
        subtitle={subtitle}
        subtitleGap={subtitleGap}
        bottomGap={headerGap}
        action={action}
        controls={
          <>
            <ArrowButton direction="prev" disabled={atStart} onClick={() => step(-1)} />
            <ArrowButton direction="next" disabled={atEnd} onClick={() => step(1)} />
          </>
        }
      />
      {/* Правый край ленты уходит до края окна: margin-right = −(поле страницы) */}
      <div>
        <ul
          ref={trackRef}
          data-reveal="group"
          tabIndex={0}
          onKeyDown={onKeyDown}
          className={`scrollbar-none -mr-[calc(50vw-50%)] -mb-[3px] flex ${align === "start" ? "items-start" : ""} snap-x snap-mandatory gap-6 pb-[3px] overflow-x-auto overscroll-x-contain focus-visible:outline-offset-4 ${
            // Во время перетаскивания — «хватающая рука» и над ссылками и кнопками
            // карточек, иначе курсор мигал бы указателем
            dragging ? "cursor-grabbing select-none [&_*]:cursor-grabbing" : "cursor-grab"
          }`}
        >
          {Children.map(children, (child) => (
            <li className={`shrink-0 snap-start ${itemClassName}`}>{child}</li>
          ))}
          {/* Хвост, чтобы последняя карточка могла доехать до левого края контейнера */}
          <li aria-hidden="true" className="w-px shrink-0" />
        </ul>
      </div>
    </section>
  );
}

/**
 * Плитка-концовка карусели работ: бордо «{typograf("Смотреть все работы")}», в hover —
 * тёмный бордо и «Все N работ» крупнее. Размер как у карточки работы (4:5).
 */
export function EndTile({
  href,
  total,
  forceState,
}: {
  href: string;
  total: number;
  forceState?: "hover";
}) {
  const hovered = forceState === "hover";
  const worksWord = pluralRu(total, ["работа", "работы", "работ"]);
  return (
    <Link
      href={href}
      className={`group/tile relative flex aspect-[4/5] items-center justify-center rounded-sm text-on-accent transition-colors duration-200 ease-out-soft ${
        hovered ? "bg-accent-pressed" : "bg-accent hover:bg-accent-pressed"
      }`}
    >
      <span
        className={`font-display text-[2.375rem] leading-none transition-opacity duration-200 ${
          hovered ? "opacity-0" : "group-hover/tile:opacity-0 group-focus-visible/tile:opacity-0"
        }`}
      >
        Смотреть все работы
      </span>
      <span
        aria-hidden={!hovered}
        className={`absolute font-display text-[3rem] leading-none transition-opacity duration-200 ${
          hovered
            ? "opacity-100"
            : "opacity-0 group-hover/tile:opacity-100 group-focus-visible/tile:opacity-100"
        }`}
      >
        {typograf(`Все ${total} ${worksWord}`)}
      </span>
    </Link>
  );
}
