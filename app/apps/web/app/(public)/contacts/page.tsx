/**
 * «Контакты» по макету new/design/pages/contacts.png (010a, доводка — 010b).
 *
 * Геометрия на 1512: поля 48, две колонки 696 + 24. Размеры сняты с макета
 * и сверены в 010a; в 010b перенесены из CSS-модуля в классы Tailwind.
 *
 * Все тексты и реквизиты — из GET /pages/contacts (правятся в «Страницах сайта»).
 * Пустое поле — строки нет: нет почты — нет «Почты», нет ИНН — нет «ИНН»; нет
 * описаний получения или реквизитов — нет всей секции. Заглушек в коде нет.
 */

import type { ReactNode } from "react";
import { Reveal, RevealGroup, RevealText } from "@/components/motion";
import { Breadcrumbs, LinkButton } from "@/components/ui";
import { apiGet, type ContactsPage as ContactsData } from "@/lib/api";
import { formatPhone, telegramHandle, typograf } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Контакты",
  description:
    "Адрес, телефон и часы работы кондитерской. Самовывоз с Гжатской и доставка по Москве.",
  path: "/contacts",
});
export const revalidate = 300;

type Row = { label: string; value: ReactNode };

const H2 =
  "text-[58px] leading-[64px] max-lg:text-[42px] max-lg:leading-[48px] max-md:text-4xl max-md:leading-[42px]";

function Details({ rows, className = "" }: { rows: (Row | null)[]; className?: string }) {
  const filled = rows.filter((row): row is Row => row !== null);
  if (filled.length === 0) return null;
  return (
    <RevealGroup as="dl" className={`border-t border-line ${className}`}>
      {filled.map(({ label, value }) => (
        <div
          key={label}
          className="grid min-h-[58px] grid-cols-[200px_minmax(0,1fr)] items-start border-b border-line py-3 max-lg:grid-cols-[125px_minmax(0,1fr)] max-md:grid-cols-[104px_minmax(0,1fr)] max-md:gap-3"
        >
          <dt className="pt-px text-sm leading-6 font-light text-ink-subtle max-md:text-xs">
            {label}
          </dt>
          <dd className="text-base leading-[26px] [overflow-wrap:anywhere] max-md:text-sm max-md:leading-6 [&_a]:transition-colors [&_a:hover]:text-accent">
            {value}
          </dd>
        </div>
      ))}
    </RevealGroup>
  );
}

