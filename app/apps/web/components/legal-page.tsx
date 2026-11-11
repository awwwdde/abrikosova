/**
 * Правовые документы — политика, пользовательское соглашение, согласие на обработку
 * ПДн (010b, макет new/design/pages/service-pages.png). Раскладка одна на три
 * страницы: крошки, H1 Forum, «Редакция от …», нумерованные разделы — H2 Forum
 * с номером и абзацы Manrope 16px в колонке 696px.
 *
 * Тексты и даты редакций приходят из `GET /pages/legal`.
 * Оператор ПДн — реквизиты из контента контактов (`legal`): одно место для правки,
 * его же показывает подвал. Нет даты — строки «Редакция от» нет.
 */

import { Fragment } from "react";
import { Reveal, RevealText } from "@/components/motion";
import Link from "@/components/page-transition";
import { Breadcrumbs } from "@/components/ui";
import { apiGet, type ContactsPage, type LegalPage as LegalData } from "@/lib/api";
import { formatLongDate, typograf } from "@/lib/format";
import { LEGAL_DOCUMENTS, type LegalDocumentKey } from "@/lib/legal-documents";

type Operator = { name: string; ogrnip: string | null } | null;

async function safeGet<T>(path: string): Promise<T | null> {
  try {
    return await apiGet<T>(path);
  } catch {
    return null;
  }
}

async function loadLegal() {
  const [legal, contacts] = await Promise.all([
    safeGet<LegalData>("/pages/legal"),
    safeGet<ContactsPage>("/pages/contacts"),
  ]);
  const info = contacts?.content.legal;
  return { legal, operator: info ? { name: info.name, ogrnip: info.ogrnip } : null };
}

/**
 * «Оператор — ИП Абрикосова Е. О. (ОГРНИП …)». Без реквизитов — ссылка на
 * контакты, а не выдуманное имя.
 */
function OperatorName({ operator }: { operator: Operator }) {
  if (!operator) {
    return (
      <>
        индивидуальный предприниматель, реквизиты которого указаны на странице{" "}
        <Link href="/contacts" className="text-ink underline underline-offset-2">
          «Контакты»
        </Link>
      </>
    );
  }
  return (
    <>
      {typograf(operator.name)}
      {operator.ogrnip ? `, ОГРНИП ${operator.ogrnip}` : null} (реквизиты — на странице{" "}
      <Link href="/contacts" className="text-ink underline underline-offset-2">
        «Контакты»
      </Link>
      )
    </>
  );
}

function LegalText({ text, operator }: { text: string; operator: Operator }) {
  const tokens = new Map(
    Object.entries({
      "{{оператор}}": <OperatorName operator={operator} />,
      "{{политика}}": (
        <Link href="/privacy" className="text-ink underline underline-offset-2">
          политике конфиденциальности
        </Link>
      ),
      "{{согласие}}": (
        <Link href="/consent" className="text-ink underline underline-offset-2">
          согласие на обработку персональных данных
        </Link>
      ),
    }),
  );
  return text.split(/\r?\n[ \t]*\r?\n/).map((paragraph, index) => (
    <p key={index} className="whitespace-pre-line">
      {paragraph.split(/(\{\{(?:оператор|политика|согласие)\}\})/).map((part, partIndex) => (
        <Fragment key={partIndex}>{tokens.get(part) ?? part}</Fragment>
      ))}
    </p>
  ));
}

export async function LegalPage({ document }: { document: LegalDocumentKey }) {
  const { legal, operator } = await loadLegal();
  const { title, sections: defaultSections } = LEGAL_DOCUMENTS[document];
  const sections = legal?.content[`${document}_sections`] ?? defaultSections;
  const revision = formatLongDate(legal?.content[`${document}_revised_at`]);
  return (
    <article className="legal-page public-page container-page pt-8 pb-20 xl:pt-[35px] xl:pb-[121px]">
      <Breadcrumbs items={[{ href: "/", label: "Главная" }, { label: title }]} />
      <RevealText
        as="h1"
        className="mt-6 font-display text-section leading-[1.1] text-ink xl:mt-[19px]"
      >
        {title}
      </RevealText>
      {revision ? (
        <Reveal as="p" delay={0.1} className="mt-4 text-sm leading-5 text-ink-subtle xl:mt-[15px]">
          {`Редакция от ${revision}`}
        </Reveal>
      ) : null}

      <div className="mt-12 max-w-[696px] xl:mt-[53px]">
        {sections.map((section, index) => (
          <section key={index} className="mt-10 first:mt-0 xl:mt-[34px]">
            <RevealText
              as="h2"
              className="font-display text-[28px] leading-[34px] text-ink max-sm:text-2xl"
            >
              {`${index + 1}. ${section.title}`}
            </RevealText>
            <Reveal className="mt-2 space-y-3 text-base leading-[26px] text-ink-muted xl:mt-[4px]">
              <LegalText text={section.text} operator={operator} />
            </Reveal>
          </section>
        ))}
      </div>
    </article>
  );
}
