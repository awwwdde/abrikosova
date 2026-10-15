"use client";

/**
 * «Вкус изнутри» по макету 1512.png: слева фото начинки 600×600, справа
 * нумерованный список из пяти начинок и строка со ссылкой на все начинки.
 *
 * Активный пункт — бордо, сдвинут вправо на 12px и показывает строку
 * описания. Наведение или фокус делает пункт активным и меняет фото слева:
 * все фото лежат стопкой в квадрате постоянного размера и меняются
 * прозрачностью, поэтому высота блока не прыгает. Место под строку
 * описания есть у каждого пункта — высота строки списка тоже постоянная.
 *
 * На сенсорных экранах наведения нет — пункт становится активным по нажатию.
 * Две колонки — с 1280px: на 1024 рядом с фото 600px списку осталось бы
 * меньше 300px, поэтому ниже фото стоит над списком.
 */

import { useState } from "react";
import { FillingPhoto } from "@/components/filling-card";
import { Reveal, RevealGroup, RevealImage, RevealText } from "@/components/motion";
import { LinkButton } from "@/components/ui";
import { MOTION } from "@/lib/motion";
import type { CakeFilling } from "@/lib/api";
import { typograf } from "@/lib/format";

export function Fillings({ fillings, intro }: { fillings: CakeFilling[]; intro: string[] }) {
  const [active, setActive] = useState(0);

  return (
    <section
      aria-labelledby="fillings-title"
      className="container-page py-20 lg:pt-[131px] lg:pb-[122px]"
    >
      <RevealText as="h2" id="fillings-title" className="text-section">
        Вкус изнутри
      </RevealText>
      {intro.length > 0 ? (
        <Reveal className="mt-4 text-subtitle font-light text-ink-muted lg:mt-[15.6px]">
          {intro.map((line) => (
            <p key={line}>{typograf(line)}</p>
          ))}
        </Reveal>
      ) : null}

      <div className="mt-10 grid gap-10 lg:mt-[62.6px] xl:grid-cols-[600px_minmax(0,1fr)] xl:items-start xl:gap-x-24">
        <RevealImage className="relative aspect-square max-w-[600px] overflow-hidden bg-photo xl:w-[600px]">
          {fillings.map((filling, index) => (
            // Общее фото начинки (components/filling-card.tsx, 008b)
            <FillingPhoto
              key={filling.id}
              filling={filling}
              decorative={index !== active}
              sizes="(min-width: 640px) 600px, 100vw"
              className={`transition-opacity duration-500 ease-out-soft ${
                index === active ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}
        </RevealImage>

        <div>
          <RevealGroup as="ul" delay={MOTION.text.afterHeading}>
            {fillings.map((filling, index) => {
              const isActive = index === active;
              return (
                <li key={filling.id} className="border-t border-line">
                  <button
                    type="button"
                    aria-pressed={isActive}
                    onMouseEnter={() => setActive(index)}
                    onFocus={() => setActive(index)}
                    onClick={() => setActive(index)}
                    className="group relative flex min-h-[100px] w-full items-start pt-[22px] pb-[10px] text-left"
                  >
                    <span
                      className={`tnum absolute top-[44px] left-0 text-[14px] leading-none transition-colors duration-200 ${
                        isActive ? "text-accent" : "text-ink-subtle"
                      }`}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={`ml-12 block transition-transform duration-300 ease-out-soft sm:ml-[72px] ${
                        isActive ? "translate-x-3" : ""
                      }`}
                    >
                      <span
                        className={`block font-display text-[1.375rem] leading-[1.15] transition-colors duration-200 sm:text-[1.75rem] ${
                          isActive ? "text-accent" : "text-ink group-hover:text-accent"
                        }`}
                      >
                        {typograf(filling.name)}
                      </span>
                      <span
                        className={`mt-[4px] block text-[15px] leading-6 text-ink-muted transition-opacity duration-300 ${
                          isActive ? "opacity-100" : "opacity-0"
                        }`}
                      >
                        {typograf(filling.description)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </RevealGroup>
          <Reveal
            delay={MOTION.button.delay}
            className="flex min-h-[101px] flex-wrap items-center justify-between gap-x-6 gap-y-4 border-t border-line py-6 sm:pl-[72px] lg:py-0 lg:pr-6"
          >
            <p className="text-subtitle font-light text-ink-muted">
              {typograf("Все начинки с составом и описанием")}
            </p>
            <LinkButton
              href="/custom-cakes#fillings"
              variant="outline"
              size="md"
              className="w-[222px]"
            >
              Выбрать начинку
            </LinkButton>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
