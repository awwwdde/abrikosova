/**
 * Главная по макету new/design/1512.png, сверху вниз:
 * герой с видео, бегущая строка, «Готово сегодня», «Сделано на заказ»
 * (задание 004), «Вкус изнутри», «Торт под событие», блок Елены,
 * «Кондитерская на Гжатской», «Что говорят гости», «Вопросы» (задание 004b).
 *
 * Тексты — из PageContent[home].content (правятся в админке, схема
 * `HomeContent` на бэкенде), контакты — из PageContent[contacts], товары,
 * работы, начинки, этапы и отзывы — из API. Каждая секция получает данные
 * независимо: ошибка одного запроса убирает свою секцию, а не всю страницу.
 */

import type { Metadata } from "next";
import { Carousel, EndTile } from "@/components/carousel";
import { Author } from "@/components/home/author";
import { Bakery } from "@/components/home/bakery";
import { EventCake, readStages } from "@/components/home/event-cake";
import { Faq } from "@/components/home/faq";
import { Fillings } from "@/components/home/fillings";
import { GuestReviews } from "@/components/home/guest-reviews";
import { Hero } from "@/components/home/hero";
import { Ticker } from "@/components/home/ticker";
import { READY_TODAY_QUERY, ReadyToday } from "@/components/ready-today";
import { LinkButton } from "@/components/ui";
import { JsonLd } from "@/components/json-ld";
import { WorkCard } from "@/components/work-card";
import {
  apiGet,
  type CatalogFilters,
  type ContactsPage,
  type CustomCakesInfo,
  type GalleryItem,
  type HomeContent,
  type HomePage,
  type Page,
  type ProductListItem,
  type Review,
} from "@/lib/api";
import { typograf } from "@/lib/format";
import { bakeryJsonLd, faqJsonLd, websiteJsonLd } from "@/lib/json-ld";
import { pageMetadata, SITE_NAME } from "@/lib/seo";

export const revalidate = 300;

/** Сколько начинок в «Вкусе изнутри»: список на макете — пять пунктов. */
const FILLINGS_ON_HOME = 5;

/**
 * Значения по умолчанию — тексты макета для верха страницы. Нужны, если
 * в админке блок ещё не заполнен: герой и витрина не должны остаться без
 * заголовка. Блоки низа страницы без контента просто не показываются.
 */
const DEFAULTS = {
  hero: {
    title_lines: ["Торты и десерты", "по авторским рецептурам", "Елены Абрикосовой"],
    subtitle_lines: [
      "Готовим для вас как для себя и своей семьи.",
      "Елена придумывает вкус, вы выбираете повод.",
    ],
    cta: { label: "Открыть витрину", href: "/catalog" },
  },
  made_to_order: {
    title: "Сделано на заказ",
    subtitle:
      "Каждый торт Елена собирает под дату и повод. Под фото указано, на сколько гостей он был рассчитан.",
    cta: { label: "Посмотреть все работы", href: "/gallery" },
  },
} satisfies Pick<Required<HomeContent>, "hero" | "made_to_order">;

async function safeGet<T>(path: string, fallback: T): Promise<T> {
  try {
    return await apiGet<T>(path);
  } catch {
    return fallback;
  }
}

/**
 * Заголовок и описание главной — из контента (герой правится в админке), с запасным
 * текстом макета. Те же запросы, что у страницы: Next отдаст их из кэша fetch.
 */
export async function generateMetadata(): Promise<Metadata> {
  const [page, contacts] = await Promise.all([
    safeGet<HomePage | null>("/pages/home", null),
    safeGet<ContactsPage | null>("/pages/contacts", null),
  ]);
  const hero = page?.content?.hero ?? DEFAULTS.hero;
  const where = contacts?.address
    ? `Витрина: ${contacts.address}, доставка по Москве.`
    : "Доставка по Москве.";
  return pageMetadata({
    title: SITE_NAME,
    description: `${hero.subtitle_lines.join(" ")} ${where}`,
    path: "/",
    absoluteTitle: true,
  });
}

