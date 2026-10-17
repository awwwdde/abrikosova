/**
 * Страница дизайна торта на заказ по кадру «страница дизайна» custom-cakes.png (008c).
 *
 * Данные — `GET /custom-cakes/{slug}` (фото с ролями, таблица, ориентир для минимума
 * гостей, ближайшая дата, «Другие дизайны»), начинки — `/custom-cakes/fillings`.
 * Раскладка — как у товара: общая `PhotoGallery` (тот же лайтбокс), справа название,
 * гости, начинка, срок, ориентир и таблица. Неизвестный или выключенный дизайн —
 * настоящая 404 из middleware (как у товара), `notFound()` здесь — страховка.
 *
 * «Оставить заявку» открывает окно заявки этой же страницы (`?request=1&design=…`,
 * окно живёт в custom-cakes/layout.tsx).
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DesignCard } from "@/components/custom-cakes/design-card";
import { DesignOrder } from "@/components/custom-cakes/design-order";
import { JsonLd } from "@/components/json-ld";
import { Reveal, RevealGroup, RevealText } from "@/components/motion";
import { PhotoGallery } from "@/components/photo-gallery/gallery";
import { Breadcrumbs, LinkButton } from "@/components/ui";
import {
  ApiError,
  apiGet,
  formatPrice,
  imageUrl,
  type CakeFilling,
  type ContactsPage,
  type CustomCakeDetail,
} from "@/lib/api";
import { formatDesignMeta, typograf } from "@/lib/format";
import { breadcrumbJsonLd, designJsonLd } from "@/lib/json-ld";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;

type Params = Promise<{ slug: string }>;

async function loadDesign(slug: string): Promise<CustomCakeDetail | null> {
  try {
    return await apiGet<CustomCakeDetail>(`/custom-cakes/${encodeURIComponent(slug)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const design = await loadDesign((await params).slug);
  if (!design) return {};
  const meta = pageMetadata({
    title: `${design.title} — торт на заказ`,
    description:
      design.subtitle ??
      `${design.occasion_label}: ${formatDesignMeta(design.tiers, design.min_guests)}, ориентир от ${formatPrice(design.price_from)}.`,
    path: `/custom-cakes/${design.slug}`,
  });
  // OG-картинка — фото «Целиком» (или первое)
  const whole = design.images.find((image) => image.role === "whole") ?? design.images[0];
  const image = imageUrl(whole?.storage_key);
  return image ? { ...meta, openGraph: { ...meta.openGraph, images: [image] } } : meta;
}

const kg = (value: string) => `${Number(value).toLocaleString("ru-RU")} кг`;

export default async function DesignPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [design, fillings, contacts] = await Promise.all([
    loadDesign(slug),
    apiGet<CakeFilling[]>("/custom-cakes/fillings").catch(() => []),
    apiGet<ContactsPage>("/pages/contacts").catch(() => null),
  ]);
  if (!design) notFound();
  const telegram = contacts?.telegram_url;
  const crumbs = [
    { href: "/", label: "Главная" },
    { href: "/custom-cakes", label: "Торты на заказ" },
    { label: design.title },
  ];
  const specs = [
    [
      "Оформление",
      `${design.specs.decoration_label}, от ${formatPrice(design.specs.price_per_kg)}/кг`,
    ],
    ["Минимальный вес", kg(design.specs.min_weight_kg)],
    ["Ярусы", String(design.specs.tiers)],
    ["Начинка", design.specs.filling_note],
  ];

  return (
    <>
      <JsonLd data={[designJsonLd(design), breadcrumbJsonLd(crumbs)]} />
      <div className="design-page public-page container-page pt-8 pb-20 xl:pt-[41px] xl:pb-[128px]">
        <Breadcrumbs items={crumbs} />

        <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-12 xl:mt-[31px] xl:grid-cols-[688px_minmax(0,672px)] xl:gap-14">
          <PhotoGallery
            name={design.title}
            groupLabel="Фотографии дизайна"
            images={design.images.map((image, index) => ({
              key: `${index}-${image.storage_key}`,
              storageKey: image.storage_key,
              roleLabel: image.role_label ?? null,
            }))}
          />

          <div>
            <p className="text-caps font-semibold tracking-caps text-accent uppercase">
              {typograf(design.occasion_label)}
            </p>
            <h1 className="mt-[5px] font-display text-section leading-[48px] text-ink">
              {typograf(design.title)}
            </h1>
            {design.subtitle ? (
              <p className="mt-[9px] text-lg leading-6 text-ink-muted">
                {typograf(design.subtitle)}
              </p>
            ) : null}
            <hr className="mt-[34px] border-line" />

            <DesignOrder design={design} fillings={fillings} />

            <dl className="mt-[33px] border-t border-line text-[15px]">
              {specs.map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between gap-6 border-b border-line pt-[17px] pb-[16px] leading-5"
                >
                  <dt className="text-ink-subtle">{label}</dt>
                  <dd className="text-right text-ink">{typograf(value!)}</dd>
                </div>
              ))}
            </dl>

            {telegram ? (
              <div className="mt-[19px] text-[14px] leading-5">
                <p className="text-ink-muted">Хотите изменить дизайн?</p>
                <a
                  href={telegram}
                  className="mt-[8px] inline-block text-ink underline underline-offset-4 transition-colors hover:text-accent"
                >
                  Написать Елене в Telegram
                </a>
              </div>
            ) : null}
          </div>
        </div>

        {design.others.length > 0 ? (
          <section aria-labelledby="others-title" className="mt-20 xl:mt-[114px]">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <RevealText
                as="h2"
                id="others-title"
                className="font-display text-section leading-[1.1] text-ink"
              >
                Другие дизайны
              </RevealText>
              <Reveal>
                <LinkButton
                  href="/custom-cakes"
                  variant="outline"
                  size="md-tight"
                  className="w-[151px]"
                >
                  Все дизайны
                </LinkButton>
              </Reveal>
            </div>
            <RevealGroup
              as="ul"
              className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4 xl:mt-[48px]"
            >
              {design.others.map((card) => (
                <li key={card.id}>
                  <DesignCard card={card} />
                </li>
              ))}
            </RevealGroup>
          </section>
        ) : null}
      </div>
    </>
  );
}
