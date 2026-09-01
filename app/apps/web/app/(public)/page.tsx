import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { Card, ImagePlaceholder, LinkButton, Price, SectionHeader } from "@/components/ui";
import { apiGet, type Page, type ProductListItem, type Review } from "@/lib/api";

export const revalidate = 300;

/** Ошибка одной секции не должна ронять всю главную — изоляция ошибок по блокам. */
async function safeGet<T>(path: string, fallback: T): Promise<T> {
  try {
    return await apiGet<T>(path);
  } catch {
    return fallback;
  }
}

const ADVANTAGES = [
  { title: "Натуральный состав", text: "Сливки, масло, ягоды. Без растительных заменителей." },
  { title: "Ручная работа", text: "Каждый торт собирается под конкретный заказ." },
  { title: "Доставка", text: "Привезём в согласованное время, в термоупаковке." },
  { title: "Свой дизайн", text: "Оформление под повод — от лаконичного до сложного." },
];

export default async function HomePage() {
  const empty = { items: [], total: 0, page: 1, page_size: 0 };
  const [featured, reviews] = await Promise.all([
    safeGet<Page<ProductListItem>>("/catalog/products?is_featured=true&page_size=8", empty),
    safeGet<Page<Review>>("/reviews?page_size=5", empty),
  ]);

  // Минимальная цена среди популярных позиций — ориентир «от» под финальным CTA
  const minPrice = featured.items.reduce<string | null>(
    (min, item) =>
      min === null || Number.parseFloat(item.price) < Number.parseFloat(min) ? item.price : min,
    null,
  );

  return (
    <>
      {/*
        Hero-бенто: крупный заголовок занимает всю ширину, под ним плитки
        разного размера. Главное фото шире остальных — оно и держит композицию.
      */}
      <section className="container-page pt-10 md:pt-16">
        <p className="eyebrow mb-6">Ручная работа · Москва</p>

        <h1 className="max-w-[16ch] text-5xl">Торты, ради которых возвращаются</h1>

        <div className="mt-10 flex flex-col gap-6 md:mt-14 md:flex-row md:items-end md:justify-between">
          <p className="max-w-xl text-lg text-ink-muted">
            Десерты на заказ из натуральных ингредиентов. Оформление обсуждаем лично, оплата — при
            получении.
          </p>
          <div className="flex flex-wrap gap-3">
            <LinkButton href="/catalog">Смотреть каталог</LinkButton>
            <LinkButton href="/custom-cakes" variant="secondary">
              Торт на заказ
            </LinkButton>
          </div>
        </div>

        <div className="bento mt-10 md:mt-14">
          <div className="bento-tile col-span-2 row-span-2 md:col-span-2 md:row-span-3">
            <ImagePlaceholder fill label="главное фото" />
          </div>

          <div className="bento-tile col-span-1 row-span-1 md:col-span-1 md:row-span-2">
            <ImagePlaceholder fill label="фото" />
          </div>

          <div className="bento-tile col-span-1 row-span-1 flex flex-col justify-between p-5 md:col-span-1 md:row-span-1 md:p-6">
            <p className="eyebrow">Опыт</p>
            <p className="tnum font-display text-4xl leading-none">9 лет</p>
          </div>

          <div className="bento-tile col-span-2 row-span-1 flex flex-col justify-between p-5 md:col-span-1 md:row-span-1 md:p-6">
            <p className="eyebrow">Собрано тортов</p>
            <p className="tnum font-display text-4xl leading-none">2400+</p>
          </div>

          <div className="bento-tile col-span-2 row-span-1 md:col-span-2 md:row-span-1">
            <ImagePlaceholder fill label="фото процесса" />
          </div>
        </div>
      </section>

      {featured.items.length > 0 ? (
        <section className="container-page section">
          <SectionHeader
            eyebrow="Витрина"
            title="Популярные позиции"
            action={
              <Link
                href="/catalog"
                className="text-sm text-ink-muted transition-colors duration-150 hover:text-accent"
              >
                Весь каталог →
              </Link>
            }
          />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {featured.items.slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Преимущества тоже бенто: первая плитка крупнее — она несёт главный довод */}
      <section className="border-y border-line bg-surface">
        <div className="container-page section">
          <SectionHeader eyebrow="Почему мы" title="Четыре причины заказать" />

          <div className="bento">
            {ADVANTAGES.map((item, index) => (
              <div
                key={item.title}
                className={`bento-tile flex flex-col justify-between p-6 md:p-8 ${
                  index === 0
                    ? "col-span-2 row-span-2 md:col-span-2 md:row-span-2"
                    : "col-span-2 row-span-1 md:col-span-2 md:row-span-1"
                }`}
              >
                <p className="tnum text-2xs text-ink-subtle">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <div>
                  <h3 className={index === 0 ? "text-2xl" : "text-lg"}>{item.title}</h3>
                  <p
                    className={`mt-2 text-ink-muted ${index === 0 ? "max-w-sm text-base" : "text-sm"}`}
                  >
                    {item.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page section">
        <div className="grid items-center gap-10 md:grid-cols-12 md:gap-16">
          <div className="md:col-span-5">
            <ImagePlaceholder ratio="3/2" label="фото кондитера" className="rounded-xl" />
          </div>
          <div className="md:col-span-6 md:col-start-7">
            <p className="eyebrow mb-5">О бренде</p>
            <h2 className="text-3xl">Небольшая мастерская, а не фабрика</h2>
            <p className="mt-6 max-w-lg text-lg text-ink-muted">
              Мы не держим витрину с готовой продукцией: каждый заказ собирается под дату получения.
              Поэтому состав всегда свежий, а оформление — ваше, а не типовое.
            </p>
            <div className="mt-8">
              <LinkButton href="/about" variant="secondary">
                Подробнее о нас
              </LinkButton>
            </div>
          </div>
        </div>
      </section>

      {reviews.items.length > 0 ? (
        <section className="border-t border-line bg-surface">
          <div className="container-page section">
            <SectionHeader eyebrow="Отзывы" title="Что говорят гости" />
            <div className="grid gap-4 md:grid-cols-3 md:gap-6">
              {reviews.items.slice(0, 3).map((review) => (
                <Card key={review.id} className="flex h-full flex-col p-7 md:p-8">
                  {review.rating ? (
                    <p
                      className="tnum mb-4 text-sm text-accent"
                      aria-label={`Оценка ${review.rating} из 5`}
                    >
                      {"★".repeat(review.rating)}
                      <span className="text-line-strong">{"★".repeat(5 - review.rating)}</span>
                    </p>
                  ) : null}
                  <blockquote className="flex-1 text-base leading-relaxed text-ink-muted">
                    {review.text}
                  </blockquote>
                  <figcaption className="mt-6 text-xs text-ink-subtle">
                    {review.author_name}
                  </figcaption>
                </Card>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="container-page section">
        <div className="rounded-2xl bg-accent px-6 py-20 text-center text-white md:px-16 md:py-28">
          <h2 className="mx-auto max-w-[14ch] text-4xl text-white">Готовы обсудить заказ?</h2>
          <p className="mx-auto mt-6 max-w-md text-base text-white/75">
            Выберите готовую позицию в каталоге или расскажите, каким видите свой торт.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              href="/catalog"
              className="inline-flex min-h-11 items-center rounded-md bg-white px-6 text-sm font-medium text-accent transition-[background-color,scale] duration-150 hover:bg-white/90 active:scale-[0.96]"
            >
              В каталог
            </Link>
            <Link
              href="/custom-cakes"
              className="inline-flex min-h-11 items-center rounded-md px-6 text-sm font-medium text-white ring-1 ring-inset ring-white/35 transition-[background-color,scale] duration-150 hover:bg-white/10 active:scale-[0.96]"
            >
              Обсудить свой торт
            </Link>
          </div>

          {/* Ценовой ориентир держим рядом с CTA — вопрос «сколько стоит» возникает здесь */}
          {minPrice ? (
            <p className="mt-10 text-xs text-white/60">
              Готовые позиции от <Price value={minPrice} /> · Торты на заказ обсуждаются
              индивидуально
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}
