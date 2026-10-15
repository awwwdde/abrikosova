"""Сброс кэша публичных страниц после правок в админке.

Каталог и страницы контента отдаются с ISR-кэшем на стороне Next.js. Без
явного сброса изменение, сделанное в админке, появилось бы на сайте только
после истечения интервала ревалидации — для владелицы это выглядит как
«ничего не сохранилось».

Вызывается через BackgroundTasks: ответ админке не должен ждать похода во
фронтенд, а неудача сброса не должна отменять уже сохранённую правку —
в худшем случае страница обновится по обычному расписанию.
"""

import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def cache_tags(paths: list[str], tags: list[str] | None = None) -> list[str]:
    """Теги кэша Next.js к сбросу (014).

    Разделы каталога читает мега-меню шапки на каждой странице сайта, поэтому
    любая правка каталога (в путях есть /catalog) сбрасывает и тег `categories`.
    Страницы контента помечены тегом своего ключа (`contacts`…) — его передаёт
    сохранение страницы в админке.
    """
    result = list(tags or [])
    if any(path == "/catalog" or path.startswith("/catalog/") for path in paths):
        result.append("categories")
    # «Торты на заказ» (008b): страница читает дизайны, начинки и /info с тегом
    # `custom_cakes` — тем же, что у страницы контента, поэтому правка дизайна,
    # начинки или текстов доходит до сайта сразу
    if any(path == "/custom-cakes" or path.startswith("/custom-cakes/") for path in paths):
        result.append("custom_cakes")
    return sorted(set(result))


def revalidate_paths(paths: list[str], tags: list[str] | None = None) -> None:
    settings = get_settings()
    tags = cache_tags(paths, tags)

    if not (settings.web_revalidate_url and settings.revalidate_secret):
        logger.debug("Ревалидация не настроена — пропускаю сброс кэша %s", paths)
        return

    try:
        response = httpx.post(
            settings.web_revalidate_url,
            json={"paths": paths, "tags": tags},
            headers={"x-revalidate-secret": settings.revalidate_secret},
            timeout=5,
        )
        response.raise_for_status()
        logger.info("Сброшен кэш страниц: %s; теги: %s", ", ".join(paths), ", ".join(tags))
    except httpx.HTTPError:
        logger.warning("Не удалось сбросить кэш страниц %s", paths, exc_info=True)


def catalog_paths(product_slug: str | None = None) -> list[str]:
    """Пути, на которые влияет изменение товара или категории.

    sitemap.xml — тоже (012): новый, скрытый или переименованный товар должен
    появиться в карте или пропасть из неё сразу, а не через час ISR.
    """
    paths = ["/", "/catalog", "/sitemap.xml"]
    if product_slug:
        paths.append(f"/product/{product_slug}")
    return paths
