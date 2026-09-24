# API-контракт (FastAPI)

Базовый префикс: `/api/v1`. Формат ответа — JSON. Ошибки — единый формат `{ "detail": string | object }` (стандарт FastAPI). Пагинация везде, где отдаётся список, — через query-параметры `page` и `page_size` (default `page_size=12`, как было в старом каталоге, но теперь с реальной пагинацией, а не обрезкой списка — см. `ANALYSIS.md`, п. 2.1.8), ответ — `{ items: [...], total: number, page: number, page_size: number }`.

Ниже — эндпоинты по доменам. Схемы запросов/ответов Claude Code формализует как Pydantic-модели по составу полей из `01-data-model.md`; здесь фиксируется состав и назначение эндпоинтов, а не байтовая схема JSON.

## Публичный API (без авторизации)

### Каталог

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/catalog/categories` | Дерево категорий с подкатегориями (`is_active=true`), для меню/сайдбара каталога |
| GET | `/catalog/filters` | 🆕² Справочник сквозных фильтров: `occasions[]`, `dietary[]`, `portions[]`, `availability[]` — каждое `{value, label}` с русской подписью, плюс `price {min, max}` по каталогу или по `?category=` |
| GET | `/catalog/products` | Список товаров с фильтрами: `category`, `subcategory`, `search` (по названию), `sort` (`price_asc`, `price_desc`, `name`, `new`), `is_featured` (bool — используется главной страницей для блока «Популярные позиции», см. `03-pages-wireframes.md`), пагинация. 🆕² Сквозные фильтры (PDF «Этап 1», раздел 12): `occasion` (повтор параметра, **ИЛИ**), `dietary` (повтор параметра, **И** — человеку без глютена и без лактозы нужен товар, подходящий под оба), `portions` (`up_to_4`/`4_8`/`8_15`/`over_15`, повтор, ИЛИ; товар попадает, если его диапазон порций пересекается с корзиной), `availability` (`today` — `lead_time_days=0` и в наличии, `preorder` — `lead_time_days>0`), `price_min`, `price_max` (`min > max` → 422). Пример: `?occasion=kids&occasion=birthday&dietary=low_sugar&portions=8_15`. Элемент списка несёт `weight_grams`, `portions_min/max`, `composition`, `dietary[]`, `occasions[]`, `lead_time_days` — ответ про размер виден прямо в сетке |
| GET | `/catalog/products/{slug}` | Карточка товара: все поля + `images[]` + `related_products[]` (та же подкатегория, до 4 шт., как в старой логике) + `fillings[]`, если подкатегория товара помечена `applies_fillings=true` (флаг на `SubCategory`, см. `01-data-model.md` — заменяет хрупкую проверку по ключевым словам в названии из старого кода, см. `ANALYSIS.md`). 🆕² Плюс `nutrition {kcal, proteins, fats, carbs}` (или `null`, если КБЖУ не заполнено), `transport_time`, `lead_time_days`, `dietary[]`, `occasions[]`, `reviews[]` (до 6 опубликованных отзывов о позиции) и `reviews_total` |

### Торты на заказ

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/custom-cakes` | Список активных позиций + список начинок + контент страницы (`PageContent[custom_cakes]`) |
| POST | `/custom-cakes/consultation` | Создать заявку на консультацию (`ConsultationRequest`), включая опциональную загрузку фото-референса. 🆕² Тело — **`multipart/form-data`**: `name`, `phone`, `description?`, `occasion?`, `event_date?` (не в прошлом), `guests_count?`, `consent_pd`, `website` (honeypot), `reference?` (файл JPEG/PNG/WEBP до 10 МБ; проверяется по содержимому, пересобирается в WEBP, кладётся в закрытый префикс хранилища). Сначала валидируются поля, потом загружается файл — отклонённая заявка не оставляет мусора в хранилище |

### Галерея, отзывы, статичный контент

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/gallery` | Список активных «Примеров работ», с пагинацией. 🆕² `?occasion=` — фильтр по поводу; элемент несёт подпись работы: `occasion`, `tiers`, `guests`, `made_in` |
| GET | `/reviews` | Список опубликованных отзывов (`is_published=true`), с пагинацией. 🆕² `?product={slug}` — отзывы об одной позиции; в каждом отзыве `product {name, slug}` или `null` |
| GET | `/pages/{page_key}` | Контент статичной страницы (`home`, `about`, `contacts`) — используется в `generateStaticParams`/ISR на фронте |

### Контакты

| Метод | Путь | Назначение |
|---|---|---|
| POST | `/contacts/feedback` | Форма обратной связи со страницы «Контакты»: `{ name, phone, message?, consent_pd }`. Создаёт запись в `ConsultationRequest` с `source=contact_page` (см. `01-data-model.md` и примечание в `03-pages-wireframes.md`, страница «Контакты») — та же таблица, что и заявки на консультацию по тортам, но отдельный путь и отдельная точка для rate limiting |

### Корзина (гостевая, без авторизации)

Корзина идентифицируется httpOnly cookie `cart_id` (UUID), которую бэкенд выставляет при первом обращении. Это заменяет схему из старого кода, где корзина хранилась в Django-сессии и параллельно дублировалась в `localStorage` (см. `ANALYSIS.md`, п. 2.1.3) — здесь ровно один источник правды на сервере, фронтенд только читает и мутирует его через API.

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/cart` | Текущее содержимое корзины (товары, количества, сумма). 🆕² Плюс `earliest_date` — самая ранняя дата получения заказа (сегодня по Москве + наибольший `lead_time_days` среди позиций): минимум для календаря в оформлении; у позиции — `lead_time_days` |
| POST | `/cart/items` | Добавить товар `{ product_id, quantity }` |
| PATCH | `/cart/items/{product_id}` | Изменить количество `{ quantity }` (quantity ≤ 0 — удаляет позицию) |
| DELETE | `/cart/items/{product_id}` | Удалить позицию |
| DELETE | `/cart` | Очистить корзину |

