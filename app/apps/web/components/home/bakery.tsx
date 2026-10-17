/**
 * «Кондитерская на Гжатской» по макету 1512.png: заголовок и подзаголовок,
 * фото интерьера на всю ширину окна (без полей) и под ним четыре колонки
 * с вертикальными разделителями — адрес с кнопкой маршрута, часы, как
 * добраться, метки кондитерской.
 *
 * Адрес и часы — структурированные поля GET /pages/contacts (их же читают
 * подвал и шапка), остальное — content контактов. Ширины колонок на 1512 —
 * 360 / 385 / 385 / 286 px (поле 24px после разделителя); шире они растут
 * в той же пропорции.
 */

import Image from "next/image";
import type { ReactNode } from "react";
import { Reveal, RevealGroup, RevealImage, RevealText } from "@/components/motion";
import { LinkButton, Tag } from "@/components/ui";
import { imageUrl, type ContactsPage } from "@/lib/api";
import { MOTION } from "@/lib/motion";
import { typograf } from "@/lib/format";

function Column({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-line lg:border-l lg:pl-6 lg:first:border-l-0 lg:first:pl-0">
      <h3 className="font-sans text-[15px] leading-5 font-light text-ink-subtle">{label}</h3>
      {children}
    </div>
  );
}

const VALUE = "mt-[8px] font-display text-[1.75rem] leading-[33px] whitespace-pre-line";

export function Bakery({ contacts }: { contacts: ContactsPage }) {
  const content = contacts.content;
  const interior = imageUrl(content.interior_image_key);
  const hours = [contacts.work_hours_weekdays, contacts.work_hours_weekend].filter(Boolean);

  return (
    <section aria-labelledby="bakery-title" className="py-20 lg:pt-[257px] lg:pb-[127px]">
      <div className="container-page">
        <RevealText as="h2" id="bakery-title" className="text-section" preserveSpaces>
          Кондитерская на Гжатской
        </RevealText>
        <Reveal as="p" className="mt-2 text-subtitle font-light text-ink-muted lg:mt-[8.6px]">
          Открыто с девяти. Кофе, витрина и заказы навынос
        </Reveal>
      </div>

      <RevealImage className="relative mt-10 h-[320px] overflow-hidden bg-photo sm:h-[480px] lg:mt-[62.6px] lg:h-[700px]">
        {interior ? (
          <Image
            src={interior}
            alt="Зал кондитерской на Гжатской: витрина с десертами и барная стойка"
            fill
            sizes="100vw"
            className="object-cover"
          />
        ) : null}
      </RevealImage>

      <RevealGroup
        delay={MOTION.text.afterHeading}
        className="container-page mt-10 grid gap-8 sm:grid-cols-2 lg:mt-16 lg:grid-cols-[360fr_385fr_385fr_286fr] lg:gap-0"
      >
        {contacts.address ? (
          <Column label="Адрес">
            <p className={VALUE}>{typograf(contacts.address)}</p>
            {content.route_url ? (
              <LinkButton
                href={content.route_url}
                target="_blank"
                rel="noopener noreferrer"
                variant="outline"
                size="md-tight"
                className="mt-[8px]"
              >
                Построить маршрут
              </LinkButton>
            ) : null}
          </Column>
        ) : null}
        {hours.length > 0 ? (
          <Column label="Часы">
            <p className={VALUE}>{typograf(hours.join("\n"))}</p>
          </Column>
        ) : null}
        {content.how_to_get ? (
          <Column label="Как добраться">
            <p className={VALUE}>{typograf(content.how_to_get)}</p>
          </Column>
        ) : null}
        {content.features.length > 0 ? (
          <div className="lg:border-l lg:border-line lg:pl-6">
            <h3 className="sr-only">{typograf("Что есть в кондитерской")}</h3>
            <ul className="flex flex-wrap gap-2">
              {content.features.map((feature) => (
                <li key={feature}>
                  <Tag>{typograf(feature)}</Tag>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </RevealGroup>
    </section>
  );
}
