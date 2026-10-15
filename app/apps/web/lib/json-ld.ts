/**
 * Структурированные данные schema.org (задание 012). Чистые функции — тесты в
 * json-ld.test.ts; в разметку их выводит components/json-ld.tsx.
 *
 * Чего здесь нет намеренно: `aggregateRating` по отзывам Яндекса. Оценки,
 * которые организация публикует о себе сама, поисковики считают
 * «самопубликуемыми» и за них бывают санкции. Координат и часов закрытия тоже
 * не выдумываем: если в контактах их нет, поле просто не выводится.
 */

import {
  type ContactsPage,
  type CustomCakeCard,
  type CustomCakeDetail,
  type FaqItem,
  imageUrl,
  type ProductDetail,
} from "./api";
import { formatPhone } from "./format";
import { availabilityOf } from "./product-form";
import { absoluteUrl, SITE_NAME, SITE_URL } from "./seo";

type Thing = Record<string, unknown>;

/** JSON для <script type="application/ld+json">: «<» экранируется, иначе текст из админки закрыл бы тег. */
export function jsonLdHtml(data: Thing | Thing[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

// --- Часы работы -----------------------------------------------------------

const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const WEEKDAYS = ALL_DAYS.slice(0, 5);
const WEEKEND = ALL_DAYS.slice(5);

function hours(text: string): { opens: string; closes: string } | null {
  const match = text.match(/(\d{1,2})[:.](\d{2})\s*(?:–|—|-|до)\s*(\d{1,2})[:.](\d{2})/i);
  if (!match) return null;
  const pad = (value: string) => value.padStart(2, "0");
  return { opens: `${pad(match[1]!)}:${match[2]}`, closes: `${pad(match[3]!)}:${match[4]}` };
}

function days(text: string, fallback: string[]): string[] {
  if (/кажд|ежедневн|без выходн/i.test(text)) return ALL_DAYS;
  if (/пн\s*[–—-]\s*пт|будн/i.test(text)) return WEEKDAYS;
  if (/сб\s*[–—-]\s*вс|выходн/i.test(text)) return WEEKEND;
  return fallback;
}

/**
 * «Каждый день 9:00–21:00», «Пн–Пт: 10:00 до 20:00» → openingHoursSpecification.
 * Строка без времени закрытия («Каждый день с 9:00») не даёт ничего: часы с
 * выдуманным закрытием в поиске хуже, чем никаких.
 */
export function openingHours(weekdays?: string | null, weekend?: string | null): Thing[] {
  const result: Thing[] = [];
  const add = (text: string | null | undefined, fallback: string[]) => {
    const time = text ? hours(text) : null;
    if (!text || !time) return;
    result.push({ "@type": "OpeningHoursSpecification", dayOfWeek: days(text, fallback), ...time });
  };
  // Без отдельной строки выходных будничная описывает всю неделю
  add(weekdays, weekend ? WEEKDAYS : ALL_DAYS);
  add(weekend, WEEKEND);
  return result;
}

// --- Организация и сайт ------------------------------------------------------

/** Ссылка-заглушка «https://vk.com/» (адреса ещё нет) — не профиль, в sameAs не идёт. */
function isProfileUrl(href: string | null | undefined): href is string {
  if (!href) return false;
  try {
    return new URL(href).pathname.replace(/\/+$/, "") !== "";
  } catch {
    return false;
  }
}

export function bakeryJsonLd(contacts: ContactsPage | null): Thing {
  const content = contacts?.content;
  const sameAs = [
    contacts?.telegram_url,
    ...(content?.socials ?? []).map((social) => social.href),
    content?.route_url,
  ].filter(isProfileUrl);
  const hoursSpec = openingHours(contacts?.work_hours_weekdays, contacts?.work_hours_weekend);
  const geo = content?.geo;

  return {
    "@context": "https://schema.org",
    "@type": "Bakery",
    "@id": `${SITE_URL}/#bakery`,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    logo: absoluteUrl("/brand/logo.png"),
    image: absoluteUrl("/opengraph-image"),
    ...(contacts?.phone ? { telephone: formatPhone(contacts.phone).href.replace("tel:", "") } : {}),
    ...(contacts?.address
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: contacts.address,
            // Кондитерская одна и в Москве — город в адресе админки не пишут
            addressLocality: "Москва",
            addressCountry: "RU",
          },
        }
      : {}),
    ...(geo
      ? { geo: { "@type": "GeoCoordinates", latitude: geo.latitude, longitude: geo.longitude } }
      : {}),
    ...(hoursSpec.length ? { openingHoursSpecification: hoursSpec } : {}),
    ...(sameAs.length ? { sameAs: [...new Set(sameAs)] } : {}),
    servesCuisine: "Кондитерские изделия",
    priceRange: "₽₽",
  };
}

