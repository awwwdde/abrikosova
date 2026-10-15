/**
 * Бордовая плашка-призыв внизу страницы: заголовок Forum, текст и контурная
 * кнопка справа. Одна разметка у «О нас» («Опишите повод и дату», 010a/010b)
 * и «Работ» («Не нашли похожий?», 009). Тексты — из контента страниц.
 *
 * На главной похожая плашка внутри «Торта под событие» (EventCake) свёрстана
 * по своему кадру — другая высота и отступы, она не переведена (см. отчёт 009).
 */

import { Reveal, RevealText } from "@/components/motion";
import { LinkButton, type ButtonSize, type ButtonVariant } from "@/components/ui";
import { MOTION } from "@/lib/motion";

export function CtaBanner({
  id,
  title,
  text,
  href,
  label,
  buttonClassName = "w-[196px]",
  buttonVariant = "outline-on-accent",
  buttonSize = "md-tight",
}: {
  /** id заголовка — для aria-labelledby секции */
  id: string;
  title: string;
  text: string;
  href: string;
  label: string;
  /** Ширина кнопки по макету страницы */
  buttonClassName?: string;
  /** Кнопки «О нас» и «Работ» по макетам различаются обводкой и начертанием */
  buttonVariant?: ButtonVariant;
  buttonSize?: ButtonSize;
}) {
  return (
    <div className="flex min-h-[220px] items-center justify-between gap-10 bg-accent px-14 py-10 text-on-accent max-md:flex-col max-md:items-start max-md:gap-6 max-md:px-6 max-md:py-8">
      <div>
        <RevealText
          as="h2"
          id={id}
          className="text-[44px] leading-[49px] max-md:text-[32px] max-md:leading-[38px]"
        >
          {title}
        </RevealText>
        <Reveal
          as="p"
          className="mt-[18px] max-w-[820px] text-lg leading-7 whitespace-pre-line text-on-accent/70 max-md:text-base max-md:leading-[25px]"
        >
          {text}
        </Reveal>
      </div>
      <Reveal delay={MOTION.button.delay} className={`shrink-0 ${buttonClassName}`}>
        <LinkButton href={href} variant={buttonVariant} size={buttonSize} className="w-full">
          {label}
        </LinkButton>
      </Reveal>
    </div>
  );
}
