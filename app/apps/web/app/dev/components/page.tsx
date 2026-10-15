/**
 * Витрина компонентов — только для разработки (на проде 404).
 *
 * Все компоненты и состояния с new/design/components.png на светлом фоне
 * сайта и, где на макете есть вариант, на тёмном. Hover и нажатие показаны
 * статически через `forceState`. Блоки помечены `data-shot` — по ним
 * Playwright снимает скриншоты для сравнения с макетом (tasks/003-screens).
 */

import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AdminKitShowcase } from "@/components/admin/ui/showcase";
import { Carousel, EndTile } from "@/components/carousel";
import { Header } from "@/components/layout";
import { ProductCard } from "@/components/product-card";
import {
  ArrowButton,
  Button,
  Chip,
  LinkButton,
  PlusButton,
  SectionHeader,
  Tag,
} from "@/components/ui";
import { SubcategoryPills, type Pill } from "@/app/(public)/catalog/subcategory-pills";
import { WorkCard } from "@/components/work-card";
import type { ProductListItem } from "@/lib/api";

export const metadata = { title: "Компоненты", robots: { index: false } };

const PHONE = "8-962-352-22-77";

type Variant = ProductListItem["variants"][number];

/** Единственный вариант товара: у пирожного он один («100 г»). */
function only(price: string, weight: number | null, portions?: [number, number]): Variant[] {
  return [
    {
      id: 0,
      label: weight ? `${weight} г` : "Стандарт",
      price,
      weight_grams: weight,
      portions_min: portions?.[0] ?? null,
      portions_max: portions?.[1] ?? null,
    },
  ];
}

function product(overrides: Partial<ProductListItem>): ProductListItem {
  const variants = overrides.variants ?? only("480.00", 100);
  return {
    id: 0,
    name: "Медовик",
    slug: "tort-medovik",
    price_from: variants[0]!.price,
    has_variants: variants.length > 1,
    variants,
    is_available: true,
    tags: [],
    dietary: [],
    occasions: [],
    recipients: [],
    allows_inscription: false,
    card_ingredients: "мука, сметана, мёд, сгущёнка, сливочное масло",
    lead_time_days: 0,
    sold_out_today: false,
    subcategory: { name: "Классика", slug: "klassika" },
    card_label: null,
    main_image: null,
    ...overrides,
  };
}

const PRODUCTS = [
  { item: product({ id: -1 }), subcategory: "классика" },
  {
    item: product({
      id: -2,
      name: "Смородина-жасмин",
      variants: only("550.00", 100),
      card_ingredients: "сливки, смородина, жасмин, белый шоколад",
      dietary: ["gluten_free"],
      card_label: "современные десерты",
    }),
    subcategory: "современные десерты",
  },
  {
    item: product({
      id: -3,
      name: "Прага",
      variants: only("680.00", 120),
      card_ingredients: "мука, какао, сгущёнка, сливочное масло, яйцо",
    }),
    subcategory: "классика",
  },
  {
    item: product({
      id: -4,
      name: "Абрикосовый пирог",
      variants: only("3400.00", 1200, [10, 12]),
      card_ingredients: "мука, абрикос, сливочное масло, сахар, яйцо",
      dietary: ["low_sugar", "lactose_free"],
      lead_time_days: 1,
      card_label: "фирменная позиция",
    }),
    subcategory: "фирменная позиция",
  },
  {
    item: product({
      id: -5,
      name: "Наполеон",
      variants: only("580.00", 120),
      card_ingredients: "мука, сливочное масло, молоко, яйцо",
      lead_time_days: 3,
    }),
    subcategory: "классика",
  },
  {
    // Два веса с разной ценой — «1–2 кг», «от 2 400 ₽» (005a)
    item: product({
      id: -6,
      name: "Медовик целый",
      price_from: "2400.00",
      has_variants: true,
      variants: [
        {
          id: 0,
          label: "1 кг",
          price: "2400.00",
          weight_grams: 1000,
          portions_min: 8,
          portions_max: 10,
        },
        {
          id: 0,
          label: "2 кг",
          price: "4800.00",
          weight_grams: 2000,
          portions_min: 16,
          portions_max: 20,
        },
      ],
      subcategory: { name: "Классические", slug: "klassicheskie" },
    }),
    subcategory: "классические",
  },
] as const;