export function websiteJsonLd(): Thing {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    inLanguage: "ru",
    publisher: { "@id": `${SITE_URL}/#bakery` },
  };
}

export function faqJsonLd(items: FaqItem[]): Thing {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/**
 * Сетка дизайнов «Тортов на заказ» (008b): только то, что видно на странице —
 * название, адрес дизайна и обложка. Цену не размечаем: «от X ₽» — ориентир,
 * а не цена предложения.
 */
export function designsJsonLd(cards: CustomCakeCard[]): Thing {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: cards.map((card, index) => {
      const image = imageUrl(card.image_key);
      return {
        "@type": "ListItem",
        position: index + 1,
        name: card.title,
        url: absoluteUrl(`/custom-cakes/${card.slug}`),
        ...(image ? { image } : {}),
      };
    }),
  };
}

/**
 * Страница дизайна торта на заказ (008c): `CreativeWork`, а не `Product`. Дизайн —
 * образец, по которому Елена собирает торт под заказ; цены у него нет («от X ₽» —
 * ориентир), а `Product` без `offers` поисковики помечают ошибкой разметки.
 */
export function designJsonLd(design: CustomCakeDetail): Thing {
  const images = design.images
    .map((image) => imageUrl(image.storage_key))
    .filter((url): url is string => Boolean(url));
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: design.title,
    ...(design.subtitle ? { description: design.subtitle } : {}),
    url: absoluteUrl(`/custom-cakes/${design.slug}`),
    genre: design.occasion_label,
    ...(images.length ? { image: images } : {}),
    creator: { "@id": `${SITE_URL}/#bakery` },
  };
}

export function breadcrumbJsonLd(items: { href?: string; label: string }[]): Thing {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      // У последней крошки (текущая страница) адреса может не быть — schema.org это допускает
      ...(item.href ? { item: absoluteUrl(item.href) } : {}),
    })),
  };
}

// --- Товар -------------------------------------------------------------------

const AVAILABILITY = {
  today: "https://schema.org/InStock",
  preorder: "https://schema.org/PreOrder",
  out: "https://schema.org/OutOfStock",
} as const;

function offerPrice(prices: number[]): Thing {
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  if (low === high) return { "@type": "Offer", price: low.toFixed(2) };
  return {
    "@type": "AggregateOffer",
    lowPrice: low.toFixed(2),
    highPrice: high.toFixed(2),
    offerCount: prices.length,
  };
}

/** Product + Offer. Наличие — по тем же правилам, что метки в карточке и админке. */
export function productJsonLd(product: ProductDetail): Thing {
  const images = product.images
    .map((image) => imageUrl(image.storage_key))
    .filter((url): url is string => Boolean(url))
    .map(absoluteUrl);
  const url = absoluteUrl(`/product/${product.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.slug,
    url,
    ...(images.length ? { image: images } : {}),
    category: product.subcategory.name,
    brand: { "@type": "Brand", name: SITE_NAME },
    // Несколько весов с разной ценой — AggregateOffer с диапазоном (005a)
    offers: {
      ...offerPrice(product.variants.map((variant) => Number(variant.price))),
      url,
      priceCurrency: "RUB",
      availability: AVAILABILITY[availabilityOf(product)],
      seller: { "@id": `${SITE_URL}/#bakery` },
    },
  };
}
