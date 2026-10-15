/** Картинка для ссылки на товар (задание 012): название, цена и главное фото. */

import { ImageResponse } from "next/og";
import { apiGet, formatPrice, type ProductDetail } from "@/lib/api";
import {
  logoDataUri,
  OG_SIZE,
  OgCard,
  ogFonts,
  photoDataUri,
  serverMediaUrl,
  titleImage,
} from "@/lib/og";

export const alt = "Товар кондитерской Елены Абрикосовой";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 3600;

export default async function ProductOpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await apiGet<ProductDetail>(`/catalog/products/${slug}`).catch(() => null);
  const main = product?.images.find((image) => image.is_main) ?? product?.images[0];
  const name = product?.name ?? "Кондитерская Елены Абрикосовой";
  const [fonts, logo, photo, heading] = await Promise.all([
    ogFonts(),
    logoDataUri(),
    photoDataUri(serverMediaUrl(main?.storage_key)),
    // Длинное название — кеглем меньше, чтобы влезло в три строки
    titleImage(name, name.length > 40 ? 56 : 72, 620),
  ]);
  return new ImageResponse(
    <OgCard
      logo={logo}
      photo={photo}
      title={heading}
      subtitle={
        product
          ? `${product.has_variants ? "от " : ""}${formatPrice(product.price_from)} · ${product.subcategory.name}`
          : undefined
      }
    />,
    { ...size, fonts },
  );
}
