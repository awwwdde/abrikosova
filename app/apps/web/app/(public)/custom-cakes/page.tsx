import { RequestForm } from "@/components/request-form";
import { Card, ImagePlaceholder, Picture, Price, SectionHeader } from "@/components/ui";
import { apiGet, type Filling, type PageContent } from "@/lib/api";

export const metadata = { title: "Торты на заказ" };
export const revalidate = 300;

type CustomCakesData = {
  cakes: {
    id: number;
    title: string;
    description: string;
    price_from: string;
    image_key: string;
  }[];
  fillings: Filling[];
  page: PageContent | null;
};

const STEPS = [
  { title: "Консультация", text: "Обсуждаем повод, вкус, размер и бюджет." },
  { title: "Согласование", text: "Утверждаем дизайн и начинку, фиксируем дату." },
  { title: "Изготовление", text: "Собираем торт под дату получения." },
  { title: "Получение", text: "Доставка или самовывоз в согласованное время." },
];

export default async function CustomCakesPage() {
  const data = await apiGet<CustomCakesData>("/custom-cakes").catch(
    () => ({ cakes: [], fillings: [], page: null }) as CustomCakesData,
  );

  return (
    <>
      <section className="container-page pt-10 md:pt-16">
        <p className="eyebrow mb-6">Индивидуальный заказ</p>
        <h1 className="max-w-[13ch] text-5xl">Торт под ваш повод</h1>
        <p className="mt-8 max-w-xl text-lg text-ink-muted">
          Вкус, размер и оформление обсуждаем лично. Начинаем с короткого разговора — расскажите,
          что нужно, и мы предложим варианты.
        </p>

        <div className="bento mt-10 md:mt-14">
          <div className="bento-tile col-span-2 row-span-2 md:col-span-3 md:row-span-2">
            <ImagePlaceholder fill label="авторская работа" />
          </div>
          <div className="bento-tile col-span-1 row-span-1 md:col-span-1 md:row-span-1">
            <ImagePlaceholder fill label="фото" />
          </div>
          <div className="bento-tile col-span-1 row-span-1 flex flex-col justify-between p-5 md:col-span-1 md:row-span-1 md:p-6">
            <p className="eyebrow">Срок</p>
            <p className="font-display text-2xl leading-none">от 3 дней</p>
          </div>
        </div>
      </section>

      {data.fillings.length > 0 ? (
        <section className="container-page section">
          <SectionHeader eyebrow="Основа вкуса" title="Начинки" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {data.fillings.map((filling) => (
              <Card key={filling.id} interactive className="overflow-hidden">
                <Picture storageKey={filling.image_key} alt={filling.name} ratio="16/9" />
                <div className="p-5 md:p-6">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-base font-medium">{filling.name}</p>
                    <Price value={filling.price_per_kg} className="text-xs text-ink-subtle" />
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                    {filling.description}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section className="border-y border-line bg-surface">
        <div className="container-page section">
          <SectionHeader eyebrow="Как это работает" title="Четыре шага до готового торта" />
          <ol className="bento">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="bento-tile col-span-2 row-span-1 flex flex-col justify-between p-6 md:col-span-1 md:row-span-1 md:p-7"
              >
                <p className="tnum text-2xs text-ink-subtle">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <div>
                  <h3 className="text-xl">{step.title}</h3>
                  <p className="mt-2 text-sm text-ink-muted">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {data.cakes.length > 0 ? (
        <section className="container-page section">
          <SectionHeader eyebrow="Портфолио" title="Примеры авторских тортов" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {data.cakes.map((cake) => (
              <Card key={cake.id} interactive className="overflow-hidden">
                <Picture storageKey={cake.image_key} alt={cake.title} ratio="4/5" />
                <div className="p-5 md:p-6">
                  <p className="text-base font-medium">{cake.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{cake.description}</p>
                  <p className="mt-4 text-sm">
                    от <Price value={cake.price_from} className="font-medium" />
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section className="border-t border-line bg-surface">
        <div className="container-page section">
          <div className="grid gap-12 md:grid-cols-12 md:gap-16">
            <div className="md:col-span-5">
              <p className="eyebrow mb-5">Первый шаг</p>
              <h2 className="text-3xl">Оставьте заявку</h2>
              <p className="mt-6 text-base leading-relaxed text-ink-muted">
                Достаточно имени и телефона. Опишите идею в свободной форме — или просто напишите
                повод и дату, остальное обсудим при разговоре.
              </p>
            </div>
            <div className="md:col-span-6 md:col-start-7">
              <RequestForm
                endpoint="/custom-cakes/consultation"
                messageField="description"
                messageLabel="Пожелания по торту"
                messagePlaceholder="Повод, желаемая дата, количество гостей, идеи по оформлению"
                submitLabel="Отправить заявку"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
