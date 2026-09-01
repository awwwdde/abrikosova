import { notFound } from "next/navigation";
import { AddToCart } from "@/components/add-to-cart";
import { ProductCard } from "@/components/product-card";
import { Badge, Breadcrumbs, Card, Picture, Price, SectionHeader } from "@/components/ui";
import { apiGet, TAG_LABELS, type ProductDetail } from "@/lib/api";

export const revalidate = 300;

async function loadProduct(slug: string): Promise<ProductDetail | null> {
  try {
    return await apiGet<ProductDetail>(`/catalog/products/${slug}`);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await loadProduct(slug);
  if (!product) return { title: "Товар не найден" };

  return {
    title: product.name,
    description: product.description.slice(0, 160),
    openGraph: { title: product.name, description: product.description.slice(0, 160) },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await loadProduct(slug);
  if (!product) notFound();

  // JSON-LD переносим из старого сайта — там это было рабочее решение
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "RUB",
      availability: product.is_available
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  const specs = [
    ["Вес", product.weight],
    ["Порции", product.portions],
    ["Срок годности", product.shelf_life],
    ["Хранение", product.storage_conditions],
    ["Состав", product.composition],
  ].filter(([, value]) => Boolean(value)) as [string, string][];

  return (
    <div className="container-page py-10 md:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Breadcrumbs
        items={[
          { href: "/", label: "Главная" },
          { href: "/catalog", label: "Каталог" },
          { href: `/catalog/${product.category.slug}`, label: product.category.name },
          {
            href: `/catalog/${product.category.slug}/${product.subcategory.slug}`,
            label: product.subcategory.name,
          },
          { label: product.name },
        ]}
      />

      <div className="mt-8 grid gap-10 md:grid-cols-12 md:gap-14">
        {/* Галерея: главное фото + миниатюры в колонке, соотношения зафиксированы */}
        <div className="md:col-span-7">
          <Picture
            storageKey={product.images.find((i) => i.is_main)?.storage_key ?? product.main_image}
            alt={product.name}
            ratio="4/5"
            sizes="(min-width: 768px) 55vw, 100vw"
            priority
            className="rounded-lg"
          />
          {product.images.length > 1 ? (
            <div className="mt-3 grid grid-cols-6 gap-2">
              {product.images.slice(0, 6).map((image) => (
                <Picture
                  key={image.id}
                  storageKey={image.storage_key}
                  alt={product.name}
                  ratio="1/1"
                  sizes="120px"
                  className="rounded-sm"
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="md:col-span-5">
          {product.tags.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {product.tags.map((tag) => (
                <Badge key={tag} tone={tag === "hit" ? "accent" : "neutral"}>
                  {TAG_LABELS[tag]}
                </Badge>
              ))}
            </div>
          ) : null}

          <h1 className="text-4xl">{product.name}</h1>

          <div className="mt-5 flex items-baseline gap-3">
            <Price value={product.price} className="text-3xl" />
            <span className={`text-xs ${product.is_available ? "text-ink-subtle" : "text-danger"}`}>
              {product.is_available ? "В наличии" : "Сейчас недоступно"}
            </span>
          </div>

          <div className="mt-6">
            <AddToCart productId={product.id} disabled={!product.is_available} />
          </div>

          {specs.length > 0 ? (
            <dl className="mt-10 text-sm">
              {specs.map(([label, value]) => (
                <div
                  key={label}
                  className="grid grid-cols-[7.5rem_1fr] gap-4 border-b border-line py-3 last:border-b-0"
                >
                  <dt className="text-ink-subtle">{label}</dt>
                  <dd className="text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <div className="mt-8">
            <h2 className="text-base">Описание</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{product.description}</p>
          </div>
        </div>
      </div>

      {product.fillings.length > 0 ? (
        <section className="section border-t border-line">
          <SectionHeader eyebrow="Можно выбрать" title="Доступные начинки" />
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 md:gap-6">
            {product.fillings.map((filling) => (
              <Card key={filling.id} className="flex items-start justify-between gap-4 p-5">
                <div>
                  <p className="text-sm font-medium">{filling.name}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                    {filling.description}
                  </p>
                </div>
                <Price value={filling.price_per_kg} className="shrink-0 text-xs text-ink-subtle" />
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {product.related_products.length > 0 ? (
        <section className="section border-t border-line">
          <SectionHeader eyebrow="Из этой же категории" title="Похожие позиции" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {product.related_products.map((related) => (
              <ProductCard key={related.id} product={related} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
