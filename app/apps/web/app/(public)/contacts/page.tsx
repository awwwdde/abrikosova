import { RequestForm } from "@/components/request-form";
import { Card } from "@/components/ui";
import { apiGet, type PageContent } from "@/lib/api";

export const metadata = { title: "Контакты" };
export const revalidate = 300;

export default async function ContactsPage() {
  const page = await apiGet<PageContent>("/pages/contacts").catch(() => null);

  const details = [
    { label: "Адрес", value: page?.address ?? "Уточняется" },
    { label: "Часы работы, будни", value: page?.work_hours_weekdays ?? "9:00–20:00" },
    { label: "Часы работы, выходные", value: page?.work_hours_weekend ?? "10:00–18:00" },
    { label: "Часы доставки", value: page?.delivery_hours ?? "10:00–20:00" },
  ];

  return (
    <div className="container-page py-10 md:py-14">
      <p className="eyebrow mb-4">Связаться</p>
      <h1 className="text-4xl">Контакты</h1>

      <div className="mt-10 grid gap-10 md:grid-cols-12 md:gap-14">
        <div className="md:col-span-5">
          <a
            href={`tel:${page?.phone ?? ""}`}
            className="tnum font-display text-3xl transition-colors duration-150 hover:text-accent"
          >
            {page?.phone ?? "+7 (000) 000-00-00"}
          </a>

          <dl className="mt-8 text-sm">
            {details.map((item) => (
              <div
                key={item.label}
                className="grid grid-cols-[10rem_1fr] gap-4 border-b border-line py-3 last:border-b-0"
              >
                <dt className="text-ink-subtle">{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="md:col-span-7">
          {/* Код виджета карты вставляется через админку; до этого — место под него */}
          <div
            className="img-outline flex w-full items-center justify-center rounded-lg bg-surface-sunken"
            style={{ aspectRatio: "16/9" }}
          >
            <span className="text-2xs tracking-wide text-ink-subtle">виджет карты</span>
          </div>
        </div>
      </div>

      <div className="section border-t border-line">
        <div className="grid gap-10 md:grid-cols-12 md:gap-14">
          <div className="md:col-span-5">
            <p className="eyebrow mb-4">Форма</p>
            <h2 className="text-3xl">Написать нам</h2>
            <p className="mt-4 text-sm leading-relaxed text-ink-muted">
              Ответим в рабочее время. Если вопрос про торт на заказ — лучше сразу оставить заявку в
              соответствующем разделе.
            </p>
          </div>
          <div className="md:col-span-7">
            <Card className="p-6 md:p-8">
              <RequestForm
                endpoint="/contacts/feedback"
                messageField="message"
                messageLabel="Сообщение"
                submitLabel="Отправить"
              />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
