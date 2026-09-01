import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page flex min-h-screen flex-col items-center justify-center py-16 text-center">
      <p className="eyebrow">Ошибка 404</p>
      <h1 className="mt-4 text-3xl md:text-4xl">Такой страницы нет</h1>
      <p className="mt-4 max-w-sm text-sm text-ink-muted">
        Возможно, ссылка устарела или в адресе опечатка. Загляните в каталог — там всё на месте.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="inline-flex min-h-10 items-center rounded-md bg-accent px-5 text-sm font-medium text-white shadow-raised transition-[background-color,scale] duration-150 hover:bg-accent-hover active:scale-[0.96]"
        >
          На главную
        </Link>
        <Link
          href="/catalog"
          className="inline-flex min-h-10 items-center rounded-md bg-surface px-5 text-sm font-medium shadow-raised transition-[background-color,scale] duration-150 hover:bg-surface-sunken active:scale-[0.96]"
        >
          В каталог
        </Link>
      </div>
    </div>
  );
}
