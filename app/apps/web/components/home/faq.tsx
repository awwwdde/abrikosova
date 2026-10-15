"use client";

/**
 * «Вопросы» по макету 1512.png: заголовок, подзаголовок и кнопка «Задать
 * вопрос», под ними аккордеон в две колонки с «+» / «−» справа. Все вопросы
 * изначально свёрнуты — решение заказчика 30.09 (на макете первый открыт).
 *
 * Колонки с вопросами — `FaqColumns`, его же берёт «Торты на заказ» (008b): там
 * первый вопрос раскрыт, как в кадре (`initiallyOpen`).
 *
 * Каждый вопрос — общий `Disclosure` (components/disclosure.tsx, тот же
 * аккордеон на странице товара): кнопка с `aria-expanded` внутри h3, ответ —
 * `region`, свёрнутый — `inert`, раскрытие — переход высоты без замера в JS.
 */

import { useState } from "react";
import { Disclosure, DisclosureIcon } from "@/components/disclosure";
import { Reveal, RevealGroup, RevealLine, RevealText } from "@/components/motion";
import { LinkButton } from "@/components/ui";
import type { FaqItem } from "@/lib/api";
import { MOTION } from "@/lib/motion";
import { typograf } from "@/lib/format";

function Question({
  item,
  open,
  onToggle,
  index,
  topLine,
  buttonClassName = "pt-[36px] pb-[16px]",
  answerClassName = "pb-[28px]",
}: {
  item: { question: string; answer: string };
  open: boolean;
  onToggle: () => void;
  /** Номер в колонке — для задержки прорисовки линии */
  index: number;
  /** Линия сверху: у первого вопроса колонки (во второй колонке — только с 1024) */
  topLine: "none" | "always" | "desktop";
  buttonClassName?: string;
  answerClassName?: string;
}) {
  return (
    // Разделители — линии, которые прорисовываются при появлении (RevealLine), а не
    // border; место под них держат pt-px/pb-px, поэтому раскладка та же, что с border
    <div
      className={`relative pb-px ${topLine === "always" ? "pt-px" : topLine === "desktop" ? "lg:pt-px" : ""}`}
    >
      {topLine !== "none" ? (
        <RevealLine
          className={`absolute inset-x-0 top-0 h-px bg-line ${topLine === "desktop" ? "max-lg:hidden" : ""}`}
        />
      ) : null}
      <RevealLine
        delay={Math.min(index + 1, MOTION.stagger.max) * MOTION.stagger.step}
        className="absolute inset-x-0 bottom-0 h-px bg-line"
      />
      <Disclosure
        title={
          <span className="font-display text-[1.375rem] leading-7 transition-colors group-hover:text-accent sm:text-[1.5rem]">
            {typograf(item.question)}
          </span>
        }
        open={open}
        onToggle={onToggle}
        buttonClassName={buttonClassName}
        icon={<DisclosureIcon open={open} className="-mt-[3px] mr-[6px]" />}
      >
        <p className={`max-w-[620px] text-base leading-[26px] text-ink-muted ${answerClassName}`}>
          {typograf(item.answer)}
        </p>
      </Disclosure>
    </div>
  );
}

/**
 * Две колонки вопросов: первая половина слева, вторая справа. `initiallyOpen` —
 * номера раскрытых при загрузке (на главной — ни одного, решение заказчика 30.09).
 */
export function FaqColumns({
  items,
  initiallyOpen = [],
  className = "",
  buttonClassName,
  answerClassName,
}: {
  items: { question: string; answer: string }[];
  initiallyOpen?: number[];
  className?: string;
  /** Отступы строки вопроса и ответа: у «Тортов на заказ» строки выше, чем на главной */
  buttonClassName?: string;
  answerClassName?: string;
}) {
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set(initiallyOpen));
  const toggle = (index: number) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  // Две колонки: первая половина слева, вторая справа (на макете по четыре)
  const half = Math.ceil(items.length / 2);
  const columns = [items.slice(0, half), items.slice(half)];

  return (
    <div className={`grid gap-x-[72px] lg:grid-cols-2 ${className}`}>
      {columns.map((column, columnIndex) => (
        <RevealGroup key={columnIndex} delay={MOTION.text.afterHeading + columnIndex * 0.04}>
          {column.map((item, index) => {
            const itemIndex = columnIndex * half + index;
            return (
              <Question
                key={item.question}
                item={item}
                open={open.has(itemIndex)}
                onToggle={() => toggle(itemIndex)}
                index={index}
                topLine={index > 0 ? "none" : columnIndex === 0 ? "always" : "desktop"}
                buttonClassName={buttonClassName}
                answerClassName={answerClassName}
              />
            );
          })}
        </RevealGroup>
      ))}
    </div>
  );
}

export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <section
      aria-labelledby="faq-title"
      className="container-page pb-20 lg:pt-[130px] lg:pb-[256px]"
    >
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <RevealText as="h2" id="faq-title" className="text-section">
            Вопросы
          </RevealText>
          <Reveal as="p" className="mt-2 text-subtitle font-light text-ink-muted lg:mt-[8.6px]">
            Если чего-то нет в списке, напишите Елене
          </Reveal>
        </div>
        <Reveal delay={MOTION.button.delay} className="flex lg:mb-[1.4px]">
          <LinkButton href="/contacts#feedback" variant="outline" size="md" className="w-[202px]">
            Задать вопрос
          </LinkButton>
        </Reveal>
      </div>

      {/* Все свёрнуты (решение заказчика, отступление от макета) */}
      <FaqColumns items={items} className="mt-10 lg:mt-[62.6px]" />
    </section>
  );
}
