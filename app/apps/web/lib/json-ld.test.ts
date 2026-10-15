import { describe, expect, it } from "vitest";
import type { ContactsPage, CustomCakeCard, ProductDetail } from "./api";
import {
  designsJsonLd,
  bakeryJsonLd,
  breadcrumbJsonLd,
  jsonLdHtml,
  openingHours,
  productJsonLd,
  websiteJsonLd,
} from "./json-ld";

// Контакты как в сиде: часы без времени закрытия, ВКонтакте — заглушка
const CONTACTS = {
  page_key: "contacts",
  address: "Гжатская улица, 5к8",
  phone: "8-962-352-22-77",
  work_hours_weekdays: "Каждый день с 9:00",
  work_hours_weekend: null,
  delivery_hours: "доставка 09:00–21:00",
  yandex_rating: "5.0",
  yandex_reviews_count: 169,
  yandex_maps_url: "https://yandex.ru/maps/org/konditerskaya_ye_abrikosovoy/160020775716/reviews/",
  telegram_url: "https://t.me/abricosova_elena",
  content: {
    route_url: "https://yandex.ru/maps/org/konditerskaya_ye_abrikosovoy/160020775716/",
    socials: [
      { label: "Телеграм", href: "https://t.me/abricosova_elena" },
      { label: "ВКонтакте", href: "https://vk.com/" },
    ],
  },
} as unknown as ContactsPage;

describe("Bakery на главной", () => {
  const data = bakeryJsonLd(CONTACTS);

  it("обязательные поля", () => {
    expect(data["@type"]).toBe("Bakery");
    expect(data.name).toBe("Кондитерская Елены Абрикосовой");
    expect(data.url).toMatch(/^https?:\/\/.+\/$/);
    expect(data.logo).toMatch(/\/brand\/logo\.png$/);
    expect(data.telephone).toBe("+79623522277");
    expect(data.address).toEqual({
      "@type": "PostalAddress",
      streetAddress: "Гжатская улица, 5к8",
      addressLocality: "Москва",
      addressCountry: "RU",
    });
    expect(data.priceRange).toBe("₽₽");
  });

  it("без aggregateRating: самопубликуемые оценки поисковики запрещают", () => {
    expect(JSON.stringify(data)).not.toContain("aggregateRating");
    expect(JSON.stringify(data)).not.toContain("ratingValue");
  });

  it("sameAs без заглушек и повторов; без часов закрытия и координат — полей нет", () => {
    expect(data.sameAs).toEqual([
      "https://t.me/abricosova_elena",
      "https://yandex.ru/maps/org/konditerskaya_ye_abrikosovoy/160020775716/",
    ]);
    expect(data).not.toHaveProperty("openingHoursSpecification");
    expect(data).not.toHaveProperty("geo");
  });

  it("координаты из контактов — в geo", () => {
    const withGeo = bakeryJsonLd({
      ...CONTACTS,
      content: { ...CONTACTS.content, geo: { latitude: 55.7155, longitude: 37.4339 } },
    } as ContactsPage);
    expect(withGeo.geo).toEqual({
      "@type": "GeoCoordinates",
      latitude: 55.7155,
      longitude: 37.4339,
    });
  });

  it("WebSite ссылается на организацию", () => {
    expect(websiteJsonLd()).toMatchObject({
      "@type": "WebSite",
      publisher: { "@id": data["@id"] },
    });
  });
});

describe("часы работы", () => {
  it("разбирает распространённые записи", () => {
    expect(openingHours("Каждый день 9:00–21:00")).toEqual([
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        opens: "09:00",
        closes: "21:00",
      },
    ]);
    expect(openingHours("Пн–Пт: 10:00 до 20:00", "Сб–Вс 11.00-18.00")).toEqual([
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "10:00",
        closes: "20:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Saturday", "Sunday"],
        opens: "11:00",
        closes: "18:00",
      },
    ]);
  });

  it("без времени закрытия — ничего не выдумывает", () => {
    expect(openingHours("Каждый день с 9:00")).toEqual([]);
  });
});

describe("товар и крошки", () => {
  const product = {
    name: "Медовик",
    slug: "medovik",
    description: "Тонкие медовые коржи",
    variants: [{ id: 1, label: "100 г", price: "480.00" }],
    is_available: true,
    lead_time_days: 2,
    images: [
      {
        id: 1,
        storage_key: "products/1/0123456789abcdef0123456789abcdef.webp",
        is_main: true,
        order: 0,
      },
    ],
    subcategory: { name: "Классика", slug: "klassika" },
  } as unknown as ProductDetail;

  it("Offer: цена, рубли, наличие по тем же правилам, что метки", () => {
    const data = productJsonLd(product);
    expect(data).toMatchObject({
      "@type": "Product",
      name: "Медовик",
      offers: {
        "@type": "Offer",
        price: "480.00",
        priceCurrency: "RUB",
        availability: "https://schema.org/PreOrder",
      },
    });
    expect((data.image as string[])[0]).toMatch(/^https?:\/\/.+\.webp$/);
    expect(productJsonLd({ ...product, lead_time_days: 0 }).offers).toMatchObject({
      availability: "https://schema.org/InStock",
    });
    expect(productJsonLd({ ...product, is_available: false }).offers).toMatchObject({
      availability: "https://schema.org/OutOfStock",
    });
  });

  it("несколько весов с разной ценой — AggregateOffer с диапазоном", () => {
    const whole = {
      ...product,
      variants: [
        { id: 1, label: "1 кг", price: "2400.00" },
        { id: 2, label: "2 кг", price: "4800.00" },
      ],
    } as unknown as ProductDetail;
    expect(productJsonLd(whole).offers).toMatchObject({
      "@type": "AggregateOffer",
      lowPrice: "2400.00",
      highPrice: "4800.00",
      offerCount: 2,
      priceCurrency: "RUB",
    });
  });

  it("BreadcrumbList: позиции и абсолютные адреса", () => {
    const data = breadcrumbJsonLd([
      { href: "/", label: "Главная" },
      { href: "/catalog", label: "Каталог" },
      { label: "Медовик" },
    ]);
    const items = data.itemListElement as Record<string, unknown>[];
    expect(items.map((item) => item.position)).toEqual([1, 2, 3]);
    expect(items[1]!.item).toMatch(/^https?:\/\/.+\/catalog$/);
    expect(items[2]).not.toHaveProperty("item");
  });

  it("«<» из текста админки не закрывает тег script", () => {
    expect(jsonLdHtml({ text: "</script><script>alert(1)</script>" })).not.toContain("</script>");
  });
});

describe("дизайны тортов на заказ (008b)", () => {
  it("ItemList: название, адрес дизайна, обложка; без цены", () => {
    const card = {
      id: 1,
      slug: "belyy-s-pionami",
      title: "Белый с пионами",
      image_key: "custom-cakes/a.webp",
      price_from: 27000,
    } as CustomCakeCard;
    const data = designsJsonLd([card, { ...card, slug: "kosmos", image_key: null }]);
    const items = data.itemListElement as Record<string, unknown>[];
    expect(data["@type"]).toBe("ItemList");
    expect(items[0]).toMatchObject({ position: 1, name: "Белый с пионами" });
    expect(String(items[0]!.url)).toMatch(/\/custom-cakes\/belyy-s-pionami$/);
    expect(String(items[0]!.image)).toMatch(/custom-cakes\/a\.webp$/);
    expect(items[1]).not.toHaveProperty("image");
    expect(JSON.stringify(data)).not.toContain("27000");
  });
});
