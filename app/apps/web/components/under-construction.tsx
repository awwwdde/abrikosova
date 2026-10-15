import { Reveal, RevealText } from "@/components/motion";
import { LinkButton } from "@/components/ui";
import { MOTION } from "@/lib/motion";

/**
 * Страница-сообщение: «Страница в разработке» для разделов, ещё не свёрстанных
 * по макету (задание 004h), и 404. Только заголовок в стиле заголовков секций
 * и кнопка «На главную» — так решил заказчик.
 *
 * Область занимает минимум высоту экрана без шапки (72px, с 1280 — --header-h),
 * чтобы подвал не прилипал к шапке. Заголовок — h1 этой страницы.
 */
export function UnderConstruction({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <section className="container-page flex min-h-[calc(100svh-72px)] flex-col items-center justify-center py-20 text-center xl:min-h-[calc(100svh-var(--header-h))]">
      {eyebrow ? (
        <Reveal as="p" delay={0} className="eyebrow mb-4">
          {eyebrow}
        </Reveal>
      ) : null}
      <RevealText as="h1" className="text-section">
        {title}
      </RevealText>
      <Reveal delay={MOTION.button.delay} className="mt-10 flex justify-center">
        <LinkButton href="/" variant="outline" size="md">
          На главную
        </LinkButton>
      </Reveal>
    </section>
  );
}
