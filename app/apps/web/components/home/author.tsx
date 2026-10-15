/**
 * Блок Елены по макету 1512.png — бордовая полоса на всю ширину окна:
 * портрет 600×750 слева; справа имя, роль, цитата крупно в ёлочках,
 * два абзаца, три показателя под тонкой линией и ссылка на «О нас».
 *
 * Всё — из PageContent[home].content.author (портрет — `image_key`,
 * загрузка через POST /admin/uploads?prefix=pages). Сетка та же, что
 * у «Вкуса изнутри»: 600 + 96 + текст, текст начинается на x=744 (с 1280px,
 * уже портрет стоит над текстом).
 *
 * Цвета текста на бордо сняты с макета: основной — on-accent (#F3E5C8),
 * второстепенный — он же с прозрачностью 70 %, подписи показателей — 60 %,
 * линия — 25 %.
 */

import Image from "next/image";
import { Reveal, RevealGroup, RevealImage, RevealText } from "@/components/motion";
import { LinkButton } from "@/components/ui";
import { imageUrl, type AuthorBlock } from "@/lib/api";
import { MOTION } from "@/lib/motion";
import { typograf } from "@/lib/format";

export function Author({ author }: { author: AuthorBlock }) {
  const portrait = imageUrl(author.image_key);

  return (
    <section aria-labelledby="author-title" className="bg-accent text-on-accent">
      <div className="container-page grid gap-10 py-20 xl:grid-cols-[600px_minmax(0,1fr)] xl:gap-x-24 lg:pt-[120px] lg:pb-[120px]">
        <RevealImage className="relative aspect-[4/5] w-full max-w-[600px] overflow-hidden bg-accent-pressed xl:w-[600px]">
          {portrait ? (
            <Image
              src={portrait}
              alt={author.name}
              fill
              sizes="(min-width: 640px) 600px, 100vw"
              className="object-cover"
            />
          ) : null}
        </RevealImage>

        <div className="xl:pt-[4px]">
          <RevealText
            as="h2"
            id="author-title"
            className="font-display text-[2.5rem] leading-[1.1] sm:text-[3rem]"
          >
            {author.name}
          </RevealText>
          <Reveal as="p" className="mt-[7px] text-[17px] leading-6 text-on-accent/70">
            {typograf(author.role)}
          </Reveal>

          <RevealText
            as="blockquote"
            delay={MOTION.text.afterHeading}
            className="mt-10 font-display text-[1.75rem] leading-[1.35] sm:text-[2.125rem] lg:mt-[46px] lg:leading-[46px]"
          >
            {`«${author.quote.replace(/\.\s+/, ".\n")}»`}
          </RevealText>

          {author.paragraphs.length > 0 ? (
            <Reveal className="mt-8 max-w-[660px] space-y-6 text-lg leading-[30px] text-on-accent/70 lg:mt-[40px]">
              {author.paragraphs.map((paragraph) => (
                <p key={paragraph}>{typograf(paragraph)}</p>
              ))}
            </Reveal>
          ) : null}

          {author.stats.length > 0 ? (
            <RevealGroup
              as="dl"
              delay={MOTION.text.afterHeading}
              className="mt-10 grid grid-cols-1 gap-6 border-t border-on-accent/25 pt-8 sm:grid-cols-3 sm:gap-0 lg:mt-[56px] xl:grid-cols-[240px_240px_minmax(0,1fr)] lg:pt-[34px]"
            >
              {author.stats.map((stat) => (
                <div key={stat.label} className="flex flex-col-reverse">
                  <dt className="mt-[9px] text-[15px] leading-5 font-light text-on-accent/60">
                    {typograf(stat.label)}
                  </dt>
                  <dd className="font-display text-item leading-[1.15]">{typograf(stat.value)}</dd>
                </div>
              ))}
            </RevealGroup>
          ) : null}

          {/* flex, а не блок: у кнопки внутри блока появилась бы строка со «стойкой»
              шрифта, и обёртка стала бы выше кнопки */}
          <Reveal delay={MOTION.button.delay} className="mt-10 flex lg:mt-[46px]">
            <LinkButton
              href="/about"
              variant="outline-on-accent"
              size="md-tight"
              className="lg:w-[274px]"
            >
              {typograf("Подробнее о кондитерской")}
            </LinkButton>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
