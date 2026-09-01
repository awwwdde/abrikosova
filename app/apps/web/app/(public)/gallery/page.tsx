import { EmptyState, LinkButton, Picture } from "@/components/ui";
import { apiGet, type GalleryItem, type Page } from "@/lib/api";

export const metadata = { title: "Примеры работ" };
export const revalidate = 300;

/**
 * Раскладка плиток бенто.
 *
 * Паттерн повторяется каждые 6 работ, поэтому сетка остаётся ритмичной при
 * любом количестве фотографий — в отличие от случайных размеров, где ряды
 * то и дело рвутся пустотами.
 */
const TILE_SPANS = [
  "col-span-2 row-span-2 md:col-span-2 md:row-span-2",
  "col-span-2 row-span-1 md:col-span-2 md:row-span-1",
  "col-span-1 row-span-1 md:col-span-1 md:row-span-1",
  "col-span-1 row-span-1 md:col-span-1 md:row-span-1",
  "col-span-2 row-span-1 md:col-span-1 md:row-span-2",
  "col-span-2 row-span-2 md:col-span-3 md:row-span-2",
];

export default async function GalleryPage() {
  const gallery = await apiGet<Page<GalleryItem>>("/gallery?page_size=24").catch(() => null);

  return (
    <div className="container-page py-10 md:py-16">
      <p className="eyebrow mb-6">Портфолио</p>
      <h1 className="max-w-[14ch] text-4xl">Примеры работ</h1>
      <p className="mt-6 max-w-xl text-lg text-ink-muted">
        Готовые заказы за последнее время. Любую из этих работ можно повторить или взять за основу.
      </p>

      <div className="mt-12 md:mt-16">
        {!gallery || gallery.items.length === 0 ? (
          <EmptyState
            title="Скоро здесь появятся наши работы"
            description="Пока портфолио наполняется — загляните в каталог готовых позиций."
            action={<LinkButton href="/catalog">В каталог</LinkButton>}
          />
        ) : (
          <div className="bento">
            {gallery.items.map((item, index) => (
              <figure
                key={item.id}
                className={`bento-tile group ${TILE_SPANS[index % TILE_SPANS.length]}`}
              >
                <Picture
                  storageKey={item.image_key}
                  alt={item.caption}
                  ratio="1/1"
                  sizes="(min-width: 768px) 33vw, 50vw"
                  className="absolute inset-0 h-full"
                />
                {/* Подпись поверх фото: не отнимает высоту у плитки и не рвёт сетку */}
                <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-4 pb-3 pt-10 text-xs text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  {item.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>

      <section className="section">
        <div className="rounded-2xl bg-surface px-6 py-16 text-center shadow-raised md:px-16 md:py-20">
          <h2 className="mx-auto max-w-[16ch] text-3xl">Хотите такой же торт?</h2>
          <p className="mx-auto mt-5 max-w-md text-base text-ink-muted">
            Расскажите про повод и дату — предложим вариант с оформлением и сориентируем по цене.
          </p>
          <div className="mt-9 flex justify-center">
            <LinkButton href="/custom-cakes">Обсудить свой торт</LinkButton>
          </div>
        </div>
      </section>
    </div>
  );
}
