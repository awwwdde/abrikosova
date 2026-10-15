/**
 * Подвал по макету 1512.png. Цвет — тёмный бордо `accent-pressed` (#6E1B1E) на всех
 * публичных страницах, включая главную (решение 09.10, макеты new/design/pages/).
 *
 * Слева логотип и «Кондитер, автор рецептур»; колонки «Разделы» (то же меню,
 * что в шапке), «Торты» (подкатегории группы «Торты» из GET /catalog/categories)
 * и «Кондитерская» (адрес, часы, телефон, соцсети из GET /pages/contacts).
 * Под линией — копирайт, три правовых документа (политика, соглашение, согласие
 * на обработку ПДн), оговорка про оферту и реквизиты ИП.
 *
 * Ширины колонок на 1512 — 384 / 324 / 324 / 384 px, шире растут в той же
 * пропорции. Цвета на бордо сняты с макета: логотип — цвет фона страницы,
 * адрес и телефон — on-accent, ссылки — on-accent 70 %, подписи и нижняя
 * строка — 50 %, линия — 20 %.
 *
 * Серверный компонент: данные приходят из layout, JS в браузер не уходит.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { Reveal } from "@/components/motion";
import { NAV_LINKS } from "@/components/nav-links";
import type { Category, ContactsPage } from "@/lib/api";
import { formatPhone } from "@/lib/format";
import { typograf } from "@/lib/format";

const CAKES_SLUG = "torty";

const LEGAL_LINKS = [
  { href: "/privacy", label: "Политика конфиденциальности" },
  { href: "/terms", label: "Пользовательское соглашение" },
  { href: "/consent", label: "Согласие на обработку персональных данных" },
];

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mt-[3px] font-sans text-xs leading-none tracking-[0.1em] text-on-accent/50 uppercase">
        {typograf(title)}
      </h2>
      <div className="mt-[27px]">{children}</div>
    </div>
  );
}

const LINK = "text-base leading-6 text-on-accent/70 transition-colors hover:text-on-accent";

function LinkList({ links }: { links: { href: string; label: string }[] }) {
  return (
    <ul className="space-y-[14px]">
      {links.map((link) => (
        <li key={link.href}>
          <Link href={link.href} className={LINK}>
            {typograf(link.label)}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function SiteFooter({
  contacts,
  categories,
}: {
  contacts: ContactsPage | null;
  categories: Category[];
}) {
  const cakes = categories.find((category) => category.slug === CAKES_SLUG);
  const content = contacts?.content;
  const tel = contacts?.phone ? formatPhone(contacts.phone) : null;
  const hours = [contacts?.work_hours_weekdays, contacts?.work_hours_weekend].filter(Boolean);
  const legal = content?.legal;

  return (
    <footer className="mt-auto bg-accent-pressed text-on-accent">
      {/* Верх и правовые строки связаны: один триггер и одна анимация на весь контент. */}
      <Reveal delay={0} className="container-page pt-16 pb-10 lg:pt-24 lg:pb-[56px]">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[384fr_324fr_324fr_384fr] lg:gap-0">
          <div>
            <Link href="/" aria-label="Главная" className="inline-block text-canvas">
              <Logo fit="fill" className="h-[41px] w-[159px]" />
            </Link>
            <p className="mt-[14px] text-sm leading-5 text-on-accent/50">
              {typograf("Кондитер, автор рецептур")}
            </p>
          </div>

          <Column title="Разделы">
            <LinkList links={NAV_LINKS} />
          </Column>

          {cakes && cakes.subcategories.length > 0 ? (
            <Column title={cakes.name}>
              <LinkList
                links={cakes.subcategories.map((sub) => ({
                  href: `/catalog/${cakes.slug}/${sub.slug}`,
                  label: sub.name,
                }))}
              />
            </Column>
          ) : (
            <div />
          )}

          {contacts ? (
            <Column title="Кондитерская">
              <address className="not-italic">
                {contacts.address ? (
                  <p className="mt-px font-display text-[1.5rem] leading-[1.3]">
                    {typograf(contacts.address)}
                  </p>
                ) : null}
                {hours.length > 0 ? (
                  <p className="mt-[8px] text-base leading-6 text-on-accent/70">
                    {typograf(hours.join(", "))}
                  </p>
                ) : null}
                {tel ? (
                  <a
                    href={tel.href}
                    className="tnum mt-[27px] inline-block font-display text-[1.5rem] leading-[1.3] transition-colors hover:text-white"
                  >
                    {tel.display}
                  </a>
                ) : null}
              </address>
              {content && content.socials.length > 0 ? (
                <ul className="mt-[23px] flex flex-wrap gap-x-6 gap-y-2">
                  {content.socials.map((social) => (
                    <li key={social.href}>
                      <a
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${LINK} underline decoration-1 underline-offset-2`}
                      >
                        {typograf(social.label)}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Column>
          ) : null}
        </div>

        <div className="mt-14 flex flex-col gap-6 border-t border-on-accent/20 pt-8 text-[13px] leading-5 text-on-accent/50 lg:mt-[72px] lg:flex-row lg:justify-between">
          <div className="space-y-[11px]">
            <p>{typograf(`© ${new Date().getFullYear()} Кондитерская Елены Абрикосовой`)}</p>
            <ul className="flex flex-wrap gap-x-6 gap-y-[11px]">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="underline decoration-1 underline-offset-[3px] transition-colors hover:text-on-accent"
                  >
                    {typograf(link.label)}
                  </Link>
                </li>
              ))}
            </ul>
            <p>
              {typograf(
                "Сайт носит информационный характер и не является публичной офертой по ст. 437 ГК РФ",
              )}
            </p>
          </div>
          {legal ? <p>{typograf(`${legal.name}, ОГРНИП ${legal.ogrnip}`)}</p> : null}
        </div>
      </Reveal>
    </footer>
  );
}
