/**
 * «Работы» по макету new/design/pages/works.png (009).
 *
 * Сервер рисует всё по параметрам адреса: фильтр `?occasion=` и «Показать ещё»
 * `?page=N` (страницы 1…N сразу, как каталог 005b). С JS «Показать ещё» — та же
 * ссылка без прокрутки наверх; без JS фильтр и догрузка работают обычными ссылками.
 *
 * Фильтр — «таблетки» поводов с числом работ (`GET /gallery/occasions`), пустые
 * скрыты. «Юбилей и корпоратив» — одно значение `anniversary_corporate`, бэкенд
 * разворачивает его в два повода. Тексты (справа от заголовка и плашка внизу) —
 * страница контента `gallery` («Страницы сайта» → «Работы»).
 */

import Link from "@/components/page-transition";
import type { Metadata } from "next";
import { CtaBanner } from "@/components/cta-banner";
import { Reveal, RevealGroup, RevealText } from "@/components/motion";
import { Breadcrumbs, EmptyState, LinkButton } from "@/components/ui";
import { WorkCard } from "@/components/work-card";
import {
  apiGet,
  type GalleryFacet,
  type GalleryItem,
  type GalleryOccasion,
  type GalleryPageContent,
  type Page,
} from "@/lib/api";
import { typograf } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;

/** Работ на странице «Показать ещё». */
const PAGE_SIZE = 12;
/** Предел API (`page_size ≤ 60`): дальше пяти страниц адрес с ?page не растёт */
const MAX_PAGES = 5;

const OCCASIONS: readonly GalleryOccasion[] = [
  "wedding",
  "birthday",
  "kids",
  "anniversary_corporate",
];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readQuery(params: Record<string, string | string[] | undefined>) {
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const occasion = OCCASIONS.find((o) => o === one(params.occasion)) ?? null;
  const page = Math.min(Math.max(Number.parseInt(one(params.page) ?? "1", 10) || 1, 1), MAX_PAGES);
  return { occasion, page };
}

function href(occasion: GalleryOccasion | null, page = 1): string {
  const query = new URLSearchParams();
  if (occasion) query.set("occasion", occasion);
  if (page > 1) query.set("page", String(page));
  const search = query.toString();
  return search ? `/gallery?${search}` : "/gallery";
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
  const { occasion, page } = readQuery(await searchParams);
  // Фильтр и «Показать ещё» — та же страница: noindex, follow и canonical на /gallery
  return pageMetadata({
    title: "Работы",
    description:
      "Торты, которые Елена делала на свадьбы, дни рождения и юбилеи: ярусы, вес и число гостей под каждым фото.",
    path: "/gallery",
    noindex: Boolean(occasion) || page > 1,
    canonical: true,
  });
}

export default async function GalleryPage({ searchParams }: { searchParams: SearchParams }) {
  const { occasion, page } = readQuery(await searchParams);
  const empty: Page<GalleryItem> = { items: [], total: 0, page: 1, page_size: 0 };
  const query = new URLSearchParams({ page_size: String(PAGE_SIZE * page) });
  if (occasion) query.set("occasion", occasion);
  const [works, facets, content] = await Promise.all([
    safeGet<Page<GalleryItem>>(`/gallery?${query}`, empty),
    safeGet<GalleryFacet[]>("/gallery/occasions", []),
    safeGet<GalleryPageContent | null>("/pages/gallery", null),
  ]);
  const pills = facets.filter((facet) => facet.count > 0);
  const hasMore = works.items.length < works.total && page < MAX_PAGES;
  const intro = content?.content.intro;
  const cta = content?.content.cta;

  return (
    <div className="gallery-page public-page container-page pt-8 pb-20 xl:pt-[35px] xl:pb-[128px]">
      <Breadcrumbs items={[{ href: "/", label: "Главная" }, { label: "Работы" }]} />

      <div className="mt-6 grid gap-6 md:grid-cols-2 md:items-start xl:mt-[25px]">
        <RevealText as="h1" className="font-display text-section leading-[1.1] text-ink">
          Работы
        </RevealText>
        {intro ? (
          <Reveal
            as="p"
            className="max-w-[600px] text-[17px] leading-7 font-light text-ink-muted md:-mt-[5px]"
          >
            {intro}
          </Reveal>
        ) : null}
      </div>

      {pills.length > 0 ? (
        <nav
          aria-label="Поводы"
          className="scrollbar-none mt-6 overflow-x-auto max-lg:[mask-image:linear-gradient(to_right,#000_calc(100%-32px),transparent)] xl:mt-[26px]"
        >
          <ul className="flex w-max gap-2">
            {[{ value: null, label: "Все" }, ...pills].map((pill) => {
              const selected = pill.value === occasion;
              return (
                <li key={pill.value ?? "all"}>
                  <Link
                    href={href(pill.value)}
                    aria-current={selected ? "page" : undefined}
                    scroll={false}
                    className={`flex h-[38px] items-center rounded-[2px] border px-[15px] text-sm whitespace-nowrap transition-colors duration-150 ${
                      selected
                        ? "border-accent bg-accent text-canvas"
                        : "border-line text-ink hover:border-accent hover:text-accent"
                    }`}
                  >
                    {typograf(pill.label)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      <div className="mt-10 xl:mt-[41px]">
        {/* Заголовок списка для скринридеров: после H1 карточки (H3) шли бы без H2 */}
        <h2 className="sr-only">Примеры работ</h2>
        {works.items.length === 0 ? (
          <EmptyState
            title="Скоро здесь появятся работы"
            description="Пока раздел наполняется — загляните в каталог или закажите торт под свой повод."
            action={<LinkButton href="/custom-cakes">Заказать торт</LinkButton>}
          />
        ) : (
          <RevealGroup
            as="ul"
            className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:gap-y-[55px]"
          >
            {works.items.map((work, index) => (
              <li key={work.id}>
                <WorkCard
                  title={work.caption}
                  image={work.image_key}
                  secondImage={work.detail_image_key}
                  occasion={work.occasion}
                  madeIn={work.made_in}
                  tiers={work.tiers}
                  weightGrams={work.weight_grams}
                  guests={work.guests}
                  orderHref={`/custom-cakes?like=${work.id}`}
                  sizes="(min-width: 1024px) 456px, (min-width: 640px) 47vw, 92vw"
                  placeholderLabel={work.caption}
                  touchLink
                  priority={index < 3}
                />
              </li>
            ))}
          </RevealGroup>
        )}

        {hasMore ? (
          <div className="mt-14 flex justify-center xl:mt-[55px]">
            <LinkButton
              href={href(occasion, page + 1)}
              variant="outline"
              size="md"
              scroll={false}
              className="w-[194px]"
            >
              Показать ещё
            </LinkButton>
          </div>
        ) : null}
      </div>

      {cta ? (
        <section aria-labelledby="works-cta-title" className="mt-20 xl:mt-[128px]">
          <CtaBanner
            id="works-cta-title"
            title={cta.title}
            text={cta.text}
            href="/custom-cakes"
            label="Заказать свой дизайн"
            buttonClassName="w-[260px] max-md:w-full"
            buttonVariant="outline-line-on-accent"
            buttonSize="md-tight-regular"
          />
        </section>
      ) : null}
    </div>
  );
}