const [MEDOVIK, SMORODINA, PRAGA, PIROG, NAPOLEON, MEDOVIK_WHOLE] = PRODUCTS;

const WORKS = [
  {
    title: "Белый с пионами",
    occasion: "wedding",
    madeIn: "2025-08-01",
    tiers: 3,
    weightGrams: 6000,
    guests: 45,
  },
  {
    title: "Шоколад и вишня",
    occasion: "birthday",
    madeIn: "2026-03-01",
    tiers: 2,
    weightGrams: 3000,
    guests: 20,
  },
  {
    title: "Лисёнок",
    occasion: "birthday",
    madeIn: "2026-06-01",
    tiers: 1,
    weightGrams: 1800,
    guests: 12,
  },
  {
    title: "Розовый сад",
    occasion: "wedding",
    madeIn: "2026-05-01",
    tiers: 2,
    weightGrams: 4000,
    guests: 30,
  },
] as const;

const [WHITE_PEONIES, CHERRY] = WORKS;

/**
 * Образцы шкалы кеглей: те же строки, что на макете, и ширина их «чернил»
 * на home-1512.png / components.png. По ним кегли сверяются в браузере —
 * отрисовка Pillow, которой снимались первые замеры, уже браузерной на ~4%.
 */
const TYPE_SAMPLES = [
  { name: "hero", mock: 591, text: "Торты и десерты", className: "font-display text-hero" },
  { name: "section", mock: 356, text: "Готово сегодня", className: "font-display text-section" },
  { name: "item", mock: 268, text: "Абрикосовый пирог", className: "font-display text-item" },
  { name: "work-title", mock: 228, text: "Белый с пионами", className: "font-display text-item" },
  {
    name: "lead",
    mock: 458,
    text: "Готовим для вас как для себя и своей семьи.",
    className: "text-lead font-light",
  },
  {
    name: "subtitle",
    mock: 773,
    text: "Витрина обновляется каждое утро. Забрать на Гжатской или привезём по Москве",
    className: "text-subtitle font-light text-ink-muted",
  },
  { name: "nav", mock: 77, text: "Контакты", className: "text-nav" },
  { name: "phone", mock: 143, text: "+7 962 352-22-77", className: "text-nav" },
  { name: "cart", mock: 63, text: "Корзина", className: "text-base" },
  {
    name: "composition",
    mock: 318,
    text: "мука, сметана, мёд, сгущёнка, сливочное масло",
    className: "text-meta text-ink-muted",
  },
  {
    name: "meta",
    mock: 278,
    text: "фирменная позиция · 1200 г · 10–12 порций",
    className: "text-meta font-light text-ink-subtle",
  },
  {
    name: "work-meta",
    mock: 155,
    text: "3 яруса · 6 кг · 45 гостей",
    className: "text-meta font-light text-ink-muted",
  },
  { name: "price", mock: 65, text: "480 ₽", className: "text-price font-bold tracking-price" },
  {
    name: "caps",
    mock: 183,
    text: "Свадьба · август 2025",
    className: "text-caps font-semibold tracking-caps text-accent uppercase",
  },
  {
    name: "tag",
    mock: 130,
    text: "Сниженный сахар",
    className: "text-tag font-medium tracking-tag text-accent uppercase",
  },
  {
    name: "marquee",
    mock: 220,
    text: "Корпусные десерты",
    className: "text-marquee tracking-marquee uppercase",
  },
  { name: "button-lg", mock: 184, text: "Открыть витрину", className: "text-button-lg uppercase" },
  { name: "button-md", mock: 98, text: "Вся витрина", className: "text-button font-semibold" },
  {
    name: "button-header",
    mock: 121,
    text: "Заказать торт",
    className: "text-[1.03125rem] font-light uppercase",
  },
  {
    name: "tile",
    mock: 335,
    text: "Смотреть все работы",
    className: "font-display text-[2.375rem]",
  },
  { name: "tile-hover", mock: 247, text: "Все 25 работ", className: "font-display text-[3rem]" },
  {
    name: "ready-in",
    mock: 100,
    text: "Будет завтра",
    className: "text-caps font-medium tracking-ready text-ink-subtle uppercase",
  },
];