Все мутирующие методы — не GET (в старом коде `add_to_cart`/`remove_from_cart` вызывались через `fetch()` без указания метода, то есть GET — прямое нарушение общепринятой практики и требования по CSRF-защите, см. `ANALYSIS.md`, п. 2.1.4).

### Оформление заказа

| Метод | Путь | Назначение |
|---|---|---|
| POST | `/orders` | Создать заказ из текущей корзины: `{ customer_name, customer_phone, customer_comment?, delivery_method, delivery_address?, desired_date?, delivery_interval?, consent_pd }`. Сервер: валидирует (`delivery_address` обязателен при `delivery_method=delivery`, `consent_pd` обязателен `true`), пересчитывает сумму по актуальным ценам, создаёт `Order`+`OrderItem[]`, отправляет e-mail-уведомление администратору (и опционально Telegram, см. `05-nonfunctional-and-acceptance.md`), очищает корзину, возвращает `order_number`. 🆕² Если в корзине есть позиция под заказ, `desired_date` обязательна и не раньше `earliest_date`; иначе — `422` с `detail: {message, earliest_date}`. `delivery_interval` — одно из `09-12`, `12-15`, `15-18`, `18-21` |
| GET | `/orders/{order_number}` | Статус/детали заказа для страницы «заказ оформлен» (публично, без авторизации — по номеру заказа, как в старом коде) |

## Auth (админ-панель)

| Метод | Путь | Назначение |
|---|---|---|
| POST | `/auth/login` | `{ email, password }` → JWT access + refresh (refresh — httpOnly cookie) |
| POST | `/auth/refresh` | Обновление access-токена по refresh-cookie |
| POST | `/auth/logout` | Инвалидация refresh-токена |
| GET | `/auth/me` | Текущий администратор (id, email, role) |

## Admin API (требует JWT, роль `owner`/`manager` — см. матрицу доступа в `04-admin-panel.md`)

Префикс `/api/v1/admin/...`, отдельный от публичного API, чтобы права доступа и rate-limit настраивались независимо.

| Домен | Методы |
|---|---|
| Категории/подкатегории | полный CRUD: `GET/POST /admin/categories`, `GET/PUT/DELETE /admin/categories/{id}`, аналогично для подкатегорий |
| Товары | полный CRUD `/admin/products`, включая загрузку/удаление/сортировку изображений `/admin/products/{id}/images`, простановку меток (`tags`), флага `is_featured` |
| Торты на заказ / начинки | CRUD `/admin/custom-cakes`, `/admin/fillings` |
| Галерея | CRUD `/admin/gallery` |
| Отзывы | `GET /admin/reviews` (все, включая неопубликованные; 🆕² `?product_id=`), `POST /admin/reviews`, `PATCH /admin/reviews/{id}` (публикация/скрытие, 🆕² привязка к товару `product_id`), `DELETE` |
| Контент страниц | `GET/PUT /admin/pages/{page_key}` |
| Заказы | `GET /admin/orders` (список с фильтром по статусу/дате), `GET /admin/orders/{id}`, `PATCH /admin/orders/{id}` (смена статуса) |
| Заявки на консультацию | `GET /admin/consultations` (с фильтром по `source` — `custom_cake`/`contact_page`, чтобы в списке было видно, с какой формы пришла заявка), `PATCH /admin/consultations/{id}` (смена статуса). 🆕² В списке — `occasion`, `event_date`, `guests_count`, `has_reference`; сам файл — `GET /admin/consultations/{id}/reference` (`image/webp`, `Cache-Control: private, no-store`, просмотр пишется в журнал аудита) |
| Пользователи | `GET/POST /admin/users`, `PATCH/DELETE /admin/users/{id}` — доступно только роли `owner` |
| Бэкапы | `GET /admin/backups` (список), `POST /admin/backups` (запустить ручной бэкап), `POST /admin/backups/{id}/restore` — доступно только роли `owner` |

## Общие правила для всех эндпоинтов

- Валидация запроса — Pydantic-схемы; при ошибке — `422` со стандартной структурой FastAPI (совместимо с обработкой ошибок React Hook Form на фронте).
- 🆕² Нарушение ограничения БД (занятый `slug`, удаление записи, на которую ссылаются заказы) — `409` с общим текстом; текст ошибки PostgreSQL наружу не отдаётся.
- 🆕² Товары в админке (`POST/PUT /admin/products`) принимают новые поля: `weight_grams`, `portions_min/max`, `kcal/proteins/fats/carbs`, `transport_time`, `lead_time_days`, `occasions[]`, `dietary[]`; подкатегория обязана принадлежать категории (иначе 422). Галерея — `occasion`, `tiers`, `guests`, `made_in`. Контент `contacts` — `yandex_rating`, `yandex_reviews_count`, `yandex_maps_url`, `telegram_url` (только `https://`).
- 🆕² Правки галереи, отзывов, тортов на заказ и начинок, как и правки товаров, сбрасывают ISR-кэш затронутых страниц (`POST /api/revalidate` на фронтенде).
- Любая мутация в Admin API логируется (кто, когда, что изменил) — минимум `updated_by`/`updated_at`, в идеале — отдельная таблица аудита, если время разработки позволяет (не блокирующее требование).
- Rate limiting на публичные POST-эндпоинты (`/cart/items`, `/orders`, `/custom-cakes/consultation`, `/contacts/feedback`) — через Redis, чтобы форму нельзя было засыпать запросами (раздел 7 договора — «защита форм от спама и автоматических отправок»).
