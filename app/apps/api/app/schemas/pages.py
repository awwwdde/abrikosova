"""Типизированный `content` страниц «Главная» и «Контакты».

`PageContent.content` в базе — свободный JSONB: блоки страниц меняются чаще,
чем стоит делать миграции. Но из этого JSON тексты и ссылки попадают прямо
в вёрстку, и без схемы через админку можно было сохранить опечатку в ключе
(блок молча пропадал с сайта) или `javascript:`-ссылку в кнопке (XSS).
Поэтому у двух страниц, чей контент уже устоялся по макету, есть схема:
админка проверяет по ней `PUT /admin/pages/{key}`, а публичные `GET /pages/home`
и `GET /pages/contacts` отдают её в OpenAPI — фронтенд получает типы
из генерации, а не пишет их руками.

Остальные страницы пока свободный JSON; в нём проверяются только ссылки
(`check_links`).
"""

from datetime import date
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, ValidationError

from app.models.enums import GalleryOccasion, PageKey
from app.schemas.common import HttpsUrl, SafeHref

Line = Annotated[str, Field(min_length=1, max_length=300)]
Paragraph = Annotated[str, Field(min_length=1, max_length=2000)]


class ContentBlock(BaseModel):
    # Лишний ключ — почти всегда опечатка: лучше 422 в админке, чем блок,
    # который молча не появился на сайте
    model_config = ConfigDict(extra="forbid")


class Cta(ContentBlock):
    label: Line
    href: SafeHref


class HeroBlock(ContentBlock):
    # Строки списком: переносы на макете смысловые, браузеру их не отдаём
    title_lines: list[Line]
    subtitle_lines: list[Line]
    cta: Cta

    video_key: Annotated[str, Field(pattern=r"^hero/[a-f0-9]{32}\.mp4$")] | None = None
    poster_key: Annotated[str, Field(pattern=r"^(hero|pages)/[a-f0-9]{32}\.webp$")] | None = None


class SectionIntro(ContentBlock):
    title: Line
    subtitle: Paragraph
    cta: Cta


class OrderBanner(ContentBlock):
    """Бордовая плашка «Опишите повод и дату» под этапами заказа."""

    title: Line
    # Перенос строки (\n) в тексте сохраняется на сайте
    text: Paragraph


class AuthorStat(ContentBlock):
    value: Line
    label: Line


class AuthorBlock(ContentBlock):
    """Блок Елены на главной: портрет, цитата, два абзаца и три показателя."""

    name: Line
    role: Line
    quote: Paragraph
    paragraphs: list[Paragraph] = []
    stats: Annotated[list[AuthorStat], Field(max_length=4)] = []
    # Портрет загружается через POST /admin/uploads?prefix=pages
    image_key: Annotated[str | None, Field(max_length=500)] = None


class FaqItem(ContentBlock):
    question: Line
    answer: Paragraph


class HomeContent(ContentBlock):
    """Главная сверху вниз. Любой блок может отсутствовать — тогда на сайте
    его нет (герой и заголовки витрины берут тексты макета по умолчанию)."""

    hero: HeroBlock | None = None
    ticker: list[Line] = []
    ready_today: SectionIntro | None = None
    made_to_order: SectionIntro | None = None
    # Подзаголовок «Вкус изнутри» — абзацы, каждый с новой строки
    fillings_intro: list[Paragraph] = []
    order_banner: OrderBanner | None = None
    author: AuthorBlock | None = None
    faq: list[FaqItem] = []


class SocialLink(ContentBlock):
    label: Line
    href: HttpsUrl


class LegalInfo(ContentBlock):
    """Реквизиты ИП в подвале."""

    name: Line
    # ОГРНИП — ровно 15 цифр
    ogrnip: Annotated[str, Field(pattern=r"^\d{15}$")]
    inn: Annotated[str | None, Field(pattern=r"^\d{12}$")] = None
    production_address: Line | None = None


class GeoPoint(ContentBlock):
    """Координаты кондитерской для разметки `Bakery.geo` (задание 012).

    Отдельно от адреса: из строки «Гжатская улица, 5к8» координаты не получить
    без геокодера, а выдумывать их нельзя — точка на карте в выдаче покажет не туда.
    """

    latitude: Annotated[float, Field(ge=-90, le=90)]
    longitude: Annotated[float, Field(ge=-180, le=180)]


