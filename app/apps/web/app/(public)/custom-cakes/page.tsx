/**
 * «Торты на заказ» по кадру списка new/design/pages/custom-cakes.png (008b).
 *
 * Данные — только из API: сетка `GET /custom-cakes?occasion=`, остальное —
 * `/custom-cakes/info` (факты, цены, этапы, вопросы: тексты из «Страниц сайта»,
 * числа из «Настроек → Торты на заказ»), все начинки — `/custom-cakes/fillings`,
 * первое значение калькулятора — `/custom-cakes/estimate`. Кэш помечен тегом
 * `custom_cakes` (lib/api.ts): правка в админке сбрасывает его сразу.
 *
 * Фильтр поводов — как в «Работах» (009): `?occasion=` в адресе, обычные ссылки
 * (без JS тоже), «Все» сбрасывает. Окно заявки и страница дизайна — 008c: кнопки
 * заявки пока ведут на `?request=1`, карточки — на `/custom-cakes/<slug>`.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { Calculator } from "@/components/custom-cakes/calculator";
import { DesignCard, IdeaCard } from "@/components/custom-cakes/design-card";
import { DesignGrid } from "@/components/custom-cakes/design-grid";
import { FillingsSection } from "@/components/custom-cakes/fillings-section";
import { FaqColumns } from "@/components/home/faq";
import { JsonLd } from "@/components/json-ld";
import { Reveal, RevealGroup, RevealText } from "@/components/motion";
import { Breadcrumbs, EmptyState, LinkButton } from "@/components/ui";
import {
  apiGet,
  formatPrice,
  type CakeEstimate,
  type CakeFilling,
  type ContactsPage,
  type CustomCakeList,
  type CustomCakesInfo,
  type GalleryOccasion,
} from "@/lib/api";
import { typograf } from "@/lib/format";
import { designsJsonLd, faqJsonLd } from "@/lib/json-ld";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;

const OCCASIONS: readonly GalleryOccasion[] = [
  "wedding",
  "birthday",
  "kids",
  "anniversary_corporate",
];
/** Гостей в калькуляторе при открытии страницы (кадр списка) */
const CALCULATOR_GUESTS = 20;
/** Заголовки секций по кадру: Forum 48 */
const SECTION_TITLE = "font-display text-section leading-[1.1] text-ink";
/** Колонки фактов шапки (и ячеек калькулятора): 175 / 200 / 200 на 576 по кадру */
const FACT_COLUMNS = "grid-cols-[175fr_200fr_200fr]";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readOccasion(params: Record<string, string | string[] | undefined>) {
  const value = Array.isArray(params.occasion) ? params.occasion[0] : params.occasion;
  return OCCASIONS.find((occasion) => occasion === value) ?? null;
}

function href(occasion: GalleryOccasion | null): string {
  return occasion ? `/custom-cakes?occasion=${occasion}` : "/custom-cakes";
}

async function safeGet<T>(path: string, fallback: T): Promise<T> {
  try {
    return await apiGet<T>(path);
  } catch {
    return fallback;
  }
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const occasion = readOccasion(await searchParams);
  const info = await safeGet<CustomCakesInfo | null>("/custom-cakes/info", null);
  // Фильтр — та же страница: noindex, follow и canonical на /custom-cakes
  return pageMetadata({
    title: info?.title ?? "Торты на заказ",
    description:
      info?.subtitle ??
      "Торт под вашу дату, повод и число гостей: дизайны, цены за килограмм и начинки.",
    path: "/custom-cakes",
    noindex: Boolean(occasion),
    canonical: true,
  });
}

