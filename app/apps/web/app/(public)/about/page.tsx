/**
 * «О нас» по макету new/design/pages/about.png (010a, доводка — 010b).
 *
 * Размеры сняты с макета и сверены в 010a; в 010b перенесены из CSS-модуля
 * в классы Tailwind. Тексты — из «Страниц сайта»: биография, путь, «как мы
 * работаем», команда и фото кухни — GET /pages/about; имя, роль, цитата, цифры
 * и портрет Елены — блок «Автор» главной; низ — «Кондитерская» и «Отзывы»
 * с главной и баннер «Опишите повод и дату».
 *
 * Заглушек в коде нет: пустое поле — блок не показывается и не оставляет дыры
 * в сетке. Нет фото кухни — список «Как мы работаем» на всю ширину; нет команды —
 * в «Команде» одна Елена; нет портрета — первый экран без фото. Ключ фото из сида
 * вида `placeholder/…` (фото ещё не загрузили) — бежевая плашка с подписью,
 * как у товаров.
 */

import Image from "next/image";
import { CtaBanner } from "@/components/cta-banner";
import { Bakery } from "@/components/home/bakery";
import { GuestReviews } from "@/components/home/guest-reviews";
import { Reveal, RevealGroup, RevealImage, RevealText } from "@/components/motion";
import { Breadcrumbs } from "@/components/ui";
import {
  apiGet,
  imageUrl,
  type AboutPage as AboutData,
  type ContactsPage,
  type HomePage,
  type Page,
  type Review,
} from "@/lib/api";
import { typograf } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "О нас",
  description:
    "Кондитерская Елены Абрикосовой на Гжатской: кто придумывает рецепты, из чего готовим и как работаем с заказами.",
  path: "/about",
});
export const revalidate = 300;

/** Заголовок секции страницы: Forum 58/64, на телефоне 36/42. */
const H2 = "text-[58px] leading-[64px] max-md:text-4xl max-md:leading-[42px]";
/** Подзаголовки пунктов «Путь» и «Как мы работаем» — Manrope, а не Forum. */
const ITEM_TITLE = "font-sans text-base leading-6 font-semibold";

function Photo({
  storageKey,
  label,
  priority = false,
  sizes,
  className,
}: {
  storageKey: string | null | undefined;
  label: string;
  priority?: boolean;
  sizes: string;
  className: string;
}) {
  const src = imageUrl(storageKey);
  return (
    <RevealImage className={`relative overflow-hidden bg-photo ${className}`}>
      {src ? (
        <Image
          src={src}
          alt={label}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      ) : (
        // Фото ещё не загрузили (ключ placeholder/… из сида) — плашка с подписью, как на макете
        <span className="grid h-full place-items-center p-4 text-center text-sm text-ink-subtle">
          {typograf(label)}
        </span>
      )}
    </RevealImage>
  );
}

