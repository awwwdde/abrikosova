/**
 * Картинка для ссылок на сайт (Open Graph, задание 012): логотип, заголовок
 * героя главной и фото героя. Страницы без своей картинки берут эту. Лежит в
 * корне app, а не в группе (public): так у неё постоянный адрес /opengraph-image
 * (внутри группы Next добавляет к имени хэш), и на него ссылается разметка Bakery.
 */

import { ImageResponse } from "next/og";
import { apiGet, type ContactsPage, type HomePage } from "@/lib/api";
import { logoDataUri, OG_SIZE, OgCard, ogFonts, photoDataUri, titleImage } from "@/lib/og";

export const alt = "Кондитерская Елены Абрикосовой — торты и десерты в Москве";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 3600;

export default async function OpengraphImage() {
  const [home, contacts] = await Promise.all([
    apiGet<HomePage>("/pages/home").catch(() => null),
    apiGet<ContactsPage>("/pages/contacts").catch(() => null),
  ]);
  // Заголовок героя без последней строки: «Елены Абрикосовой» и так в логотипе
  const title =
    home?.content?.hero?.title_lines?.slice(0, 2).join(" ") ||
    "Торты и десерты по авторским рецептурам";
  const [fonts, logo, photo, heading] = await Promise.all([
    ogFonts(),
    logoDataUri(),
    photoDataUri(null),
    titleImage(title, 72, 620),
  ]);
  return new ImageResponse(
    <OgCard
      logo={logo}
      photo={photo}
      title={heading}
      subtitle="Витрина каждый день и торты на заказ"
      footer={contacts?.address ? `Москва · ${contacts.address}` : undefined}
    />,
    { ...size, fonts },
  );
}