export default async function CustomCakesPage({ searchParams }: { searchParams: SearchParams }) {
  const occasion = readOccasion(await searchParams);
  const emptyList: CustomCakeList = { items: [], total: 0, facets: [] };
  const [list, info, fillings, estimate, contacts] = await Promise.all([
    safeGet<CustomCakeList>(href(occasion), emptyList),
    safeGet<CustomCakesInfo | null>("/custom-cakes/info", null),
    safeGet<CakeFilling[]>("/custom-cakes/fillings", []),
    safeGet<CakeEstimate | null>(`/custom-cakes/estimate?guests=${CALCULATOR_GUESTS}`, null),
    safeGet<ContactsPage | null>("/pages/contacts", null),
  ]);
  const pills = list.facets.filter((facet) => facet.count > 0);
  const allCount = list.facets.reduce((sum, facet) => sum + facet.count, 0);
  const telegram = contacts?.telegram_url;
  const title = info?.title ?? "Торты на заказ";

  return (
    <div className="cakes-page public-page container-page pt-8 pb-20 xl:pt-[35px] xl:pb-[128px]">
      <Breadcrumbs items={[{ href: "/", label: "Главная" }, { label: title }]} />

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_576px] lg:items-end xl:mt-[21px]">
        <div>
          <RevealText as="h1" className="font-display text-section leading-[1.1] text-ink">
            {title}
          </RevealText>
          {info?.subtitle ? (
            <Reveal
              as="p"
              className="mt-0 max-w-[740px] text-[17px] leading-[30px] whitespace-pre-line text-ink-muted"
            >
              {typograf(info.subtitle)}
            </Reveal>
          ) : null}
          <Reveal className="mt-[32px] flex flex-wrap gap-3">
            <LinkButton
              href="/custom-cakes?request=1"
              scroll={false}
              size="md-tight"
              className="w-[209px]"
            >
              Заказать свой дизайн
            </LinkButton>
            {telegram ? (
              <LinkButton href={telegram} variant="outline" size="md-tight" className="w-[201px]">
                Написать в Telegram
              </LinkButton>
            ) : null}
          </Reveal>
        </div>
        {info ? (
          <Reveal as="dl" className={`grid border-y border-line ${FACT_COLUMNS}`}>
            {info.facts.map((fact, index) => (
              <div
                key={fact.label}
                className={`flex flex-col-reverse py-[22px] ${index > 0 ? "border-l border-line pl-6" : ""}`}
              >
                <dt className="mt-[10px] text-[13px] leading-5 text-ink-subtle">{fact.label}</dt>
                <dd className="font-display text-[26px] leading-8 text-ink max-sm:text-[22px]">
                  {fact.value}
                </dd>
              </div>
            ))}
          </Reveal>
        ) : null}
      </div>

      {pills.length > 0 ? (
        <nav
          aria-label="Поводы"
          className="scrollbar-none mt-10 overflow-x-auto max-lg:[mask-image:linear-gradient(to_right,#000_calc(100%-32px),transparent)] xl:mt-[56px]"
        >
          <ul className="flex w-max gap-2">
            {[{ value: null, label: "Все", count: allCount }, ...pills].map((pill) => {
              const selected = pill.value === occasion;
              return (
                <li key={pill.value ?? "all"}>
                  <Link
                    href={href(pill.value)}
                    aria-current={selected ? "page" : undefined}
                    scroll={false}
                    className={`relative flex h-[38px] items-center rounded-[2px] border px-[15px] text-sm whitespace-nowrap transition-colors duration-150 ${
                      selected
                        ? "border-accent bg-accent text-canvas"
                        : "border-line text-ink hover:border-accent hover:text-accent"
                    }`}
                  >
                    {typograf(pill.label)}
                    <span className="sr-only">: {pill.count}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      <section aria-labelledby="designs-title" className="mt-10 xl:mt-[40px]">
        {/* Заголовок списка для скринридеров: после H1 карточки (H3) шли бы без H2 */}
        <h2 id="designs-title" className="sr-only">
          Дизайны
        </h2>
        {list.items.length === 0 ? (
          <EmptyState
            title="Дизайнов с этим поводом пока нет"
            description="Посмотрите все дизайны или пришлите свой образец — Елена соберёт эскиз под ваш праздник."
            action={<LinkButton href="/custom-cakes">Все дизайны</LinkButton>}
          />
        ) : (
          <DesignGrid key={occasion ?? "all"} count={list.items.length}>
            <li>
              <IdeaCard text={info?.idea_text ?? null} />
            </li>
            {list.items.map((card, index) => (
              <li key={card.id}>
                <DesignCard card={card} priority={index < 3} />
              </li>
            ))}
          </DesignGrid>
        )}
      </section>

      {estimate && info ? (
        <section aria-labelledby="calculator-title" className="mt-20 xl:mt-[127px]">
          <Calculator
            initial={estimate}
            intro={[`Считаем около ${info.grams_per_guest} г на гостя.`, info.calculator_text]
              .filter(Boolean)
              .join(" ")}
            note={info.calculator_note ?? null}
          />
        </section>
      ) : null}

      {info ? (
        <>
          <section aria-labelledby="prices-title" className="mt-20 xl:mt-[118px]">
            <RevealText as="h2" id="prices-title" className={SECTION_TITLE}>
              Цены
            </RevealText>
            {info.prices_intro ? (
              <Reveal as="p" className="mt-[2px] text-[17px] leading-7 text-ink-muted">
                {typograf(info.prices_intro)}
              </Reveal>
            ) : null}
            <RevealGroup
              as="ul"
              className="mt-10 grid border-y border-line lg:grid-cols-[450px_1fr_1fr] xl:mt-[45px]"
            >
              {info.prices.map((price, index) => (
                <li
                  key={price.decoration}
                  className={`py-[25px] ${index > 0 ? "border-line max-lg:border-t lg:border-l lg:pl-8" : ""}`}
                >
                  <p className="text-[13px] leading-5 text-ink-subtle">{typograf(price.label)}</p>
                  <p className="mt-[14px] font-display text-[40px] leading-[44px] text-ink max-sm:text-[32px]">
                    от {formatPrice(price.price_per_kg)}/кг
                  </p>
                  <p className="mt-[18px] text-[14px] leading-5 text-ink-muted">
                    {typograf(price.note)}
                  </p>
                </li>
              ))}
            </RevealGroup>
            {info.prices_note ? (
              <Reveal as="p" className="mt-[26px] text-[14px] leading-5 text-ink-muted">
                {typograf(info.prices_note)}
              </Reveal>
            ) : null}
          </section>

          <section
            id="fillings"
            aria-labelledby="fillings-title"
            className="mt-20 scroll-mt-28 xl:mt-[118px]"
          >
            <RevealText as="h2" id="fillings-title" className={SECTION_TITLE}>
              Начинки
            </RevealText>
            {info.fillings_intro ? (
              <Reveal
                as="p"
                className="mt-0 max-w-[720px] text-[17px] leading-[31px] text-ink-muted"
              >
                {typograf(info.fillings_intro)}
              </Reveal>
            ) : null}
            <FillingsSection
              fillings={fillings.length > 0 ? fillings : info.fillings}
              tastingSet={info.tasting_set ?? null}
            />
          </section>

          {info.stages.length > 0 ? (
            <section aria-labelledby="order-title" className="mt-20 xl:mt-[117px]">
              <RevealText as="h2" id="order-title" className={SECTION_TITLE}>
                Как заказать
              </RevealText>
              <RevealGroup
                as="ol"
                className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4 xl:mt-[47px]"
              >
                {info.stages.map((stage, index) => (
                  <li key={stage.title}>
                    <p className="text-[14px] leading-5 text-ink-subtle tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </p>
                    <h3 className="mt-4 font-display text-[28px] leading-8 text-ink lg:mt-[56px]">
                      {typograf(stage.title)}
                    </h3>
                    {stage.duration ? (
                      <p className="mt-[12px] text-[15px] leading-6 font-semibold text-accent">
                        {typograf(stage.duration)}
                      </p>
                    ) : null}
                    <p className="mt-[16px] text-[15px] leading-[26px] text-ink-muted">
                      {typograf(stage.text)}
                    </p>
                  </li>
                ))}
              </RevealGroup>
              {info.order_facts.length > 0 ? (
                <Reveal
                  as="dl"
                  className="mt-12 grid bg-photo sm:grid-cols-2 lg:grid-cols-4 xl:mt-[49px] [&>div+div]:border-line max-lg:[&>div+div]:border-t lg:[&>div+div]:border-l"
                >
                  {info.order_facts.map((fact) => (
                    <div
                      key={fact.label}
                      className="flex flex-col-reverse px-7 pt-[25px] pb-[24px]"
                    >
                      <dd className="mt-[9px] font-display text-[26px] leading-8 text-ink">
                        {typograf(fact.value)}
                      </dd>
                      <dt className="text-[13px] leading-5 text-ink-subtle">{fact.label}</dt>
                    </div>
                  ))}
                </Reveal>
              ) : null}
            </section>
          ) : null}

          {info.faq.length > 0 ? (
            <section aria-labelledby="faq-title" className="mt-20 xl:mt-[117px]">
              <RevealText as="h2" id="faq-title" className={SECTION_TITLE}>
                Вопросы
              </RevealText>
              {/* Все свёрнуты, как на главной (решение заказчика 30.09); в кадре первый раскрыт */}
              <FaqColumns
                items={info.faq}
                initiallyOpen={[]}
                buttonClassName="pt-[39px] pb-[19px]"
                answerClassName="pt-[9px] pb-[22px]"
                className="mt-10 xl:mt-[27px]"
              />
              <JsonLd data={faqJsonLd(info.faq)} />
            </section>
          ) : null}
        </>
      ) : null}

      {list.items.length > 0 ? <JsonLd data={designsJsonLd(list.items)} /> : null}
    </div>
  );
}
