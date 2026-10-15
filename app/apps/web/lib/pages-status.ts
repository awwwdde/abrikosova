/**
 * Разделы, которые ещё не свёрстаны по макету: вместо них посетитель видит
 * «Страница в разработке» (решение заказчика 30.09, задание 004h). Код самих
 * страниц не удалён — middleware.ts просто не пускает к нему.
 *
 * Сделали раздел по макету → удалить его отсюда. Больше ничего менять не нужно.
 */
export const WIP_SECTIONS: readonly string[] = [];

/** Внутренний адрес заглушки: middleware переписывает на него закрытые разделы. */
export const WIP_ROUTE = "/under-construction";

/**
 * Закрыт ли адрес. Совпадение по сегменту: `/catalog` закрывает `/catalog`
 * и `/catalog/torty/bento`, но не `/catalogue`.
 */
export function isWipPath(pathname: string): boolean {
  return WIP_SECTIONS.some((section) => pathname === section || pathname.startsWith(`${section}/`));
}