export default async function AboutPage() {
  const [page, home, contacts, reviews] = await Promise.all([
    apiGet<AboutData>("/pages/about").catch(() => null),
    apiGet<HomePage>("/pages/home").catch(() => null),
    apiGet<ContactsPage>("/pages/contacts").catch(() => null),
    apiGet<Page<Review>>("/reviews?source=yandex&page_size=3").catch(() => null),
  ]);
  const content = page?.content;
  const author = home?.content.author;
  const name = author?.name ?? content?.title ?? "О нас";
  const portrait = author?.image_key ?? null;
  const biography = content?.biography ?? [];
  const timeline = content?.timeline ?? [];
  const workflow = content?.workflow ?? [];
  const workshop = content?.workshop_image_key ?? null;
  // Команду ещё не заполнили — в ней одна Елена из блока «Автор» главной
  const team =
    content?.team && content.team.length > 0
      ? content.team
      : author
        ? [{ name: author.name, role: author.role, image_key: author.image_key, placeholder: null }]
        : [];
  const banner = home?.content.order_banner;

  return (
    <div className="about-page public-page pt-[36px] max-md:pt-7">
      <div className="container-page">
        <Breadcrumbs items={[{ href: "/", label: "Главная" }, { label: "О нас" }]} />
        <section
          aria-labelledby="about-title"
          className={`mt-[26px] grid gap-24 max-xl:gap-10 max-md:grid-cols-1 max-md:gap-8 ${
            portrait ? "grid-cols-[576fr_744fr]" : "grid-cols-1"
          }`}
        >
          {portrait ? (
            <Photo
              storageKey={portrait}
              label={name}
              priority
              sizes="(min-width: 1280px) 576px, (min-width: 768px) 45vw, 100vw"
              className="aspect-[4/5] max-md:max-w-[576px]"
            />
          ) : null}
          <div className="-mt-[12px] max-xl:mt-0">
            <RevealText
              as="h1"
              id="about-title"
              className="text-[58px] leading-[64px] max-md:text-4xl max-md:leading-[42px]"
            >
              {name}
            </RevealText>
            {author?.role ? (
              <Reveal
                as="p"
                className="-mt-1 text-[17px] leading-6 text-ink-subtle max-md:mt-2 max-md:text-[15px]"
              >
                {author.role}
              </Reveal>
            ) : null}
            {author?.quote ? (
              <Reveal
                as="blockquote"
                className="mt-[48px] font-display text-[34px] leading-[46px] max-xl:mt-6 max-xl:text-[28px] max-xl:leading-9 max-md:text-[26px] max-md:leading-[34px]"
              >
                {author.quote}
              </Reveal>
            ) : null}
            {biography.length > 0 ? (
              <Reveal className="mt-[31px] max-w-[696px] space-y-[3px] text-lg leading-[30px] text-ink-muted max-xl:mt-6 max-xl:text-base max-xl:leading-[26px]">
                {biography.map((text, i) => (
                  <p key={i}>{text}</p>
                ))}
              </Reveal>
            ) : null}
            {author && author.stats.length > 0 ? (
              <RevealGroup
                as="dl"
                className="mt-[39px] grid max-w-[696px] grid-cols-3 border-t border-line pt-[34px] max-xl:gap-4 max-xl:pt-6 max-md:gap-3"
              >
                {author.stats.map((stat) => (
                  <div key={stat.label} className="flex flex-col-reverse justify-end">
                    <dt className="mt-1.5 text-sm leading-5 font-light text-ink-subtle max-md:text-xs max-md:leading-[18px]">
                      {typograf(stat.label)}
                    </dt>
                    <dd className="font-display text-[32px] leading-[37px] max-xl:text-[26px] max-xl:leading-[30px] max-md:text-[23px] max-md:leading-7">
                      {typograf(stat.value)}
                    </dd>
                  </div>
                ))}
              </RevealGroup>
            ) : null}
          </div>
        </section>

        {timeline.length > 0 ? (
          <section
            aria-labelledby="timeline-title"
            className="mt-[116px] max-xl:mt-20 max-md:mt-14"
          >
            <RevealText as="h2" id="timeline-title" className={H2}>
              Путь
            </RevealText>
            <RevealGroup
              as="ol"
              className="mt-[29px] grid grid-cols-4 gap-6 max-md:mt-6 max-md:grid-cols-2 max-md:gap-x-4 max-md:gap-y-7"
            >
              {timeline.map((item, i) => (
                <li key={`${item.year}-${i}`} className="border-t border-line pt-6">
                  <p className="font-display text-[40px] leading-[48px] text-accent">{item.year}</p>
                  <h3 className={`mt-[9px] max-md:mt-3 max-md:text-sm ${ITEM_TITLE}`}>
                    {typograf(item.title)}
                  </h3>
                  <p className="mt-1.5 text-[15px] leading-[26px] text-ink-muted max-md:text-sm max-md:leading-6">
                    {typograf(item.text)}
                  </p>
                </li>
              ))}
            </RevealGroup>
          </section>
        ) : null}

        {workflow.length > 0 ? (
          <section
            aria-labelledby="workflow-title"
            className={`mt-[110px] grid items-center gap-[72px] max-xl:mt-20 max-xl:gap-10 max-md:mt-14 max-md:grid-cols-1 max-md:gap-8 ${
              workshop ? "grid-cols-[696fr_648fr]" : "grid-cols-1"
            }`}
          >
            {workshop ? (
              <Photo
                storageKey={workshop}
                label="Кухня, Елена за работой"
                sizes="(min-width: 768px) 50vw, 100vw"
                className="aspect-[696/520]"
              />
            ) : null}
            {/* По макету текст на 9px ниже центра фото */}
            <div className={workshop ? "pt-[18px] max-md:pt-0" : ""}>
              <RevealText
                as="h2"
                id="workflow-title"
                className="text-[44px] leading-[50px] max-md:text-[32px] max-md:leading-[38px]"
              >
                Как мы работаем
              </RevealText>
              <RevealGroup as="ul" className="mt-6">
                {workflow.map((item, i) => (
                  <li key={i} className="border-t border-line py-[17px]">
                    <h3 className={ITEM_TITLE}>{typograf(item.title)}</h3>
                    <p className="mt-2 text-[15px] leading-6 text-ink-muted">
                      {typograf(item.text)}
                    </p>
                  </li>
                ))}
              </RevealGroup>
            </div>
          </section>
        ) : null}

        {team.length > 0 ? (
          <section aria-labelledby="team-title" className="mt-[132px] max-xl:mt-20 max-md:mt-14">
            <RevealText as="h2" id="team-title" className={H2}>
              Команда
            </RevealText>
            <RevealGroup
              as="ul"
              className="mt-[34px] grid grid-cols-4 gap-6 max-md:mt-6 max-md:grid-cols-2 max-md:gap-x-4 max-md:gap-y-7"
            >
              {team.map((member, i) => (
                <li key={i}>
                  <Photo
                    storageKey={member.image_key}
                    label={member.placeholder ?? member.name}
                    sizes="(min-width: 1024px) 25vw, 50vw"
                    className="aspect-[4/5]"
                  />
                  <h3 className="mt-4 text-[28px] leading-[34px] max-md:text-2xl max-md:leading-7">
                    {typograf(member.name)}
                  </h3>
                  <p className="mt-1.5 text-[15px] leading-6 text-ink-muted max-md:text-[13px] max-md:leading-5">
                    {typograf(member.role)}
                  </p>
                </li>
              ))}
            </RevealGroup>
          </section>
        ) : null}
      </div>

      {/* Секции главной; отступы — по макету этой страницы */}
      {contacts ? (
        <div className="[&>section]:pt-[253px] [&>section]:pb-[127px] max-xl:[&>section]:pt-[100px] max-xl:[&>section]:pb-[60px] max-md:[&>section]:pt-[72px] max-md:[&>section]:pb-10">
          <Bakery contacts={contacts} />
        </div>
      ) : null}
      {contacts ? (
        <div className="[&>section]:pt-[259px] [&>section]:pb-0 max-xl:[&>section]:pt-[60px] max-md:[&>section]:pt-10">
          <GuestReviews contacts={contacts} reviews={reviews?.items ?? []} />
        </div>
      ) : null}

      {banner ? (
        <section
          aria-labelledby="about-order-title"
          className="container-page pt-[254px] pb-[128px] max-xl:pt-[100px] max-xl:pb-20 max-md:pt-[72px] max-md:pb-14"
        >
          <CtaBanner
            id="about-order-title"
            title={banner.title}
            text={banner.text}
            href="/custom-cakes"
            label="Заказать торт"
          />
        </section>
      ) : null}
    </div>
  );
}
