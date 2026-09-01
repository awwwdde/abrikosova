export const metadata = { title: "Пользовательское соглашение" };

export default function TermsPage() {
  return (
    <article className="container-page max-w-2xl py-10 text-sm leading-relaxed md:py-14">
      <h1 className="mb-8 text-3xl">Пользовательское соглашение</h1>

      <p className="rounded-md bg-surface-sunken px-4 py-3 text-xs text-ink-muted">
        Черновик структуры. Финальный текст предоставляет заказчик.
      </p>

      <h2 className="mt-8 mb-2 text-base">1. Предмет соглашения</h2>
      <p className="mt-2 text-ink-muted">
        Условия использования сайта и порядок оформления заказов.
      </p>

      <h2 className="mt-8 mb-2 text-base">2. Порядок использования сайта</h2>
      <p className="mt-2 text-ink-muted">
        Сайт предназначен для ознакомления с ассортиментом и оформления заказов без регистрации.
      </p>

      <h2 className="mt-8 mb-2 text-base">3. Заказы и оплата</h2>
      <p className="mt-2 text-ink-muted">
        Оплата на сайте не принимается — расчёт при получении или по договорённости. Информация на
        сайте не является публичной офертой.
      </p>

      <h2 className="mt-8 mb-2 text-base">4. Ограничение ответственности</h2>
      <p className="mt-2 text-ink-muted">
        Пределы ответственности сторон определяются законодательством РФ.
      </p>
    </article>
  );
}
