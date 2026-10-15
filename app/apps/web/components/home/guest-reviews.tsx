/**
 * «Что говорят гости» по макету 1512.png: заголовок, «85 отзывов на
 * Яндекс.Картах» и кнопка на все отзывы; три показателя Яндекса в ряд между
 * двумя линиями; три отзыва в ряд с вертикальными разделителями.
 *
 * Отзывы — GET /reviews?source=yandex: текст внесён в админке, ссылка
 * «Читать на Яндекс.Картах» ведёт на оригинал (`external_url`). Рейтинг,
 * число оценок и ссылка на карточку — поля контактов, «85 отзывов»
 * и награда — content контактов.
 *
 * Текст отзыва на макете обрезан многоточием в одну строку; на узких
 * экранах, где колонка одна, — в две.
 */

import { Reveal, RevealGroup, RevealText } from "@/components/motion";
import { LinkButton } from "@/components/ui";
import type { ContactsPage, Review } from "@/lib/api";
import { formatMonthYear, pluralRu } from "@/lib/format";
import { MOTION } from "@/lib/motion";
import { typograf } from "@/lib/format";

function Stars({ rating }: { rating: number }) {
  return (
    <div role="img" aria-label={`Оценка ${rating} из 5`} className="flex gap-[6px]">
      {Array.from({ length: 5 }, (_, index) => (
        <svg
          key={index}
          width="14"
          height="13"
          viewBox="0 0 14 13"
          aria-hidden="true"
          className={index < rating ? "text-accent" : "text-line"}
        >
          <path
            fill="currentColor"
            d="M7 0l1.65 4.53 4.85.13-3.83 2.97 1.36 4.64L7 9.54l-4.03 2.73 1.36-4.64L.5 4.66l4.85-.13z"
          />
        </svg>
      ))}
    </div>
  );
}

export function GuestReviews({ contacts, reviews }: { contacts: ContactsPage; reviews: Review[] }) {
  const content = contacts.content;
  const mapsUrl = contacts.yandex_maps_url;
  const rating = contacts.yandex_rating;
  const votes = contacts.yandex_reviews_count;

  const stats = [
    rating != null
      ? {
          value: Number(rating).toLocaleString("ru-RU", { minimumFractionDigits: 1 }),
          label: "рейтинг",
        }
      : null,
    votes != null
      ? {
          value: `${votes} ${pluralRu(votes, ["оценка", "оценки", "оценок"])}`,
          label: "на Яндекс.Картах",
        }
      : null,
    content.award ? { value: content.award, label: "награда Яндекс.Карт" } : null,
  ].filter((stat) => stat !== null);

  return (
    <section
      aria-labelledby="reviews-title"
      className="container-page pb-20 lg:pt-[130px] lg:pb-[124px]"
    >
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <RevealText as="h2" id="reviews-title" className="text-section">
            Что говорят гости
          </RevealText>
          {content.reviews_count_text ? (
            <Reveal as="p" className="mt-2 text-subtitle font-light text-ink-muted lg:mt-[8.6px]">
              {content.reviews_count_text} на Яндекс.Картах
            </Reveal>
          ) : null}
        </div>
        {mapsUrl ? (
          <Reveal delay={MOTION.button.delay} className="flex lg:mb-[1.4px]">
            <LinkButton
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="outline"
              size="md-tight"
              className="w-[202px]"
            >
              Читать все отзывы
            </LinkButton>
          </Reveal>
        ) : null}
      </div>

      {stats.length > 0 ? (
        <RevealGroup
          as="dl"
          delay={MOTION.text.afterHeading}
          className="mt-10 grid gap-6 border-y border-line py-8 sm:grid-cols-3 lg:mt-[62.6px] lg:gap-0 lg:pt-[42px] lg:pb-[39.5px]"
        >
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col-reverse">
              <dt className="mt-2 text-[15px] leading-5 font-light text-ink-subtle lg:mt-[10px]">
                {typograf(stat.label)}
              </dt>
              <dd className="font-display text-[2.25rem] leading-[1.1] sm:text-[2.75rem]">
                {typograf(stat.value)}
              </dd>
            </div>
          ))}
        </RevealGroup>
      ) : null}

      {reviews.length > 0 ? (
        <RevealGroup
          as="ul"
          delay={MOTION.text.afterHeading}
          className="mt-10 grid gap-10 lg:mt-[64px] lg:grid-cols-3 lg:gap-x-[81px]"
        >
          {reviews.map((review) => (
            <li
              key={review.id}
              className="relative min-w-0 lg:pt-1 lg:not-first:before:absolute lg:not-first:before:inset-y-0 lg:not-first:before:-left-[41px] lg:not-first:before:w-px lg:not-first:before:bg-line"
            >
              {review.rating ? <Stars rating={review.rating} /> : null}
              <p className="mt-6 line-clamp-2 text-[17px] leading-6 lg:mt-[32px] lg:line-clamp-1">
                {typograf(review.text)}
              </p>
              <p className="mt-4 text-sm leading-5 text-ink-subtle lg:mt-[25px]">
                {typograf(`${review.author_name} · ${formatMonthYear(review.created_at)}`)}
              </p>
              {review.external_url ? (
                <a
                  href={review.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-[11px] inline-block text-[15px] leading-5 text-ink-muted transition-colors hover:text-accent"
                >
                  {typograf("Читать на Яндекс.Картах")}
                </a>
              ) : null}
            </li>
          ))}
        </RevealGroup>
      ) : null}
    </section>
  );
}
