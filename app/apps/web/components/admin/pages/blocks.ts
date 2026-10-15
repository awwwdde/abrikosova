/**
 * Блоки страниц для редактора (011f): из каких полей состоит каждый блок.
 * Пути — от значения страницы (`content.hero.title_lines`), формы полей — те же,
 * что в `schemas/pages.py` (у главной и контактов) и в текущем контенте (у «О нас»
 * и «Тортов на заказ», где контент пока свободный).
 */

import type { PageKey } from "@/lib/page-editor";

export type FieldSpec =
  | {
      kind: "text";
      path: string;
      label: string;
      multiline?: boolean;
      hint?: string;
      inputMode?: "decimal" | "numeric" | "url";
      /** «date» — выбор даты браузером, значение ГГГГ-ММ-ДД */
      type?: "date";
    }
  | { kind: "image"; path: string; label: string; hint?: string }
  | { kind: "video"; path: string; label: string }
  | {
      kind: "lines";
      path: string;
      label: string;
      itemLabel: string;
      multiline?: boolean;
      hint?: string;
    }
  | {
      kind: "objects";
      path: string;
      label: string;
      itemLabel: string;
      fields: {
        key: string;
        label: string;
        multiline?: boolean;
        inputMode?: "url";
        kind?: "image";
      }[];
      max?: number;
      hint?: string;
    };

export type BlockSpec = {
  id: string;
  label: string;
  /** Блок — необязательный объект в content: пока его нет, сайт берёт текст макета */
  optionalObject?: { path: string; empty: unknown };
  fields: FieldSpec[];
  note?: string;
};

const CTA = (path: string): FieldSpec[] => [
  { kind: "text", path: `${path}.label`, label: "Текст кнопки" },
  {
    kind: "text",
    path: `${path}.href`,
    label: "Куда ведёт кнопка",
    hint: "Путь на сайте (/catalog) или https://",
    inputMode: "url",
  },
];

const INTRO = (id: string, label: string): BlockSpec => ({
  id,
  label,
  optionalObject: {
    path: `content.${id}`,
    empty: { title: "", subtitle: "", cta: { label: "", href: "" } },
  },
  fields: [
    { kind: "text", path: `content.${id}.title`, label: "Заголовок" },
    { kind: "text", path: `content.${id}.subtitle`, label: "Подзаголовок", multiline: true },
    ...CTA(`content.${id}.cta`),
  ],
});

const LEGAL_BLOCKS: BlockSpec[] = [
  {
    id: "revisions",
    label: "Редакции документов",
    note: "«Редакция от …» под заголовком документа. Сами тексты меняет разработчик вместе с юристом; оператор персональных данных — из реквизитов на вкладке «Контакты».",
    fields: [
      {
        kind: "text",
        type: "date",
        path: "content.privacy_revised_at",
        label: "Политика конфиденциальности",
      },
      {
        kind: "text",
        type: "date",
        path: "content.terms_revised_at",
        label: "Пользовательское соглашение",
      },
      {
        kind: "text",
        type: "date",
        path: "content.consent_revised_at",
        label: "Согласие на обработку персональных данных",
      },
    ],
  },
];

