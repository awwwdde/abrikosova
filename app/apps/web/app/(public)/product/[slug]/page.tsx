/**
 * Страница товара по макету 09.10 new/design/pages/product.png (006, 006b): торт
 * готовый сегодня (f0-1), торт под заказ (f1-1), «закончилось сегодня» (f2-1),
 * пирожное (f3-1). Служебные подписи состояний над правой колонкой в макете
 * («Торт, готово сегодня», «Пирожное») на сайт не выводятся.
 *
 * Сервер рисует всё, что видно без JS: крошки, фото, название, цену выбранного
 * веса, срок, состав. Выбор веса, надпись, количество и «В корзину» — клиентский
 * `BuyBox`; галерея — общая `PhotoGallery`; раскрывающиеся блоки — `ProductDetails`.
 *
 * Выбранный вес — в адресе `?v=<id варианта>`: по ссылке открывается тот же вес.
 * Канонический адрес — без параметра: это та же страница товара.
 *
 * Строки «Самовывоз» / «Доставка» и блок «Доставка, самовывоз и оплата» — из
 * контента контактов («Страницы сайта» в админке): цифр доставки в коде нет.
 */

import { notFound } from "next/navigation";
import { Carousel } from "@/components/carousel";
import { JsonLd } from "@/components/json-ld";
import { PhotoGallery } from "@/components/photo-gallery/gallery";
import { ProductCard } from "@/components/product-card";
import { Breadcrumbs, LinkButton, Tag } from "@/components/ui";
import {
  ApiError,
  DIETARY_LABELS,
  IMAGE_ROLE_LABELS,
  TAG_LABELS,
  apiGet,
  formatPrice,
  type ContactsPage,
  type Page,
  type ProductDetail,
  type ProductListItem,
} from "@/lib/api";
import { typograf } from "@/lib/format";
import { productJsonLd } from "@/lib/json-ld";
import { pickVariant, questionLabel, showsWeightPicker, sizeLine } from "@/lib/product-page";
import { pageMetadata } from "@/lib/seo";
import { BuyBox } from "./buy-box";
import { ProductDetails, type DetailBlock } from "./details";

export const revalidate = 300;

/** Сколько товаров «сегодня» в карусели внизу (без текущего). */
const SHOWCASE_LIMIT = 8;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ v?: string | string[] }>;
};

async function safeGet<T>(path: string, fallback: T): Promise<T> {
  try {
    return await apiGet<T>(path);
  } catch {
    return fallback;
  }
}