export default async function HomePage() {
  const empty = { items: [], total: 0, page: 1, page_size: 0 };
  const [page, contacts, ready, works, filters, customCakes, reviews] = await Promise.all([
    safeGet<HomePage | null>("/pages/home", null),
    safeGet<ContactsPage | null>("/pages/contacts", null),
    // Порядок — поле order из админки (сортировка API по умолчанию)
    safeGet<Page<ProductListItem>>(READY_TODAY_QUERY, empty),
    safeGet<Page<GalleryItem>>("/gallery?page_size=8", empty),
    safeGet<CatalogFilters | null>("/catalog/filters", null),
    // Начинки (по order) и этапы заказа — с данных страницы «Торты на заказ» (008a)
    safeGet<CustomCakesInfo | null>("/custom-cakes/info", null),
    safeGet<Page<Review>>("/reviews?source=yandex&page_size=3", empty),
  ]);

  const content = page?.content;
  const hero = content?.hero ?? DEFAULTS.hero;
  const madeToOrder = content?.made_to_order ?? DEFAULTS.made_to_order;
  const occasionLabels = new Map(filters?.occasions.map((o) => [o.value, o.label]) ?? []);
  const fillings = customCakes?.fillings.slice(0, FILLINGS_ON_HOME) ?? [];
  const stages = readStages({ stages: customCakes?.stages });
  const faq = content?.faq ?? [];

  return (
    <div className="home-page">
      <Hero content={hero} />
      <Ticker items={content?.ticker ?? []} />

      {ready.items.length > 0 ? (
        <div className="home-ready container-page py-20 lg:pt-[129px] lg:pb-32">
          <ReadyToday content={content?.ready_today} items={ready.items} />
        </div>
      ) : null}

      {/* Снизу 126, а не 128: у карточки работы с названием в одну строку
          (line-clamp) бокс на 2px выше макетного — секция = 1106px, как на макете */}
      {works.items.length > 0 ? (
        <div className="home-works container-page pb-20 lg:pt-32 lg:pb-[126px]">
          <Carousel
            title={madeToOrder.title}
            subtitle={madeToOrder.subtitle}
            subtitleGap="mt-[16.6px]"
            itemClassName="w-[85vw] sm:w-[456px]"
            align="start"
            action={
              <LinkButton href={madeToOrder.cta.href} variant="outline" size="md">
                {typograf(madeToOrder.cta.label)}
              </LinkButton>
            }
          >
            {[
              ...works.items.map((work) => (
                <WorkCard
                  key={work.id}
                  title={work.caption}
                  image={work.image_key}
                  secondImage={work.detail_image_key}
                  occasion={work.occasion}
                  occasionLabel={work.occasion ? occasionLabels.get(work.occasion) : null}
                  madeIn={work.made_in}
                  tiers={work.tiers}
                  weightGrams={work.weight_grams}
                  guests={work.guests}
                  orderHref={`/custom-cakes?like=${work.id}`}
                />
              )),
              <EndTile key="all-works" href="/gallery" total={works.total} />,
            ]}
          </Carousel>
        </div>
      ) : null}

      {fillings.length > 0 ? (
        <Fillings fillings={fillings} intro={content?.fillings_intro ?? []} />
      ) : null}

      {stages.length > 0 || content?.order_banner ? (
        <EventCake stages={stages} banner={content?.order_banner} />
      ) : null}

      {content?.author ? <Author author={content.author} /> : null}

      {contacts ? <Bakery contacts={contacts} /> : null}

      {contacts ? <GuestReviews contacts={contacts} reviews={reviews.items} /> : null}

      {/* Видимые вопросы и FAQPage — из одного массива content.faq */}
      {faq.length > 0 ? (
        <>
          <Faq items={faq} />
          <JsonLd data={faqJsonLd(faq)} />
        </>
      ) : null}

      <JsonLd data={[bakeryJsonLd(contacts), websiteJsonLd()]} />
    </div>
  );
}
