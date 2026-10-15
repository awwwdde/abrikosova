/**
 * Бегущая строка под героем: бордо-полоса 82px, пункты капсом через точку.
 *
 * Бесшовность: лента — две одинаковые половины подряд, анимация сдвигает
 * на −50%, и к концу круга вторая половина стоит ровно там, где начиналась
 * первая. Чтобы в конце круга не открывался пустой хвост, каждая половина
 * должна быть шире окна: пункты в ней повторяются REPEAT раз (одна копия
 * пунктов ~1500px, половина ~4500px — хватает и на 4K). Наведение ставит на
 * паузу, при `prefers-reduced-motion` строка стоит (globals.css).
 * Скринридер читает пункты один раз списком; анимированная лента скрыта.
 *
 * Отступы у точки сняты с макета: от текста до точки 28px, от точки до
 * следующего пункта 21px (с учётом трекинга последней буквы), точка 3×2px
 * цвета фона с прозрачностью ~47%.
 */

import { typograf } from "@/lib/format";

const REPEAT = 3;

function Half({ items }: { items: string[] }) {
  const repeated = Array.from({ length: REPEAT }, () => items).flat();
  return (
    <ul className="flex shrink-0 items-center">
      {repeated.map((item, index) => (
        <li key={`${item}-${index}`} className="flex items-center">
          <span className="text-marquee tracking-marquee whitespace-nowrap uppercase">
            {typograf(item)}
          </span>
          <span className="mr-[21px] ml-[28px] h-[2px] w-[3px] bg-canvas/47" />
        </li>
      ))}
    </ul>
  );
}

export function Ticker({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-label="Что есть в кондитерской" className="bg-accent text-canvas">
      <ul className="sr-only">
        {items.map((item) => (
          <li key={item}>{typograf(item)}</li>
        ))}
      </ul>
      <div className="ticker flex h-[82px] items-center overflow-hidden" aria-hidden="true">
        <div className="ticker-track flex w-max">
          <Half items={items} />
          <Half items={items} />
        </div>
      </div>
    </section>
  );
}
