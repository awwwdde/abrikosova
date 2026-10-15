"use client";

/**
 * Раскрывающиеся блоки страницы товара (макет 09.10 product-frames/f0-1, второй экран):
 * «Состав и пищевая ценность» (открыт), «Хранение», «Доставка, самовывоз и оплата».
 *
 * Аккордеон — общий `Disclosure` (тот же, что у вопросов на главной). Заголовок —
 * h2 с кнопкой; на 1024+ раскрытое содержимое стоит справа от заголовка, в строке
 * заголовка — «+» / «−». Огрех макета исправлен: «−» стоял поверх текста состава;
 * здесь у первой строки таблицы справа место под значок.
 *
 * Пустые строки не показываются; нет КБЖУ — нет таблицы пищевой ценности.
 * Таблица КБЖУ — настоящая `<table>` с `<th scope>`.
 */

import { useState, type ReactNode } from "react";
import { Disclosure, DisclosureIcon } from "@/components/disclosure";
import type { Nutrition } from "@/lib/api";
import { typograf } from "@/lib/format";

export type Row = [label: string, value: string | null | undefined];

export type DetailBlock = {
  title: string;
  rows: Row[];
  nutrition?: Nutrition | null;
};

function number(value: string, unit: string): string {
  const text = Number.parseFloat(value).toLocaleString("ru-RU", { maximumFractionDigits: 1 });
  return `${text} ${unit}`;
}

function NutritionTable({ nutrition }: { nutrition: Nutrition }) {
  const rows: [string, string | null][] = [
    ["Калории", nutrition.kcal != null ? number(nutrition.kcal, "ккал") : null],
    ["Белки", nutrition.proteins != null ? number(nutrition.proteins, "г") : null],
    ["Жиры", nutrition.fats != null ? number(nutrition.fats, "г") : null],
    ["Углеводы", nutrition.carbs != null ? number(nutrition.carbs, "г") : null],
  ];
  return (
    <>
      <p id="nutrition-caption" className="mt-[33px] text-[13px] text-ink-subtle">
        Пищевая ценность на 100 г
      </p>
      <table
        aria-labelledby="nutrition-caption"
        className="mt-[12px] w-full border-collapse border border-line text-center text-sm text-ink"
      >
        <thead>
          <tr className="bg-photo">
            <th scope="col" className="h-16 w-1/2 border border-line font-medium text-ink-muted">
              Показатель
            </th>
            <th scope="col" className="h-16 border border-line font-medium text-ink-muted">
              Значение
            </th>
          </tr>
        </thead>
        <tbody>
          {rows
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <tr key={label}>
                <th scope="row" className="h-16 border border-line font-normal">
                  {label}
                </th>
                <td className="h-16 border border-line">{value}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </>
  );
}

function Rows({ rows }: { rows: Row[] }) {
  const filled = rows.filter(([, value]) => Boolean(value?.trim()));
  if (filled.length === 0) return null;
  return (
    <dl className="border-t border-line">
      {filled.map(([label, value]) => (
        <div
          key={label}
          className="grid grid-cols-[200px_minmax(0,1fr)] border-b border-line py-[14px] text-sm leading-6 max-sm:grid-cols-1 max-sm:gap-1"
        >
          <dt className="text-[13px] text-ink-subtle">{label}</dt>
          {/* Справа поле 70px у всех строк (макет 09.10: «Вес и размер» в две строки);
              у первой оно же — место под «−» из строки заголовка */}
          <dd className="whitespace-pre-line text-ink lg:pr-[70px]">{typograf(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function Block({
  block,
  open,
  onToggle,
  first,
}: {
  block: DetailBlock;
  open: boolean;
  onToggle: () => void;
  first: boolean;
}): ReactNode {
  return (
    <div
      className={`relative border-b border-line lg:grid lg:grid-cols-[minmax(0,1fr)_696px] lg:gap-x-6 ${
        first ? "border-t" : ""
      }`}
    >
      <Disclosure
        heading="h2"
        open={open}
        onToggle={onToggle}
        headingClassName="lg:col-start-1 lg:row-start-1"
        // Свёрнутая строка — 94px (макет 09.10): 28 + строка 40 + 26
        buttonClassName="pt-[28px] pb-[26px]"
        title={
          <span className="font-display text-[32px] leading-10 text-ink transition-colors group-hover:text-accent max-sm:text-[26px] max-sm:leading-8">
            {typograf(block.title)}
          </span>
        }
        // Значок — справа во всю ширину блока: на 1024+ кнопка заголовка
        // занимает только левую колонку, а «+» стоит у правого края
        icon={
          <DisclosureIcon
            open={open}
            size={20}
            className="mt-[10px] lg:absolute lg:top-[38px] lg:right-0 lg:z-10 lg:mt-0"
          />
        }
        panelClassName="lg:col-start-2 lg:row-start-1"
      >
        <div className="pb-[27px] lg:pt-[28px]">
          <Rows rows={block.rows} />
          {block.nutrition ? <NutritionTable nutrition={block.nutrition} /> : null}
        </div>
      </Disclosure>
    </div>
  );
}

export function ProductDetails({ blocks }: { blocks: DetailBlock[] }) {
  // «Состав и пищевая ценность» открыт по умолчанию, остальные свёрнуты
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set([0]));
  const visible = blocks.filter(
    (block) => block.rows.some(([, value]) => value?.trim()) || block.nutrition,
  );
  return (
    <div>
      {visible.map((block, index) => (
        <Block
          key={block.title}
          block={block}
          first={index === 0}
          open={open.has(index)}
          onToggle={() =>
            setOpen((current) => {
              const next = new Set(current);
              if (next.has(index)) next.delete(index);
              else next.add(index);
              return next;
            })
          }
        />
      ))}
    </div>
  );
}
