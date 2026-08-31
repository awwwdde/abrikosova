# API-контракт (FastAPI)

Базовый префикс: `/api/v1`. Формат ответа — JSON. Ошибки — единый формат `{ "detail": string | object }` (стандарт FastAPI). Пагинация везде, где отдаётся список, — через query-параметры `page` и `page_size` (default `page_size=12`, как было в старом каталоге, но теперь с реальной пагинацией, а не обрезкой списка — см. `ANALYSIS.md`, п. 2.1.8), ответ — `{ items: [...], total: number, page: number, page_size: number }`.

Ниже — эндпоинты по доменам. Схемы запросов/ответов Claude Code формализует как Pydantic-модели по составу полей из `01-data-model.md`; здесь фиксируется состав и назначение эндпоинтов, а не байтовая схема JSON.

## Публичный API (без авторизации)

### Каталог

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/catalog/categories` | Дерево категорий с подкатегориями (`is_active=true`), для меню/сайдбара каталога |
| GET | `/catalog/products` | Список товаров с фильтрами: `category`, `subcategory`, `search` (по названию), `sort` (`price_asc`, `price_desc`, `name`, `new`), пагинация |
| GET | `/catalog/products/{slug}` | Карточка товара: все поля + `images[]` + `related_products[]` (та же подкатегория, до 4 шт., как в старой логике) + `fillings[]`, если товар относится к тортам (флаг `applies_fillings` на товаре или на подкатегории — заменяет хрупкую проверку по ключевым словам в названии из старого кода, см. `ANALYSIS.md`) |

### Торты на заказ

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/custom-cakes` | Список активных позиций + список начинок + контент страницы (`PageContent[custom_cakes]`) |
| POST | `/custom-cakes/consultation` | Создать заявку на консультацию (`ConsultationRequest`), включая опциональную загрузку фото-референса |

### Галерея, отзывы, статичный контент

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/gallery` | Список активных «Примеров работ», с пагинацией |
| GET | `/reviews` | Список опубликованных отзывов (`is_published=true`), с пагинацией |
| GET | `/pages/{page_key}` | Контент статичной страницы (`home`, `about`, `contacts`) — используется в `generateStaticParams`/ISR на фронте |

### Корзина (гостевая, без авторизации)

Корзина идентифицируется httpOnly cookie `cart_id` (UUID), которую бэкенд выставляет при первом обращении. Это заменяет схему из старого кода, где корзина хранилась в Django-сессии и параллельно дублировалась в `localStorage` (см. `ANALYSIS.md`, п. 2.1.3) — здесь ровно один источник правды на сервере, фронтенд только читает и мутирует его через API.

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/cart` | Текущее содержимое корзины (товары, количества, сумма) |
| POST | `/cart/items` | Добавить товар `{ product_id, quantity }` |
| PATCH | `/cart/items/{product_id}` | Изменить количество `{ quantity }` (quantity ≤ 0 — удаляет позицию) |
| DELETE | `/cart/items/{product_id}` | Удалить позицию |
| DELETE | `/cart` | Очистить корзину |

Все мутирующие методы — не GET (в старом коде `add_to_cart`/`remove_from_cart` вызывались через `fetch()` без указания метода, то есть GET — прямое нарушение общепринятой практики и требования по CSRF-защите, см. `ANALYSIS.md`, п. 2.1.4).

### Оформление заказа

| Метод | Путь | Назначение |
|---|---|---|
| POST | `/orders` | Создать заказ из текущей корзины: `{ customer_name, customer_phone, customer_comment?, delivery_method, delivery_address?, desired_date?, consent_pd }`. Сервер: валидирует (`delivery_address` обязателен при `delivery_method=delivery`, `consent_pd` обязателен `true`), пересчитывает сумму по актуальным ценам, создаёт `Order`+`OrderItem[]`, отправляет e-mail-уведомление администратору (и опционально Telegram, см. `05-nonfunctional-and-acceptance.md`), очищает корзину, возвращает `order_number` |
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
| Отзывы | `GET /admin/reviews` (все, включая неопубликованные), `PATCH /admin/reviews/{id}` (публикация/скрытие), `DELETE` |
| Контент страниц | `GET/PUT /admin/pages/{page_key}` |
| Заказы | `GET /admin/orders` (список с фильтром по статусу/дате), `GET /admin/orders/{id}`, `PATCH /admin/orders/{id}` (смена статуса) |
| Заявки на консультацию | `GET /admin/consultations`, `PATCH /admin/consultations/{id}` (смена статуса) |
| Пользователи | `GET/POST /admin/users`, `PATCH/DELETE /admin/users/{id}` — доступно только роли `owner` |
| Бэкапы | `GET /admin/backups` (список), `POST /admin/backups` (запустить ручной бэкап), `POST /admin/backups/{id}/restore` — доступно только роли `owner` |

## Общие правила для всех эндпоинтов

- Валидация запроса — Pydantic-схемы; при ошибке — `422` со стандартной структурой FastAPI (совместимо с обработкой ошибок React Hook Form на фронте).
- Любая мутация в Admin API логируется (кто, когда, что изменил) — минимум `updated_by`/`updated_at`, в идеале — отдельная таблица аудита, если время разработки позволяет (не блокирующее требование).
- Rate limiting на публичные POST-эндпоинты (`/cart/items`, `/orders`, `/custom-cakes/consultation`) — через Redis, чтобы форму нельзя было засыпать запросами (раздел 7 договора — «защита форм от спама и автоматических отправок»).
