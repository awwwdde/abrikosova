/**
 * Страница 404 по макету new/design/pages/service-pages.png, кадр «404» (010b):
 * «404» крупно бордовым Forum, «Страница не найдена», текст, «Перейти в каталог»
 * и «На главную», ниже — «Готово сегодня», та же секция, что на главной.
 *
 * Один компонент на все 404: app/not-found.tsx (адреса, которых нет вовсе, и
 * несуществующий товар — middleware переписывает его туда же, 006) и граница
 * app/(public)/not-found.tsx (`notFound()` при переходе внутри сайта).
 *
 * Нет товаров «сегодня» или API не ответил — секции нет, 404 остаётся 404.
 */

import { Reveal, RevealText } from "@/components/motion";
import { READY_TODAY_QUERY, ReadyToday } from "@/components/ready-today";
import { LinkButton } from "@/components/ui";
import { apiGet, type HomePage, type Page, type ProductListItem } from "@/lib/api";
import { MOTION } from "@/lib/motion";

async function safeGet<T>(path: string): Promise<T | null> {
  try {
    return await apiGet<T>(path);
  } catch {
    return null;
  }
}

export async function NotFoundPage() {
  const [home, ready] = await Promise.all([
    safeGet<HomePage>("/pages/home"),
    safeGet<Page<ProductListItem>>(READY_TODAY_QUERY),
  ]);
  const items = ready?.items ?? [];

  return (
    <>
      <section className="container-page pt-16 pb-20 xl:pt-[97px] xl:pb-0">
        <Reveal
          as="p"
          delay={0}
          aria-hidden="true"
          className="font-display text-[120px] leading-none text-accent xl:text-[160px]"
        >
          404
        </Reveal>
        <RevealText
          as="h1"
          className="mt-6 font-display text-section leading-[1.1] text-ink xl:mt-[4px]"
        >
          Страница не найдена
        </RevealText>
        <Reveal as="p" className="mt-3 max-w-[640px] text-lg leading-[30px] text-ink-muted xl:mt-0">
          Ссылка могла устареть после обновления сайта. Начните с каталога или загляните на
          сегодняшнюю витрину.
        </Reveal>
        <Reveal delay={MOTION.button.delay} className="mt-8 flex flex-wrap gap-3 xl:mt-[24px]">
          <LinkButton href="/catalog" size="md-tight" className="text-[15px]">
            Перейти в каталог
          </LinkButton>
          <LinkButton href="/" variant="outline" size="md-tight" className="text-[15px]">
            На главную
          </LinkButton>
        </Reveal>
      </section>

      {items.length > 0 ? (
        <div className="container-page pb-20 xl:pt-[129px] xl:pb-32">
          <ReadyToday content={home?.content.ready_today} items={items} />
        </div>
      ) : (
        <div className="pb-20 xl:pb-32" />
      )}
    </>
  );
}
