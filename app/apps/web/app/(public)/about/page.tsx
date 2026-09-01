import { ImagePlaceholder, LinkButton, SectionHeader } from "@/components/ui";
import { apiGet, type PageContent } from "@/lib/api";

export const metadata = { title: "О нас" };
export const revalidate = 300;

const VALUES = [
  { title: "Честный состав", text: "Сливки и масло вместо растительных заменителей." },
  { title: "Только под заказ", text: "Не держим витрину — собираем под дату получения." },
  { title: "Внимание к деталям", text: "Ровные грани, аккуратный декор, чистая подача." },
  { title: "Своё слово", text: "Если обещали дату — торт будет готов к этой дате." },
];

export default async function AboutPage() {
  const page = await apiGet<PageContent>("/pages/about").catch(() => null);
  const content = (page?.content ?? {}) as { main_text?: string };

  return (
    <>
      <section className="container-page grid items-center gap-12 pb-4 pt-10 md:grid-cols-12 md:gap-16 md:pt-16">
        <div className="md:col-span-6">
          <p className="eyebrow mb-6">О нас</p>
          <h1 className="text-4xl">Кондитерская, а не производство</h1>
          <p className="mt-8 text-lg leading-relaxed text-ink-muted">
            {content.main_text ??
              "История кондитерской. Этот текст редактируется в админ-панели, раздел «Контент страниц» — разработчик для правок не нужен."}
          </p>
        </div>
        <div className="md:col-span-6">
          <ImagePlaceholder ratio="3/2" label="фото мастерской" className="rounded-xl" />
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="container-page section">
          <SectionHeader eyebrow="Принципы" title="Что для нас важно" />
          <div className="bento">
            {VALUES.map((value, index) => (
              <div
                key={value.title}
                className="bento-tile col-span-2 row-span-1 flex flex-col justify-between p-6 md:col-span-1 md:row-span-1 md:p-7"
              >
                <p className="tnum text-2xs text-ink-subtle">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <div>
                  <h3 className="text-xl">{value.title}</h3>
                  <p className="mt-2 text-sm text-ink-muted">{value.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page section text-center">
        <h2 className="text-3xl">Посмотрите, что мы делаем</h2>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <LinkButton href="/catalog">Каталог</LinkButton>
          <LinkButton href="/gallery" variant="secondary">
            Примеры работ
          </LinkButton>
        </div>
      </section>
    </>
  );
}