const DESSERT_PILLS: Pill[] = [
  ["Все десерты", null],
  ["Классика", "klassika"],
  ["Современные", "sovremennye"],
  ["Корпусные", "korpusnye"],
  ["Муссовые", "mussovye"],
  ["Чизкейки", "chizkeyki"],
  ["Трайфлы", "trayfly"],
  ["Макарон", "makaron"],
  ["Капкейки", "kapkeyki"],
  ["Кейкпопсы", "keykpopsy"],
].map(([name, slug]) => ({
  name: name!,
  slug: slug ?? null,
  href: `/catalog/deserty${slug ? `/${slug}` : ""}`,
}));

function Block({
  title,
  dark = false,
  shot,
  children,
}: {
  title: string;
  dark?: boolean;
  shot?: string;
  children: ReactNode;
}) {
  return (
    <section className={`py-12 ${dark ? "bg-night text-canvas" : ""}`} data-shot={shot}>
      <div className="container-page">
        <p className={`mb-6 text-sm ${dark ? "text-line" : "text-ink-muted"}`}>{title}</p>
        {children}
      </div>
    </section>
  );
}

function Swatch({ name, value, className }: { name: string; value: string; className: string }) {
  return (
    <div className="w-40">
      <div className={`h-16 border border-line ${className}`} />
      <p className="mt-2 text-sm">{name}</p>
      <p className="tnum text-xs text-ink-muted uppercase">{value}</p>
    </div>
  );
}