export default async function ContactsPage() {
  const page = await apiGet<ContactsData>("/pages/contacts").catch(() => null);
  const content = page?.content;
  const phone = page?.phone ? formatPhone(page.phone) : null;
  // В макете адрес с городом; в базе — «Гжатская улица, 5к8» (так короче в подвале)
  const address = page?.address
    ? /^(?:г\.\s*)?москва(?:,|\s|$)/iu.test(page.address)
      ? page.address
      : `Москва, ${page.address}`
    : null;
  const hours = [page?.work_hours_weekdays, page?.work_hours_weekend].filter(Boolean).join(", ");
  const telegram = page?.telegram_url ?? null;
  const legal = content?.legal;
  const receiving = [
    { title: "Самовывоз", text: content?.pickup_description },
    { title: "Доставка", text: content?.delivery_description },
  ].filter((card): card is { title: string; text: string } => Boolean(card.text));

  return (
    <div className="contacts-page public-page container-page pt-[36px] pb-[128px] max-lg:pt-7 max-lg:pb-[72px]">
      <Breadcrumbs items={[{ href: "/", label: "Главная" }, { label: "Контакты" }]} />
      <div className="mt-2 mb-10 grid grid-cols-2 items-end gap-6 max-lg:items-start max-md:mt-4 max-md:mb-7 max-md:grid-cols-1 max-md:gap-4">
        <RevealText as="h1" className={H2}>
          {content?.title ?? "Контакты"}
        </RevealText>
        {content?.intro ? (
          <Reveal
            as="p"
            className="pb-1 text-[17px] leading-[26px] font-light text-ink-muted max-md:pb-0 max-md:text-base max-md:leading-[25px]"
          >
            {content.intro}
          </Reveal>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-6 max-md:grid-cols-1">
        <div>
          <Details
            rows={[
              address ? { label: "Адрес", value: typograf(address) } : null,
              hours ? { label: "Часы", value: typograf(hours) } : null,
              phone ? { label: "Телефон", value: <a href={phone.href}>{phone.display}</a> } : null,
              telegram
                ? {
                    label: "Telegram",
                    value: (
                      <a href={telegram} target="_blank" rel="noopener noreferrer">
                        {telegramHandle(telegram) ?? "Открыть чат"}
                      </a>
                    ),
                  }
                : null,
              content?.email
                ? {
                    label: "Почта",
                    value: <a href={`mailto:${content.email}`}>{content.email}</a>,
                  }
                : null,
              content?.how_to_get
                ? {
                    label: "Как добраться",
                    value: typograf(content.how_to_get.replace(/\s*\n\s*/g, " ")),
                  }
                : null,
            ]}
          />
          {content?.route_url || telegram ? (
            <Reveal className="mt-8 flex flex-wrap gap-3 max-md:mb-2 [&_a]:text-[15px] max-md:[&_a]:flex-auto">
              {content?.route_url ? (
                <LinkButton
                  href={content.route_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="md-tight"
                >
                  Построить маршрут
                </LinkButton>
              ) : null}
              {telegram ? (
                <LinkButton
                  href={telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outline"
                  size="md-tight"
                >
                  Написать в Telegram
                </LinkButton>
              ) : null}
            </Reveal>
          ) : null}
        </div>
        {/* Карта — заглушка, как на макете: виджет Яндекс.Карт не подключён (010a) */}
        <Reveal
          role="img"
          aria-label={address ? `Место для карты: ${address}` : "Место для карты"}
          className="grid h-[560px] place-items-center bg-photo p-6 text-center text-sm font-light text-ink-subtle max-lg:h-[440px] max-md:h-[340px]"
        >
          <span>{typograf(page?.address ? `Яндекс.Карта · ${page.address}` : "Яндекс.Карта")}</span>
        </Reveal>
      </div>

      {receiving.length > 0 ? (
        <section
          aria-labelledby="receiving-title"
          className="mt-[112px] max-lg:mt-[72px] max-md:mt-14"
        >
          <RevealText as="h2" id="receiving-title" className={`mb-[38px] max-md:mb-6 ${H2}`}>
            Получение заказа
          </RevealText>
          <RevealGroup className="grid grid-cols-2 gap-6 max-md:grid-cols-1">
            {receiving.map((card) => (
              <article
                key={card.title}
                className="min-h-[198px] bg-surface-sunken px-10 pt-10 pb-8 max-lg:p-7 max-md:min-h-0 max-md:px-6 max-md:py-7"
              >
                <h3 className="text-[32px] leading-10 max-md:text-[28px] max-md:leading-[34px]">
                  {card.title}
                </h3>
                <p className="mt-2 text-base leading-[26px] text-ink-muted max-md:leading-[25px]">
                  {typograf(card.text)}
                </p>
              </article>
            ))}
          </RevealGroup>
        </section>
      ) : null}

      {legal ? (
        <section aria-labelledby="legal-title" className="mt-[112px] max-lg:mt-[72px] max-md:mt-14">
          <RevealText as="h2" id="legal-title" className={`mb-[22px] ${H2}`}>
            Реквизиты
          </RevealText>
          <Details
            className="w-[calc((100%-24px)/2)] max-lg:w-full"
            rows={[
              { label: "Продавец", value: typograf(legal.name) },
              { label: "ОГРНИП", value: legal.ogrnip },
              legal.inn ? { label: "ИНН", value: legal.inn } : null,
              legal.production_address
                ? { label: "Адрес производства", value: typograf(legal.production_address) }
                : null,
            ]}
          />
        </section>
      ) : null}
    </div>
  );
}