class ContactsContent(ContentBlock):
    """Контакты: тексты страницы и всё, что выводится в блоке кондитерской
    на главной и в подвале, кроме адреса, телефона и часов — те лежат
    структурированными полями `PageContent`."""

    title: Line | None = None
    intro: Paragraph | None = None
    email: Annotated[str | None, Field(max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")] = (
        None
    )
    # Развёрнутые условия на странице контактов; короткие подписи товара — отдельно.
    pickup_description: Paragraph | None = None
    delivery_description: Paragraph | None = None
    # Блок «Доставка и оплата» карточки товара читает эти три поля
    delivery: Paragraph | None = None
    pickup: Paragraph | None = None
    payment: Paragraph | None = None
    # Две строки справа от заголовка каталога: «Самовывоз на Гжатской
    # с 9:00 до 21:00, доставка по Москве» (макет каталога, 005b)
    catalog_note: Paragraph | None = None
    # Строки «Самовывоз» и «Доставка» на странице товара (006): «Гжатская, 5к8,
    # с 9:00 до 21:00», «По Москве, окна по 3 часа».
    # Текстом. Цена доставки («от 500 ₽, бесплатно от 5 000 ₽») — не здесь, а в настройках
    # (007a/007b): её считает корзина, страница товара собирает строку из тех же чисел
    product_pickup: Line | None = None
    # «на Гжатской, 5к8» — где забирать, в предложном падеже (007b): корзина пишет
    # «Кондитерская на Гжатской, 5к8, каждый день с 9:00 до 21:00», страница «Заказ
    # принят» — «Заказ ждёт вас на Гжатской, 5к8, 9 октября с 15:00 до 18:00»
    pickup_place: Line | None = None
    product_delivery: Line | None = None
    # «440 м от остановки,\n1,4 км от Давыдково» — перенос сохраняется
    how_to_get: Paragraph | None = None
    # Метки кондитерской: «Кофе с собой», «Вай-фай»…
    features: list[Line] = []
    # «Построить маршрут» — ссылка на Яндекс.Карты
    route_url: HttpsUrl | None = None
    # «85 отзывов» — текстом: число отзывов и число оценок на Яндексе разные
    reviews_count_text: Line | None = None
    award: Line | None = None
    # Фото интерьера, POST /admin/uploads?prefix=pages
    interior_image_key: Annotated[str | None, Field(max_length=500)] = None
    socials: list[SocialLink] = []
    legal: LegalInfo | None = None
    geo: GeoPoint | None = None


class AboutTextBlock(ContentBlock):
    title: Line
    text: Paragraph


class AboutMilestone(AboutTextBlock):
    year: Annotated[str, Field(pattern=r"^\d{4}$")]


class TeamMember(ContentBlock):
    name: Line
    role: Line
    image_key: Annotated[str | None, Field(max_length=500)] = None
    placeholder: Line | None = None


class AboutContent(ContentBlock):
    # Старые поля сохраняются: редактор не теряет уже написанные тексты.
    title: Line | None = None
    main_text: Paragraph | None = None
    principles: list[AboutTextBlock] = []
    coffee_shop: AboutTextBlock | None = None
    biography: list[Paragraph] | None = None
    timeline: Annotated[list[AboutMilestone] | None, Field(max_length=12)] = None
    workflow: Annotated[list[AboutTextBlock] | None, Field(max_length=8)] = None
    workshop_image_key: Annotated[str | None, Field(max_length=500)] = None
    team: Annotated[list[TeamMember] | None, Field(max_length=12)] = None


class CakeStage(ContentBlock):
    """Этап заказа торта: блок «Торт под событие» на главной."""

    title: Line
    duration: Line | None = None
    text: Paragraph


class CakesMenuCard(ContentBlock):
    """Карточка повода в мега-меню «Торты на заказ» (014)."""

    # Значение фильтра «Работ» (009): «Юбилей и корпоратив» — одна группа
    occasion: GalleryOccasion
    # «Юбилей и корпоратив» — подпись шире названия повода в фильтре
    label: Line
    # Фото, POST /admin/uploads?prefix=pages; нет — бежевая плашка, как в макете
    image_key: Annotated[str | None, Field(max_length=500)] = None


class CakesHeaderMenu(ContentBlock):
    """Мега-меню «Торты на заказ» в шапке (014): четыре повода и строка фактов
    «от 2 кг · от 5 дней · от 3 200 ₽ за кг» — текстом, как в макете."""

    facts: Line | None = None
    cards: Annotated[list[CakesMenuCard], Field(max_length=4)] = []


class CakeFact(ContentBlock):
    """Факт под шагами «Как заказать»: подпись сверху, значение крупно."""

    label: Line
    value: Line


class CakeQuestion(ContentBlock):
    question: Line
    answer: Paragraph


class CustomCakesContent(ContentBlock):
    """«Торты на заказ»: до 014 контент был свободным JSON (находка 11 из 004b).
    Схема повторяет то, что уже лежит в базе, плюс меню шапки."""

    title: Line | None = None
    subtitle: Line | None = None
    consultation_text: Paragraph | None = None
    stages: Annotated[list[CakeStage], Field(max_length=8)] = []
    header_menu: CakesHeaderMenu | None = None
    # Страница «Торты на заказ» (008a). Цифры — из настроек, здесь только тексты.
    # consultation_text — текст бордовой ячейки «Торт по вашей идее» (008b)
    # Калькулятор (008b): после «Считаем около 150 г на гостя.» — граммы из настроек
    calculator_text: Paragraph | None = None
    # Строка под результатом калькулятора
    calculator_note: Paragraph | None = None
    prices_intro: Paragraph | None = None
    prices_note: Paragraph | None = None
    fillings_intro: Paragraph | None = None
    # Хвост факта «Срок»: «от 5 дней» + «, ярусные от 10»
    lead_days_note: Line | None = None
    # Факты под «Как заказать» после «Минимального веса» и «Срока»: «Аванс — 50% после эскиза»
    order_facts: Annotated[list[CakeFact], Field(max_length=4)] = []
    faq: Annotated[list[CakeQuestion], Field(max_length=20)] = []
    # Строка «Начинка» в таблице дизайна
    design_filling_note: Line | None = None
    # Товар каталога «Дегустационный сет» в скрытом разделе «К торту» (007a)
    tasting_set_slug: Annotated[str | None, Field(default=None, max_length=200)]


class GalleryCta(ContentBlock):
    """Бордовая плашка внизу «Работ»: «Не нашли похожий?»."""

    title: Line
    text: Paragraph


class GalleryContent(ContentBlock):
    """Страница «Работы» (009): текст справа от заголовка и плашка внизу.
    Отдельная страница контента, а не блок «Тортов на заказ»: в «Страницах сайта»
    редактор ищет текст «Работ» на вкладке «Работы»."""

    intro: Paragraph | None = None
    cta: GalleryCta | None = None


class LegalContent(ContentBlock):
    """Правовые документы (010b): «Редакция от …» под заголовком каждого.

    Тексты документов — в коде страниц: их правит юрист вместе с разработчиком,
    а не редактор. Имя оператора ПДн — из реквизитов контактов (`legal.name`),
    чтобы исправлять его в одном месте. Дата — то, что меняется при каждой
    новой редакции, поэтому она здесь.
    """

    privacy_revised_at: date | None = None
    terms_revised_at: date | None = None
    consent_revised_at: date | None = None


PAGE_CONTENT_SCHEMAS: dict[PageKey, type[ContentBlock]] = {
    PageKey.HOME: HomeContent,
    PageKey.CONTACTS: ContactsContent,
    PageKey.ABOUT: AboutContent,
    PageKey.CUSTOM_CAKES: CustomCakesContent,
    PageKey.LEGAL: LegalContent,
    PageKey.GALLERY: GalleryContent,
}

# Ключи свободного JSON, значение которых уходит в href
_LINK_KEYS = ("href", "url")
_safe_href = TypeAdapter(SafeHref)


def _is_link_key(key: str) -> bool:
    return key in _LINK_KEYS or key.endswith("_url") or key.endswith("_href")


def check_links(value: Any, path: tuple[str | int, ...] = ()) -> list[dict[str, Any]]:
    """Ищет в свободном JSON ссылки, которые нельзя класть в href.

    Возвращает ошибки в формате ошибок валидации FastAPI (`loc`, `msg`, `type`),
    чтобы админка показала их так же, как любые другие 422.
    """
    errors: list[dict[str, Any]] = []
    if isinstance(value, dict):
        for key, item in value.items():
            if _is_link_key(str(key)) and isinstance(item, str):
                try:
                    _safe_href.validate_python(item)
                except ValidationError:
                    errors.append(
                        {
                            "loc": (*path, key),
                            "msg": "Ссылка должна начинаться с https:// или с / (путь на сайте)",
                            "type": "value_error",
                        }
                    )
            else:
                errors.extend(check_links(item, (*path, key)))
    elif isinstance(value, list):
        for index, item in enumerate(value):
            errors.extend(check_links(item, (*path, index)))
    return errors