export default function ComponentsPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="pb-24">
      {/* Шапки: каждая в своей полосе, как на components.png */}
      <div data-shot="header-transparent" className="bg-night">
        <Header phone={PHONE} variant="transparent" isStatic />
      </div>
      <div data-shot="header-accent">
        <Header phone={PHONE} variant="accent" compact isStatic />
      </div>
      <div data-shot="header-light">
        <Header phone={PHONE} variant="light" isStatic />
      </div>
      {/* Компактная шапка после прокрутки: 118px, как бордовая полоса на макете */}
      <div data-shot="header-light-compact">
        <Header phone={PHONE} variant="light" compact isStatic />
      </div>

      <Block title="Цвета">
        <div className="flex flex-wrap gap-6">
          <Swatch name="canvas / cream" value="#FBF7F0" className="bg-canvas" />
          <Swatch name="photo" value="#F2ECE1" className="bg-photo" />
          <Swatch name="accent" value="#842124" className="bg-accent" />
          <Swatch name="accent-pressed" value="#6E1B1E" className="bg-accent-pressed" />
          <Swatch name="on-accent" value="#F3E5C8" className="bg-on-accent" />
          <Swatch name="ink / night" value="#1A1210" className="bg-ink" />
          <Swatch name="ink-muted" value="#5A524F" className="bg-ink-muted" />
          <Swatch name="ink-subtle" value="#918F8B" className="bg-ink-subtle" />
          <Swatch name="line" value="#E5DCCB" className="bg-line" />
        </div>
      </Block>

      <Block title="Шкала кеглей — строки из макета; data-mock — ширина «чернил» на home-1512.png, px">
        <div className="flex flex-col items-start gap-5" data-shot="type-scale">
          {TYPE_SAMPLES.map((sample) => (
            <p
              key={sample.name}
              data-sample={sample.name}
              data-mock={sample.mock}
              className={`w-fit ${sample.className}`}
            >
              {sample.text}
            </p>
          ))}
        </div>
      </Block>

      <Block
        title="Кнопки: большая (304×74) — бордо на светлом, кремовая на тёмном"
        shot="buttons-lg"
      >
        <div className="flex flex-wrap gap-6">
          <Button variant="primary" size="lg">
            Открыть витрину
          </Button>
          <Button variant="primary" size="lg" forceState="hover">
            Открыть витрину
          </Button>
        </div>
      </Block>
      <Block title="Кремовая кнопка на тёмном фоне" dark>
        <div className="flex flex-wrap gap-6">
          <Button variant="primary" size="lg">
            Открыть витрину
          </Button>
          <Button variant="cream" size="lg">
            Открыть витрину
          </Button>
        </div>
      </Block>

      <Block title="Кнопка средняя (182×52): обычная · hover · нажата">
        <div className="flex flex-wrap gap-6">
          <LinkButton href="/catalog" variant="outline" size="md">
            Вся витрина
          </LinkButton>
          <LinkButton href="/catalog" variant="outline" size="md" forceState="hover">
            Вся витрина
          </LinkButton>
          <LinkButton href="/catalog" variant="outline" size="md" forceState="pressed">
            Вся витрина
          </LinkButton>
        </div>
      </Block>
      <Block title="Кнопка средняя на тёмном фоне: обычная · hover · нажата" dark>
        <div className="flex flex-wrap gap-6">
          <LinkButton href="/catalog" variant="outline-dark" size="md">
            Вся витрина
          </LinkButton>
          <LinkButton href="/catalog" variant="outline-dark" size="md" forceState="hover">
            Вся витрина
          </LinkButton>
          <LinkButton href="/catalog" variant="outline-dark" size="md" forceState="pressed">
            Вся витрина
          </LinkButton>
        </div>
      </Block>

      <Block title="«+» в карточке: обычная · hover · в корзине; стрелки: обычная · неактивная · hover">
        <div className="flex flex-wrap items-center gap-10">
          <div className="flex items-center gap-3">
            <PlusButton aria-label="Добавить" />
            <PlusButton aria-label="Добавить" forceState="hover" />
            <PlusButton aria-label="В корзине" added />
          </div>
          <div className="flex items-center gap-3">
            <ArrowButton direction="prev" />
            <ArrowButton direction="prev" disabled />
            <ArrowButton direction="prev" forceState="hover" />
            <ArrowButton direction="next" />
            <ArrowButton direction="next" disabled />
            <ArrowButton direction="next" forceState="hover" />
          </div>
        </div>
      </Block>
      <Block title="Стрелки на тёмном фоне: обычная · неактивная · hover" dark>
        <div className="flex items-center gap-3">
          <ArrowButton direction="prev" tone="dark" />
          <ArrowButton direction="prev" tone="dark" disabled />
          <ArrowButton direction="prev" tone="dark" forceState="hover" />
          <ArrowButton direction="next" tone="dark" forceState="hover" />
          <ArrowButton direction="next" tone="dark" disabled />
          <ArrowButton direction="next" tone="dark" />
        </div>
      </Block>

      <Block title="Метки ограничений и чипы фильтра: пустой · наведён · нажат · выбран">
        <div className="flex flex-wrap items-center gap-4">
          <Tag>Без глютена</Tag>
          <Tag>Без лактозы</Tag>
          <Tag>Сниженный сахар</Tag>
          <Tag>Детский</Tag>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Chip>Текст</Chip>
          <Chip forceState="hover">Текст</Chip>
          <Chip forceState="pressed">Текст</Chip>
          <Chip selected>Текст</Chip>
        </div>
      </Block>

      <Block
        title="Карточка товара: обычная · hover · в корзине · будет завтра · через 3 дня · два веса"
        shot="product-cards"
      >
        <div className="grid grid-cols-[repeat(auto-fill,336px)] gap-6">
          <ProductCard product={MEDOVIK.item} />
          <ProductCard product={SMORODINA.item} forceState="hover" />
          <ProductCard product={PRAGA.item} forceState="in-cart" />
          <ProductCard product={PIROG.item} />
          <ProductCard product={NAPOLEON.item} />
          <ProductCard product={MEDOVIK_WHOLE.item} />
        </div>
      </Block>

      <Block
        title="Карточка работы: обычная · hover; плитка-концовка: обычная · hover"
        shot="work-cards"
      >
        <div className="grid grid-cols-[repeat(auto-fill,456px)] gap-6">
          <WorkCard image={null} {...WHITE_PEONIES} />
          <WorkCard image={null} {...CHERRY} forceState="hover" />
          <EndTile href="/gallery" total={25} />
          <EndTile href="/gallery" total={25} forceState="hover" />
        </div>
      </Block>

      {/* «Ещё» в «таблетках» (006b): подразделы «Десертов» с макета catalog.png
          (120, 10896). На странице каталога при 1512 строка шире, и «Ещё» там не
          нужно — здесь ширина урезана до той, при которой в макете уходят
          «Капкейки» и «Кейкпопсы» */}
      <Block
        title="«Таблетки» с «Ещё»: обычная строка · выбран подраздел из «Ещё»"
        shot="pills-more"
      >
        <div className="flex flex-col gap-[120px]">
          <div className="w-[1060px]" data-pills="default">
            <SubcategoryPills label="Подразделы: Десерты" items={DESSERT_PILLS} active={null} />
          </div>
          <div className="w-[1060px]" data-pills="selected">
            <SubcategoryPills
              label="Подразделы: Десерты (выбран)"
              items={DESSERT_PILLS}
              active="keykpopsy"
            />
          </div>
        </div>
      </Block>

      <Block title="Заголовок секции без карусели">
        <SectionHeader
          title="Готово сегодня"
          subtitle="Витрина обновляется каждое утро. Забрать на Гжатской или привезём по Москве"
          controls={
            <>
              <ArrowButton direction="prev" />
              <ArrowButton direction="next" />
            </>
          }
          action={
            <LinkButton href="/catalog" variant="outline" size="md">
              Вся витрина
            </LinkButton>
          }
        />
      </Block>

      <div className="container-page py-12" data-shot="carousel-products">
        <Carousel
          title="Готово сегодня"
          subtitle="Витрина обновляется каждое утро. Забрать на Гжатской или привезём по Москве"
          itemClassName="w-[80vw] sm:w-[336px]"
          action={
            <LinkButton href="/catalog" variant="outline" size="md">
              Вся витрина
            </LinkButton>
          }
        >
          {[...PRODUCTS, ...PRODUCTS].map(({ item }, index) => (
            <ProductCard key={index} product={{ ...item, id: -100 - index }} />
          ))}
        </Carousel>
      </div>

      <div className="container-page py-12" data-shot="carousel-works">
        <Carousel
          title="Сделано на заказ"
          subtitle="Каждый торт Елена собирает под дату и повод. Под фото указано, на сколько гостей он был рассчитан."
          itemClassName="w-[85vw] sm:w-[456px]"
          action={
            <LinkButton href="/gallery" variant="outline" size="md">
              Посмотреть все работы
            </LinkButton>
          }
        >
          {[
            ...WORKS.map((work) => <WorkCard key={work.title} image={null} {...work} />),
            <EndTile key="end" href="/gallery" total={25} />,
          ]}
        </Carousel>
      </div>

      <Block title="Админка — UI-кит (задание 011b, концепт new/design/admin/)" shot="admin-kit">
        <AdminKitShowcase />
      </Block>
    </div>
  );
}
