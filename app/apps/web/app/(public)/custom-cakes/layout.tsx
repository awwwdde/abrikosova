/**
 * Раздел «Торты на заказ» (008c): общее для списка и страниц дизайнов — окно заявки.
 * Оно открывается адресом (`?request=1`, `?like=<id>`), поэтому живёт здесь, а не
 * в странице: «Оставить заявку» на дизайне, ссылки шапки и «Работ» открывают одно
 * и то же окно. Данные окна (поводы, дополнения, срок, начинки) — с сервера, с тем же
 * тегом кэша `custom_cakes`, что у страниц раздела.
 */

import { Suspense, type ReactNode } from "react";
import { RequestPanel } from "@/components/custom-cakes/request-panel";
import { apiGet, type CakeFilling, type CustomCakesInfo } from "@/lib/api";

export default async function CustomCakesLayout({ children }: { children: ReactNode }) {
  const [info, fillings] = await Promise.all([
    apiGet<CustomCakesInfo>("/custom-cakes/info").catch(() => null),
    apiGet<CakeFilling[]>("/custom-cakes/fillings").catch(() => []),
  ]);
  return (
    <>
      {children}
      {/* useSearchParams внутри — без Suspense страница целиком ушла бы в клиентский рендер */}
      <Suspense fallback={null}>
        <RequestPanel info={info} fillings={fillings} />
      </Suspense>
    </>
  );
}
