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


def revalidate_paths(paths: list[str]) -> None:
    settings = get_settings()

    if not (settings.web_revalidate_url and settings.revalidate_secret):
        logger.debug("Ревалидация не настроена — пропускаю сброс кэша %s", paths)
        return

    try:
        response = httpx.post(
            settings.web_revalidate_url,
            json={"paths": paths},
            headers={"x-revalidate-secret": settings.revalidate_secret},
            timeout=5,
        )
        response.raise_for_status()
        logger.info("Сброшен кэш страниц: %s", ", ".join(paths))
    except httpx.HTTPError:
        logger.warning("Не удалось сбросить кэш страниц %s", paths, exc_info=True)


def catalog_paths(product_slug: str | None = None) -> list[str]:
    """Пути, на которые влияет изменение товара или категории."""
    paths = ["/", "/catalog"]
    if product_slug:
        paths.append(f"/product/{product_slug}")
    return paths
