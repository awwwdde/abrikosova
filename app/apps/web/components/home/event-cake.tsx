/**
 * «Торт под событие» по макету 1512.png: заголовок слева и два предложения
 * справа, четыре этапа в ряд (номер на линии, название, срок бордо,
 * описание) и бордовая плашка «Опишите повод и дату» со ссылкой на заказ.
 *
 * Этапы — из PageContent[custom_cakes].content.stages[]: их же покажет
 * страница «Торты на заказ», тексты не дублируются. Текст плашки —
 * content.order_banner главной. Перенос строки в тексте плашки (\n) сохраняется.
 *
 * Линия этапа уходит под промежуток между колонками (−mr-6), поэтому на
 * ширине 1512 линии идут сплошь от номера до номера, как на макете.
 */

import { Reveal, RevealGroup, RevealLine, RevealText } from "@/components/motion";
import { LinkButton } from "@/components/ui";
import type { HomeContent } from "@/lib/api";
import { typograf } from "@/lib/format";
import { MOTION } from "@/lib/motion";

export type Stage = { title: string; duration: string | null; text: string };

/**
 * Этапы из свободного JSON страницы «Торты на заказ». Схемы у этого content
 * пока нет (типизированы только главная и контакты), поэтому форма
 * проверяется здесь: неполный этап пропускается, а не роняет страницу.
 */
export function readStages(content: Record<string, unknown> | null | undefined): Stage[] {
  const raw = content?.stages;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return [];
    const { title, duration, text } = item as Record<string, unknown>;
    if (typeof title !== "string" || typeof text !== "string") return [];
    return [{ title, text, duration: typeof duration === "string" ? duration : null }];
  });
}

export function EventCake({
  stages,
  banner,
}: {
  stages: Stage[];
  banner: HomeContent["order_banner"];
}) {
  return (
    <section
      aria-labelledby="event-cake-title"
      className="container-page pb-20 lg:pt-[130px] lg:pb-[128px]"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
        <RevealText as="h2" id="event-cake-title" className="text-section">
          Торт под событие
        </RevealText>
        {/* Ширина блока — как на макете: левый край текста на x=906 при 1512 */}
        <Reveal as="p" className="text-subtitle font-light text-ink-muted lg:w-[558px] lg:shrink-0">
          <span className="lg:block">
            {typograf("От заявки до готового торта проходит от пяти дней. ")}
          </span>
          <span className="lg:block">
            {typograf("Первый ответ с весом и ценой приходит в день обращения")}
          </span>
        </Reveal>
      </div>

      {stages.length > 0 ? (
        <RevealGroup
          as="ol"
          delay={MOTION.text.afterHeading}
          className="mt-12 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:mt-[111px] lg:grid-cols-4"
        >
          {stages.map((stage, index) => (
            <li key={stage.title} className="group">
              <div aria-hidden="true" className="flex h-4 items-center lg:-mr-6 lg:group-last:mr-0">
                <span className="tnum w-12 shrink-0 text-center text-base leading-none text-ink-subtle">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <RevealLine
                  delay={0.2 + index * MOTION.stagger.step}
                  className="h-px flex-1 bg-line"
                />
              </div>
              <h3 className="mt-[58px] font-display text-item leading-[1.15]">
                {typograf(stage.title)}
              </h3>
              {stage.duration ? (
                <p className="mt-[7px] text-base leading-6 font-semibold text-accent">
                  {typograf(stage.duration)}
                </p>
              ) : null}
              <p className="mt-4 max-w-[240px] text-base leading-[26px] text-ink-muted">
                {typograf(stage.text)}
              </p>
            </li>
          ))}
        </RevealGroup>
      ) : null}

      {banner ? (
        <Reveal className="mt-16 flex flex-col gap-8 bg-accent px-6 py-10 sm:px-14 lg:mt-[96px] lg:h-[220px] lg:flex-row lg:items-center lg:justify-between lg:py-0">
          <div className="lg:pt-[2px]">
            <h3 className="font-display text-[2rem] leading-[1.1] text-on-accent sm:text-[2.75rem]">
              {typograf(banner.title)}
            </h3>
            <p className="mt-[18px] text-lg leading-7 whitespace-pre-line text-on-accent/70">
              {typograf(banner.text)}
            </p>
          </div>
          <LinkButton
            href="/custom-cakes"
            variant="outline-dark"
            size="md"
            className="w-[188px] shrink-0"
          >
            Заказать торт
          </LinkButton>
        </Reveal>
      ) : null}
    </section>
  );
}
