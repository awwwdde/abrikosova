"use client";

/**
 * Заголовок, строки которого выезжают из-под маски (решение заказчика, 004d).
 *
 * Строки считает браузер, а не мы: текст раскладывается в невидимом клоне той же
 * ширины и с теми же классами, и слова с одинаковым верхом собираются в строку.
 * Считается после загрузки шрифтов (`document.fonts.ready` — иначе строки по
 * запасному шрифту) и заново при каждом изменении ширины (ResizeObserver), так что
 * на 1920 и 1024 маска режет по настоящим строкам. Каждая строка — блок той же
 * высоты, что строка текста, поэтому раскладка не меняется (CLS = 0).
 *
 * Скринридер читает заголовок одной фразой: полный текст — в `sr-only`, строки
 * скрыты от него (`aria-hidden`).
 */

import { useEffect, useLayoutEffect, useRef, useState, type ElementType } from "react";
import { typograf } from "@/lib/format";
import { MOTION, onReveal, tween } from "@/lib/motion";

/**
 * Раскладывает `text` по строкам так, как его разложил бы `element` без разбиения.
 *
 * Меряется клон с обычным текстом, поставленный в поток на место заголовка (сам
 * заголовок на это время `display: none`): так клон получает ту же доступную ширину,
 * что и неразбитый заголовок, — в том числе во flex/grid, где ширина задаётся
 * содержимым. Мерить сам разбитый заголовок нельзя: его ширину уже задают готовые
 * строки, и ошибка закрепляется (004e). Всё синхронно, до отрисовки — на экране
 * клона не видно и сдвига раскладки нет.
 */
function measureLines(element: HTMLElement, text: string): string[] {
  const probe = element.cloneNode(false) as HTMLElement;
  probe.removeAttribute("id");
  probe.removeAttribute("data-split");
  probe.setAttribute("aria-hidden", "true");
  probe.style.visibility = "hidden";
  probe.textContent = text;
  const display = element.style.display;
  element.style.display = "none";
  element.after(probe);

  const node = probe.firstChild as Text;
  const range = document.createRange();
  const lines: string[] = [];
  let line = "";
  let lastTop: number | null = null;
  for (const match of text.matchAll(/\S+\s*/g)) {
    const start = match.index ?? 0;
    range.setStart(node, start);
    range.setEnd(node, start + match[0].trimEnd().length);
    const top = range.getClientRects()[0]?.top ?? 0;
    if (lastTop !== null && Math.abs(top - lastTop) > 2) {
      lines.push(line.trimEnd());
      line = "";
    }
    line += match[0];
    lastTop = top;
  }
  lines.push(line.trimEnd());
  probe.remove();
  element.style.display = display;
  return lines;
}

export function RevealText({
  as: Tag = "h2",
  children: raw,
  className = "",
  delay = 0,
  id,
  preserveSpaces = false,
}: {
  as?: ElementType;
  /** Только строка: разбиваем текст, а не разметку */
  children: string;
  className?: string;
  /** Задержка старта, с */
  delay?: number;
  id?: string;
  /** Для заголовков, где макет допускает перенос после короткого предлога. */
  preserveSpaces?: boolean;
}) {
  // Типографика до разбиения: неразрывные пробелы после коротких слов держат их
  // в одной строке со следующим словом, и замер строк это учитывает
  const text = preserveSpaces ? raw : typograf(raw);
  const ref = useRef<HTMLElement>(null);
  const [lines, setLines] = useState<string[] | null>(null);

  // Строки — после шрифтов и заново при любом изменении размеров вокруг: своих
  // (кегль на брейкпоинте), родителя и окна. Размер самого заголовка во flex может
  // не меняться — его задают уже готовые строки, — поэтому следим и за родителем.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    let current = "";
    let cancelled = false;
    let nearViewport = false;
    let frame = 0;
    const split = () => {
      if (cancelled || !nearViewport || element.offsetParent === null) return;
      const next = measureLines(element, text);
      const key = next.join("\n");
      if (key === current) return;
      current = key;
      setLines(next);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(split);
    };
    const observer = new ResizeObserver(schedule);
    // Далёкие заголовки остаются обычным SSR-текстом. Клоны для измерения
    // строк не заставляют пересчитывать всю страницу во время её гидрации.
    const viewport = new IntersectionObserver(
      ([entry]) => {
        nearViewport = Boolean(entry?.isIntersecting);
        if (nearViewport) schedule();
      },
      { rootMargin: "320px 0px" },
    );
    // Наблюдение — только после шрифтов: строки по запасному шрифту были бы неверны
    document.fonts.ready.then(() => {
      if (cancelled) return;
      viewport.observe(element);
      observer.observe(element);
      if (element.parentElement) observer.observe(element.parentElement);
      window.addEventListener("resize", schedule);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      viewport.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [text]);

  useEffect(() => {
    const element = ref.current;
    if (!element || !lines) return;
    // В первом экране строки не уходят под маску (009): короткий сдвиг на треть
    // строки — текст виден всё время, LCP не ждёт анимацию
    return onReveal(element, (el, firstScreen) =>
      Array.from(el.querySelectorAll(".reveal-line")).map((line, index) =>
        tween(
          line,
          { transform: [firstScreen ? "translateY(30%)" : "translateY(110%)", "translateY(0%)"] },
          MOTION.heading.duration,
          delay + index * MOTION.heading.lineStep,
        ),
      ),
    );
  }, [lines, delay]);

  return (
    <Tag
      ref={ref}
      id={id}
      data-reveal="text"
      data-split={lines ? "" : undefined}
      // min-w-0 и max-w-full: заголовок не раздувает flex/grid-родителя, и ширина,
      // по которой меряются строки, — та, что блок получил бы без разбиения
      className={`min-w-0 max-w-full ${className}`}
    >
      {lines ? (
        <>
          <span className="sr-only">{text}</span>
          {lines.map((line, index) => (
            <span key={`${index}-${line}`} aria-hidden="true" className="reveal-mask">
              <span className="reveal-line">{line}</span>
            </span>
          ))}
        </>
      ) : (
        text
      )}
    </Tag>
  );
}