async function loadProduct(slug: string): Promise<ProductDetail | null> {
  try {
    return await apiGet<ProductDetail>(`/catalog/products/${encodeURIComponent(slug)}`);
  } catch (error) {
    // Неактивный товар API не отдаёт (404) — страница отвечает 404, как и на несуществующий.
    // Другие ошибки (API лежит) — не 404: иначе ISR запомнил бы «нет такого товара»
    // для живой карточки, а поисковик выкинул бы её из индекса
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const product = await loadProduct(slug);
  if (!product) return { title: "Товар не найден" };

  return pageMetadata({
    title: product.name,
    description: product.subtitle
      ? `${product.subtitle}. ${product.description}`
      : product.description,
    path: `/product/${product.slug}`,
  });
}

export default async function ProductPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [product, contacts, today] = await Promise.all([
    loadProduct(slug),
    safeGet<ContactsPage | null>("/pages/contacts", null),
    safeGet<Page<ProductListItem> | null>(
      `/catalog/products?availability=today&page_size=${SHOWCASE_LIMIT + 1}`,
      null,
    ),
  ]);
  if (!product || product.variants.length === 0) notFound();

  const variant = pickVariant(product.variants, Array.isArray(query.v) ? query.v[0] : query.v);
  const showWeight = showsWeightPicker(product);
  /** «от 500 ₽, бесплатно от 5 000 ₽»; доставка ничего не стоит — «бесплатно». */
  const deliveryPriceLine = (price: string, freeFrom: string) =>
    Number(price) === 0
      ? "бесплатно"
      : `от ${formatPrice(price)}, бесплатно от ${formatPrice(freeFrom)}`;
  const labels = [
    ...product.tags.map((tag) => ({ text: TAG_LABELS[tag], dietary: false })),
    ...product.dietary.map((tag) => ({ text: DIETARY_LABELS[tag], dietary: true })),
  ];
  const content = contacts?.content;
  const telegramUrl = contacts?.telegram_url ?? null;
  const showcase = (today?.items ?? [])
    .filter((item) => item.id !== product.id)
    .slice(0, SHOWCASE_LIMIT);

  const blocks: DetailBlock[] = [
    {
      title: "Состав и пищевая ценность",
      rows: [
        ["Состав", product.composition],
        ["Аллергены", product.allergens],
        ["Вес и размер", sizeLine(product.variants)],
        ["Упаковка", product.packaging],
        ["Срок годности", product.shelf_life],
      ],
      nutrition: product.nutrition,
    },
    {
      title: "Хранение",
      rows: [
        ["Условия", product.storage_conditions],
        ["В дороге", product.transport_time],
      ],
    },
    {
      title: "Доставка, самовывоз и оплата",
      rows: [
        ["Доставка", content?.delivery],
        ["Самовывоз", content?.pickup],
        ["Оплата", content?.payment],
      ],
    },
  ];

  return (
    <>
      <JsonLd data={productJsonLd(product)} />

      <div className="product-page public-page container-page pt-8 xl:pt-[41px]">
        <Breadcrumbs
          items={[
            { href: "/", label: "Главная" },
            { href: "/catalog", label: "Каталог" },
            { href: `/catalog/${product.category.slug}`, label: product.category.name },
            { label: product.name },
          ]}
        />

        <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-12 xl:mt-[31px] xl:grid-cols-[688px_minmax(0,640px)] xl:gap-14">
          <PhotoGallery
            name={product.name}
            images={product.images.map((image) => ({
              key: String(image.id),
              storageKey: image.storage_key,
              roleLabel: image.role ? IMAGE_ROLE_LABELS[image.role] : null,
            }))}
          />

          <div className="product-summary">
            <h1 className="-mt-1 font-display text-section leading-[48px] text-ink">
              {typograf(product.name)}
            </h1>
            {/* Метки под названием, как у «Эстерхази» (006b), — у любого товара (007a):
                маркетинговые («Новинка», «Хит») и состав («Без глютена»), всё, что
                отмечено в карточке товара в админке */}
            {labels.length > 0 ? (
              <ul
                aria-label="Метки"
                className={`mt-[14px] mb-[14px] flex flex-wrap gap-2 ${product.dietary.length === 0 ? "max-xl:hidden" : ""}`}
              >
                {labels.map((label) => (
                  <li key={label.text} className={label.dietary ? undefined : "max-xl:hidden"}>
                    <Tag>{typograf(label.text)}</Tag>
                  </li>
                ))}
              </ul>
            ) : null}
            {showWeight ? (
              product.subtitle ? (
                <p className="mt-[7px] text-lg leading-6 text-ink-muted">
                  {typograf(product.subtitle)}
                </p>
              ) : null
            ) : (
              // Пирожное (макет «Эстерхази», 006b): состав и вес строкой —
              // блоков «Вес» и «Надпись» нет
              <>
                {(product.card_ingredients ?? product.subtitle) ? (
                  <p className="mt-[7px] text-lg leading-6 text-ink-muted">
                    {typograf((product.card_ingredients ?? product.subtitle)!)}
                  </p>
                ) : null}
                <p className="mt-[7px] text-[15px] leading-6 text-ink-subtle">
                  {typograf(variant.label)}
                </p>
              </>
            )}
            <hr className={`border-line ${showWeight ? "mt-[28px]" : "mt-[31px]"}`} />

            <BuyBox
              product={product}
              initialVariant={variant.id}
              telegramUrl={telegramUrl}
              showWeight={showWeight}
            >
              {content?.product_pickup || content?.product_delivery ? (
                <dl className="product-delivery mt-[32px] border-t border-line text-sm">
                  {content.product_pickup ? (
                    <div className="flex justify-between gap-6 border-b border-line pt-[14px] pb-[13px] leading-6">
                      <dt className="text-ink-subtle">Самовывоз</dt>
                      <dd className="text-right text-ink">{typograf(content.product_pickup)}</dd>
                    </div>
                  ) : null}
                  {content.product_delivery ? (
                    <div className="flex justify-between gap-6 border-b border-line pt-[14px] pb-[13px] leading-6">
                      <dt className="text-ink-subtle">Доставка</dt>
                      <dd className="text-right text-ink">
                        {typograf(content.product_delivery)}
                        {/* Цена доставки — из настроек (007a, находка 6 отчёта 006), не из
                            текста контактов: та же, что считает корзина */}
                        <span className="mt-[2px] block text-[13px] leading-5 text-ink-subtle">
                          {deliveryPriceLine(product.delivery_price, product.free_delivery_from)}
                        </span>
                      </dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}

              {telegramUrl ? (
                <p className="mt-[19px] flex items-center text-sm text-ink-muted">
                  {/* Бумажный самолётик — значок Telegram на макете 09.10 */}
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="mr-[10px] size-[18px] shrink-0 fill-none stroke-current stroke-[1.4] text-ink"
                  >
                    <path
                      d="M21 3 3 10.5l7 2.8M21 3l-7.5 18-3.5-7.7M21 3 10 13.3"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {questionLabel(product)}&nbsp;
                  <a
                    href={telegramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 text-ink underline underline-offset-4 transition-colors hover:text-accent"
                  >
                    Написать Елене в Telegram
                  </a>
                </p>
              ) : null}
            </BuyBox>
          </div>
        </div>

        <div className="product-details mt-20 xl:mt-[120px]">
          <ProductDetails blocks={blocks} />
        </div>

        {/* Промо-полоса: тексты из макета; с 09.10 — тёмное бордо (006b) */}
        <section
          aria-labelledby="custom-cake-promo"
          className="mt-20 flex flex-col gap-6 bg-accent-pressed px-6 py-8 lg:grid lg:grid-cols-[minmax(0,1fr)_352px_164px] lg:items-center lg:gap-x-10 lg:py-0 xl:mt-[96px] xl:h-[148px] xl:grid-cols-[max-content_352px_1fr] xl:max-[1512px]:grid-cols-[minmax(0,1fr)_352px_164px] xl:gap-x-[37px] xl:pr-[92px] xl:max-[1512px]:pr-10 xl:pl-[49px]"
        >
          <h2
            id="custom-cake-promo"
            className="font-display text-[40px] leading-[1.1] text-canvas max-sm:text-[28px]"
          >
            {typograf("Нужен торт другого веса или под повод?")}
          </h2>
          <p className="text-[15px] leading-[26px] text-canvas">
            Соберём торт под число гостей: начинка на выбор, оформление по эскизу
          </p>
          <LinkButton
            href="/custom-cakes"
            variant="outline-line-on-accent"
            size="md"
            className="lg:w-[164px] xl:justify-self-end"
          >
            Заказать торт
          </LinkButton>
        </section>
      </div>

      {showcase.length > 0 ? (
        <div className="product-related container-page py-20 lg:pt-[117px] lg:pb-32">
          <Carousel
            title="Ещё на витрине сегодня"
            subtitle="Можно добавить к заказу и забрать вместе"
            subtitleGap="-mt-[5.4px]"
            headerGap="md:mb-[47px]"
            itemClassName="w-[calc((100vw-40px)/2)] sm:w-[336px]"
            action={
              <LinkButton href="/catalog?availability=today" variant="outline" size="md">
                Вся витрина
              </LinkButton>
            }
          >
            {showcase.map((item) => (
              <ProductCard key={item.id} product={item} meta="catalog" />
            ))}
          </Carousel>
        </div>
      ) : (
        <div className="pb-20 xl:pb-32" />
      )}
    </>
  );
}