export const PAGE_BLOCKS: Record<PageKey, BlockSpec[]> = {
  home: [
    {
      id: "hero",
      label: "Первый экран",
      optionalObject: {
        path: "content.hero",
        empty: { title_lines: [""], subtitle_lines: [""], cta: { label: "", href: "" } },
      },
      fields: [
        {
          kind: "lines",
          path: "content.hero.title_lines",
          label: "Строки заголовка",
          itemLabel: "Строка",
          hint: "Каждая строка — с новой строки на сайте, как на макете",
        },
        {
          kind: "lines",
          path: "content.hero.subtitle_lines",
          label: "Строки подзаголовка",
          itemLabel: "Строка",
        },
        ...CTA("content.hero.cta"),
        { kind: "video", path: "content.hero.video_key", label: "Видео первого экрана" },
        {
          kind: "image",
          path: "content.hero.poster_key",
          label: "Постер видео",
          hint: "Показываем до загрузки ролика и при отключённых анимациях",
        },
      ],
    },
    {
      id: "ticker",
      label: "Бегущая строка",
      fields: [{ kind: "lines", path: "content.ticker", label: "Пункты", itemLabel: "Пункт" }],
    },
    INTRO("ready_today", "«Готово сегодня»"),
    INTRO("made_to_order", "«Сделано на заказ»"),
    {
      id: "fillings_intro",
      label: "«Вкус изнутри»",
      fields: [
        {
          kind: "lines",
          path: "content.fillings_intro",
          label: "Абзацы подзаголовка",
          itemLabel: "Абзац",
          multiline: true,
        },
      ],
    },
    {
      id: "order_banner",
      label: "Баннер заказа",
      optionalObject: { path: "content.order_banner", empty: { title: "", text: "" } },
      fields: [
        { kind: "text", path: "content.order_banner.title", label: "Заголовок" },
        {
          kind: "text",
          path: "content.order_banner.text",
          label: "Текст",
          multiline: true,
          hint: "Перенос строки сохраняется на сайте",
        },
      ],
    },
    {
      id: "author",
      label: "Блок Елены",
      optionalObject: {
        path: "content.author",
        empty: { name: "", role: "", quote: "", paragraphs: [], stats: [] },
      },
      fields: [
        { kind: "text", path: "content.author.name", label: "Имя" },
        { kind: "text", path: "content.author.role", label: "Подпись под именем" },
        { kind: "text", path: "content.author.quote", label: "Цитата", multiline: true },
        {
          kind: "lines",
          path: "content.author.paragraphs",
          label: "Абзацы",
          itemLabel: "Абзац",
          multiline: true,
        },
        {
          kind: "objects",
          path: "content.author.stats",
          label: "Показатели",
          itemLabel: "Показатель",
          max: 4,
          hint: "Три-четыре цифры: «12 лет», «3000 тортов»",
          fields: [
            { key: "value", label: "Цифра" },
            { key: "label", label: "Подпись" },
          ],
        },
        { kind: "image", path: "content.author.image_key", label: "Портрет" },
      ],
    },
    {
      id: "coffee",
      label: "Кофейня",
      note: "Метки кофейни, фото интерьера и «как добраться» хранятся в контенте страницы «Контакты»: главная и подвал берут их оттуда. Правьте их на вкладке «Контакты», блок «Кофейня».",
      fields: [],
    },
    {
      id: "faq",
      label: "Вопросы",
      fields: [
        {
          kind: "objects",
          path: "content.faq",
          label: "Вопросы и ответы",
          itemLabel: "Вопрос",
          hint: "Эти же вопросы уходят в разметку FAQPage для поисковиков",
          fields: [
            { key: "question", label: "Вопрос" },
            { key: "answer", label: "Ответ", multiline: true },
          ],
        },
      ],
    },
  ],
  contacts: [
    {
      id: "main",
      label: "Адрес и часы",
      fields: [
        { kind: "text", path: "content.title", label: "Заголовок страницы" },
        {
          kind: "text",
          path: "content.intro",
          label: "Вступление на странице контактов",
          multiline: true,
        },
        { kind: "text", path: "content.email", label: "Почта" },
        { kind: "text", path: "address", label: "Адрес" },
        { kind: "text", path: "phone", label: "Телефон" },
        { kind: "text", path: "work_hours_weekdays", label: "Часы в будни" },
        { kind: "text", path: "work_hours_weekend", label: "Часы в выходные" },
        { kind: "text", path: "delivery_hours", label: "Часы доставки" },
        {
          kind: "text",
          path: "content.geo.latitude",
          label: "Широта",
          inputMode: "decimal",
          hint: "Для точки в поисковой выдаче: «Что здесь?» на Яндекс.Картах — 55,715500",
        },
        { kind: "text", path: "content.geo.longitude", label: "Долгота", inputMode: "decimal" },
      ],
    },
    {
      id: "coffee",
      label: "Кофейня",
      fields: [
        {
          kind: "text",
          path: "content.how_to_get",
          label: "Как добраться",
          multiline: true,
          hint: "Перенос строки сохраняется",
        },
        {
          kind: "lines",
          path: "content.features",
          label: "Метки",
          itemLabel: "Метка",
          hint: "«Кофе с собой», «Вай-фай»",
        },
        { kind: "image", path: "content.interior_image_key", label: "Фото интерьера" },
        { kind: "text", path: "content.award", label: "Награда" },
      ],
    },
    {
      id: "links",
      label: "Ссылки",
      fields: [
        {
          kind: "text",
          path: "content.route_url",
          label: "Построить маршрут",
          inputMode: "url",
          hint: "Ссылка на Яндекс.Карты, только https",
        },
        {
          kind: "text",
          path: "yandex_maps_url",
          label: "Отзывы на Яндекс.Картах",
          inputMode: "url",
        },
        { kind: "text", path: "telegram_url", label: "Telegram", inputMode: "url" },
        {
          kind: "objects",
          path: "content.socials",
          label: "Соцсети",
          itemLabel: "Ссылка",
          hint: "Только https://",
          fields: [
            { key: "label", label: "Название" },
            { key: "href", label: "Ссылка", inputMode: "url" },
          ],
        },
      ],
    },
    {
      id: "yandex",
      label: "Рейтинг Яндекса",
      fields: [
        {
          kind: "text",
          path: "yandex_rating",
          label: "Рейтинг",
          inputMode: "decimal",
          hint: "От 0 до 5: 4,9",
        },
        { kind: "text", path: "yandex_reviews_count", label: "Число оценок", inputMode: "numeric" },
        {
          kind: "text",
          path: "content.reviews_count_text",
          label: "Подпись про отзывы",
          hint: "«85 отзывов»: число отзывов и оценок на Яндексе разное",
        },
      ],
    },
    {
      id: "delivery",
      label: "Доставка и оплата",
      fields: [
        {
          kind: "text",
          path: "content.pickup_description",
          label: "Самовывоз — текст на странице контактов",
          multiline: true,
        },
        {
          kind: "text",
          path: "content.delivery_description",
          label: "Доставка — текст на странице контактов",
          multiline: true,
        },
        { kind: "text", path: "content.delivery", label: "Доставка", multiline: true },
        { kind: "text", path: "content.pickup", label: "Самовывоз", multiline: true },
        { kind: "text", path: "content.payment", label: "Оплата", multiline: true },
        {
          kind: "text",
          path: "content.pickup_place",
          label: "Где забирать — для корзины и страницы заказа",
          hint: "«на Гжатской, 5к8»: «Кондитерская на Гжатской, 5к8, каждый день…»",
        },
        {
          kind: "text",
          path: "content.product_pickup",
          label: "Самовывоз — строка на странице товара",
        },
        {
          kind: "text",
          path: "content.product_delivery",
          label: "Доставка — строка на странице товара",
        },
        {
          kind: "text",
          path: "content.catalog_note",
          label: "Строка в каталоге",
          multiline: true,
          hint: "Справа от заголовка «Каталог», две строки: «Самовывоз на Гжатской» и часы",
        },
      ],
    },
    {
      id: "legal",
      label: "Реквизиты",
      optionalObject: { path: "content.legal", empty: { name: "", ogrnip: "" } },
      fields: [
        { kind: "text", path: "content.legal.name", label: "Название" },
        {
          kind: "text",
          path: "content.legal.inn",
          label: "ИНН ИП",
          inputMode: "numeric",
          hint: "Ровно 12 цифр",
        },
        { kind: "text", path: "content.legal.production_address", label: "Адрес производства" },
        {
          kind: "text",
          path: "content.legal.ogrnip",
          label: "ОГРНИП",
          inputMode: "numeric",
          hint: "Ровно 15 цифр",
        },
      ],
    },
  ],
  custom_cakes: [
    {
      id: "intro",
      label: "Заголовок",
      fields: [
        { kind: "text", path: "content.title", label: "Заголовок" },
        {
          kind: "text",
          path: "content.subtitle",
          label: "Подзаголовок",
          hint: "С новой строки — как на странице",
          multiline: true,
        },
        {
          kind: "text",
          path: "content.consultation_text",
          label: "Текст ячейки «Торт по вашей идее»",
          hint: "Бордовая ячейка первой в сетке дизайнов",
          multiline: true,
        },
      ],
    },
    {
      id: "calculator",
      label: "Калькулятор",
      note: "«Сколько нужно торта». Первое предложение «Считаем около 150 г на гостя.» сайт пишет сам — граммы из «Настроек → Торты на заказ».",
      fields: [
        {
          kind: "text",
          path: "content.calculator_text",
          label: "Текст после граммов на гостя",
          multiline: true,
        },
        {
          kind: "text",
          path: "content.calculator_note",
          label: "Строка под результатом",
          multiline: true,
        },
      ],
    },
    {
      id: "stages",
      label: "Этапы",
      fields: [
        {
          kind: "objects",
          path: "content.stages",
          label: "Этапы заказа",
          itemLabel: "Этап",
          max: 4,
          fields: [
            { key: "title", label: "Название" },
            { key: "duration", label: "Срок" },
            { key: "text", label: "Текст", multiline: true },
          ],
        },
      ],
    },
    {
      id: "order_facts",
      label: "Как заказать: факты",
      note: "Под этапами — четыре факта. «Минимальный вес» и «Срок» сайт берёт из «Настроек → Торты на заказ», здесь — хвост срока и ещё два факта.",
      fields: [
        {
          kind: "text",
          path: "content.lead_days_note",
          label: "Хвост факта «Срок»",
          hint: "«от 5 дней» + этот текст через запятую, например: ярусные от 10",
        },
        {
          kind: "objects",
          path: "content.order_facts",
          label: "Факты",
          itemLabel: "Факт",
          max: 2,
          hint: "Например: «Аванс» — «50% после эскиза»",
          fields: [
            { key: "label", label: "Подпись" },
            { key: "value", label: "Значение" },
          ],
        },
      ],
    },
    {
      id: "prices_fillings",
      label: "Цены и начинки",
      note: "Цены за кг — в «Настройках → Торты на заказ», начинки — в разделе «Торты на заказ и начинки». Здесь — тексты блоков.",
      fields: [
        {
          kind: "text",
          path: "content.prices_intro",
          label: "Текст под «Ценами»",
          multiline: true,
        },
        {
          kind: "text",
          path: "content.prices_note",
          label: "Строка под ценами",
          hint: "Что влияет на итог",
          multiline: true,
        },
        {
          kind: "text",
          path: "content.fillings_intro",
          label: "Текст под «Начинками»",
          multiline: true,
        },
        {
          kind: "text",
          path: "content.tasting_set_slug",
          label: "Дегустационный сет — адрес товара",
          hint: "Из каталога, например degustacionnyy-set: плашка берёт из товара цену, «Заказать сет» кладёт его в корзину",
        },
        {
          kind: "text",
          path: "content.design_filling_note",
          label: "Строка «Начинка» на странице дизайна",
          hint: "Например: любая из списка, у ярусов может быть разная",
        },
      ],
    },
    {
      id: "faq",
      label: "Вопросы",
      fields: [
        {
          kind: "objects",
          path: "content.faq",
          label: "Вопросы и ответы",
          itemLabel: "Вопрос",
          max: 20,
          fields: [
            { key: "question", label: "Вопрос" },
            { key: "answer", label: "Ответ", multiline: true },
          ],
        },
      ],
    },
    {
      id: "header_menu",
      label: "Меню в шапке",
      note: "Мега-меню «Торты на заказ» в шапке сайта: карточки поводов и строка фактов. Без фото карточка — бежевая плашка.",
      optionalObject: { path: "content.header_menu", empty: { facts: "", cards: [] } },
      fields: [
        {
          kind: "text",
          path: "content.header_menu.facts",
          label: "Строка фактов",
          hint: "Например: от 2 кг · от 5 дней · от 3 200 ₽ за кг",
        },
        {
          kind: "objects",
          path: "content.header_menu.cards",
          label: "Карточки поводов",
          itemLabel: "Повод",
          max: 4,
          hint: "Повод — код фильтра «Работ»: wedding, birthday, kids или anniversary_corporate (юбилей и корпоратив)",
          fields: [
            { key: "label", label: "Подпись" },
            { key: "occasion", label: "Повод (код фильтра)" },
            { key: "image_key", label: "Фото", kind: "image" },
          ],
        },
      ],
    },
  ],
  about: [
    {
      id: "biography",
      label: "История Елены",
      note: "Имя, цитата, показатели и портрет — из блока «Елена» главной. Здесь — отдельные абзацы для страницы «О нас».",
      fields: [
        {
          kind: "lines",
          path: "content.biography",
          label: "Биография",
          itemLabel: "Абзац",
          multiline: true,
        },
      ],
    },
    {
      id: "timeline",
      label: "Путь",
      fields: [
        {
          kind: "objects",
          path: "content.timeline",
          label: "Хронология",
          itemLabel: "Этап",
          max: 12,
          fields: [
            { key: "year", label: "Год" },
            { key: "title", label: "Название" },
            { key: "text", label: "Описание", multiline: true },
          ],
        },
      ],
    },
    {
      id: "workflow",
      label: "Как мы работаем",
      fields: [
        { kind: "image", path: "content.workshop_image_key", label: "Фото кухни" },
        {
          kind: "objects",
          path: "content.workflow",
          label: "Принципы работы",
          itemLabel: "Принцип",
          max: 8,
          fields: [
            { key: "title", label: "Название" },
            { key: "text", label: "Описание", multiline: true },
          ],
        },
      ],
    },
    {
      id: "team",
      label: "Команда",
      fields: [
        {
          kind: "objects",
          path: "content.team",
          label: "Сотрудники",
          itemLabel: "Сотрудник",
          max: 12,
          fields: [
            { key: "name", label: "Имя" },
            { key: "role", label: "Роль" },
            { key: "image_key", label: "Портрет", kind: "image" },
            { key: "placeholder", label: "Подпись без фотографии" },
          ],
        },
      ],
    },
    {
      id: "main",
      label: "Основное",
      fields: [
        { kind: "text", path: "content.title", label: "Заголовок" },
        { kind: "text", path: "content.main_text", label: "Текст", multiline: true },
      ],
    },
    {
      id: "principles",
      label: "Принципы",
      fields: [
        {
          kind: "objects",
          path: "content.principles",
          label: "Принципы",
          itemLabel: "Принцип",
          fields: [
            { key: "title", label: "Название" },
            { key: "text", label: "Текст", multiline: true },
          ],
        },
      ],
    },
    {
      id: "coffee_shop",
      label: "Кофейня",
      fields: [
        { kind: "text", path: "content.coffee_shop.title", label: "Заголовок" },
        { kind: "text", path: "content.coffee_shop.text", label: "Текст", multiline: true },
      ],
    },
  ],
  legal: LEGAL_BLOCKS,
  gallery: [
    {
      id: "intro",
      label: "Вступление",
      fields: [
        {
          kind: "text",
          path: "content.intro",
          label: "Текст справа от заголовка «Работы»",
          multiline: true,
        },
      ],
    },
    {
      id: "cta",
      label: "Плашка внизу",
      note: "Бордовая плашка под работами; кнопка «Заказать свой дизайн» ведёт в «Торты на заказ».",
      optionalObject: { path: "content.cta", empty: { title: "", text: "" } },
      fields: [
        { kind: "text", path: "content.cta.title", label: "Заголовок" },
        { kind: "text", path: "content.cta.text", label: "Текст", multiline: true },
      ],
    },
  ],
};

export const PAGE_TABS: { key: PageKey; label: string; href: string }[] = [
  { key: "home", label: "Главная", href: "/" },
  { key: "about", label: "О нас", href: "/about" },
  { key: "custom_cakes", label: "Торты на заказ", href: "/custom-cakes" },
  { key: "gallery", label: "Работы", href: "/gallery" },
  { key: "contacts", label: "Контакты", href: "/contacts" },
  { key: "legal", label: "Документы", href: "/privacy" },
];
