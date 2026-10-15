/**
 * СГЕНЕРИРОВАНО из OpenAPI-схемы бэкенда — руками не править.
 *
 * Обновить:  docker compose exec web npm run gen:api
 * Проверить: docker compose exec web npm run check:api
 *
 * Исходник — Pydantic-схемы app/apps/api/app/schemas. Удобные короткие имена
 * типов — в lib/api.ts.
 */

export interface paths {
    "/api/v1/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health */
        get: operations["health_api_v1_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/catalog/categories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Categories
         * @description Дерево активных категорий с подкатегориями — для меню и вкладок каталога.
         */
        get: operations["list_categories_api_v1_catalog_categories_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/catalog/filters": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Filters
         * @description Панель фильтров: значения, подписи и счётчики по текущему выбору.
         *
         *     Принимает те же параметры, что `/catalog/products`. Подписи отдаёт бэкенд,
         *     чтобы сайт и админка не держали каждый свою копию.
         */
        get: operations["get_filters_api_v1_catalog_filters_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/catalog/products": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Products
         * @description Список товаров со сквозными фильтрами, сортировкой и настоящей пагинацией.
         *
         *     Состав — через И, остальные группы — через ИЛИ внутри группы. Сортировка
         *     по умолчанию — «Сначала готовое сегодня». В старом коде список жёстко
         *     обрезался 12 позициями (ANALYSIS.md, п. 2.1.8) — здесь постраничная выдача.
         */
        get: operations["list_products_api_v1_catalog_products_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/catalog/products/{slug}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Product */
        get: operations["get_product_api_v1_catalog_products__slug__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/catalog/sitemap": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Sitemap
         * @description Слаги и даты для sitemap.xml сайта: категории, подкатегории и товары (012).
         */
        get: operations["get_sitemap_api_v1_catalog_sitemap_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/legacy/resolve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Resolve Legacy
         * @description Новый адрес для адреса старого сайта (012). 404 — соответствия нет.
         *
         *     Публичный и без авторизации: его спрашивает middleware сайта, когда приходит
         *     старый адрес. Ответ не раскрывает ничего, чего нет на самом сайте.
         */
        get: operations["resolve_legacy_api_v1_legacy_resolve_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/custom-cakes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Custom Cakes
         * @description Сетка дизайнов. Счётчики «таблеток» — по всем активным дизайнам, а не по
         *     отфильтрованным: иначе после выбора повода остальные показали бы ноль.
         */
        get: operations["list_custom_cakes_api_v1_custom_cakes_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/custom-cakes/info": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Custom Cakes Info
         * @description Всё для страницы, кроме сетки: факты, цены, начинки, сет, шаги, вопросы.
         *     Тексты — из контента страницы `custom_cakes`, цифры — из настроек.
         */
        get: operations["custom_cakes_info_api_v1_custom_cakes_info_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/custom-cakes/fillings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Fillings
         * @description Все начинки — для «Показать все начинки» и select в окне заявки.
         */
        get: operations["list_fillings_api_v1_custom_cakes_fillings_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/custom-cakes/estimate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Estimate Cake
         * @description Калькулятор: гости → вес, ярусы, «от X ₽». С дизайном — по его оформлению,
         *     без него («Свой дизайн») — по классическому.
         */
        get: operations["estimate_cake_api_v1_custom_cakes_estimate_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/custom-cakes/{slug}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Custom Cake */
        get: operations["get_custom_cake_api_v1_custom_cakes__slug__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/consultations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create Consultation
         * @description Заявка на торт: поля окна заявки + до 5 фото-образцов.
         *
         *     Порядок: сначала все проверки (поля, дата, дизайн, файлы по содержимому),
         *     потом файлы уходят в хранилище, потом строка в базу. Отклонённая заявка
         *     не оставляет в бакете загруженных картинок.
         */
        post: operations["create_consultation_api_v1_consultations_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/gallery": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Gallery
         * @description Примеры работ с фильтром по поводу — отдельная страница вместо портфолио
         *     внутри товарного каталога, как было раньше (PDF «Этап 1», раздел 11).
         *     `occasion` — значение фильтра: повод или группа «юбилей и корпоратив» (009).
         */
        get: operations["list_gallery_api_v1_gallery_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/gallery/occasions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Gallery Occasions
         * @description «Таблетки» фильтра «Работ» с числом опубликованных работ (009). Пустые
         *     сайт прячет, как подразделы каталога; порядок — как в макете.
         */
        get: operations["gallery_occasions_api_v1_gallery_occasions_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/gallery/{item_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Gallery Item
         * @description Работа как образец в окне заявки — «Заказать похожий» (009 → 008a).
         */
        get: operations["get_gallery_item_api_v1_gallery__item_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/content/login-photos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Login Photos
         * @description Фото для страницы входа в админку (задание 011a): опубликованные работы
         *     и главные фото активных товаров в активных разделах, до 30 штук вперемешку.
         *
         *     Публичный, потому что страница входа открыта до входа. Отдаёт только то, что
         *     и так видно на сайте, — скрытые товары и снятые с публикации работы не
         *     попадают. Заглушки без файла (`placeholder/…`) — тоже.
         */
        get: operations["login_photos_api_v1_content_login_photos_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/reviews": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Reviews
         * @description Только опубликованные отзывы — неопубликованные видны лишь в админке.
         *
         *     Без `product` — все отзывы, с `product` — отзывы о позиции (продолжение
         *     блока 06 карточки товара, где первые отзывы приходят сразу).
         *     `source=yandex` — блок «Что говорят гости» на главной: там только отзывы
         *     с Яндекс.Карт со ссылкой на оригинал.
         */
        get: operations["list_reviews_api_v1_reviews_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pages/home": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Home Page */
        get: operations["get_home_page_api_v1_pages_home_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pages/contacts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Contacts Page */
        get: operations["get_contacts_page_api_v1_pages_contacts_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pages/about": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get About Page */
        get: operations["get_about_page_api_v1_pages_about_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pages/custom_cakes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Custom Cakes Content */
        get: operations["get_custom_cakes_content_api_v1_pages_custom_cakes_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pages/gallery": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Gallery Page */
        get: operations["get_gallery_page_api_v1_pages_gallery_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pages/legal": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Legal Page */
        get: operations["get_legal_page_api_v1_pages_legal_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pages/{page_key}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Page Content */
        get: operations["get_page_content_api_v1_pages__page_key__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/contacts/feedback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create Feedback */
        post: operations["create_feedback_api_v1_contacts_feedback_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cart": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Cart */
        get: operations["get_cart_api_v1_cart_get"];
        put?: never;
        post?: never;
        /** Clear Cart */
        delete: operations["clear_cart_api_v1_cart_delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cart/upsell": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Upsell
         * @description «К торту часто берут» (007a): до 4 товаров «Предлагать в корзине», в наличии
         *     сегодня и не из корзины. В корзине нет торта — пустой список, блок не показывается.
         */
        get: operations["get_upsell_api_v1_cart_upsell_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cart/items": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Add Cart Item
         * @description Добавляет вариант товара (и надпись, если товар её допускает).
         *
         *     Тот же вариант с той же надписью — растёт количество; другая надпись или
         *     другой вариант — новая строка. Цена надписи в строке не хранится: корзина
         *     и заказ берут текущую из настроек.
         */
        post: operations["add_cart_item_api_v1_cart_items_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cart/items/{item_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete Cart Item */
        delete: operations["delete_cart_item_api_v1_cart_items__item_id__delete"];
        options?: never;
        head?: never;
        /**
         * Update Cart Item
         * @description `item_id` — id строки корзины из `CartOut.items[].id`. Количество и/или
         *     надпись (007a): новая надпись совпала с другой строкой того же варианта —
         *     строки сливаются.
         */
        patch: operations["update_cart_item_api_v1_cart_items__item_id__patch"];
        trace?: never;
    };
    "/api/v1/orders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create Order
         * @description Сумма пересчитывается на сервере по актуальным ценам — сумме от клиента не доверяем.
         *
         *     С заголовком `Idempotency-Key` (007b) повтор с тем же ключом и той же корзиной
         *     возвращает уже созданный заказ, а запрос, пришедший, пока первый ещё идёт, — 409.
         */
        post: operations["create_order_api_v1_orders_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/orders/{order_number}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Order
         * @description Страница «Заказ принят» без входа (007a) — только с токеном из ссылки после
         *     оформления (services/order_token.py). Без токена, с чужим или просроченным — 404,
         *     как будто заказа нет: номер из даты и 6 знаков перебирается. Телефон и почта — в маске.
         */
        get: operations["get_order_api_v1_orders__order_number__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Login */
        post: operations["login_api_v1_auth_login_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Refresh Tokens */
        post: operations["refresh_tokens_api_v1_auth_refresh_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Logout
         * @description Выход: сессия отзывается на сервере, а не только удаляется cookie у клиента.
         */
        post: operations["logout_api_v1_auth_logout_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Me */
        get: operations["me_api_v1_auth_me_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Update Me
         * @description Сотрудник меняет своё имя сам (011c). Роль и активность — только владелец
         *     через «Сотрудников», поэтому в схеме только имя.
         */
        patch: operations["update_me_api_v1_auth_me_patch"];
        trace?: never;
    };
    "/api/v1/auth/change-password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Change Password
         * @description Смена своего пароля. Остальные сессии отзываются, текущая остаётся.
         */
        post: operations["change_password_api_v1_auth_change_password_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Sessions
         * @description Живые входы текущего сотрудника: устройство, IP, время, «текущий».
         */
        get: operations["list_sessions_api_v1_auth_sessions_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/sessions/{session_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Revoke Session */
        delete: operations["revoke_session_api_v1_auth_sessions__session_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/sessions/revoke-others": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Revoke Other Sessions */
        post: operations["revoke_other_sessions_api_v1_auth_sessions_revoke_others_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/products": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Products
         * @description Каталог с фильтрами (011e): поиск, раздел → подраздел, наличие, видимость.
         */
        get: operations["list_products_api_v1_admin_products_get"];
        put?: never;
        /** Create Product */
        post: operations["create_product_api_v1_admin_products_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/products/bulk": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Bulk Update Products
         * @description Скрыть, показать, снять с наличия — для одного или многих товаров (011e).
         *
         *     Один запрос и одна транзакция, но в журнал — запись на каждый товар со своим
         *     «было → стало»: в ленте видно, что именно скрыли, а не «изменено 12 товаров».
         *     Переключатель «на сайте» в строке списка — тот же запрос с одним id.
         */
        post: operations["bulk_update_products_api_v1_admin_products_bulk_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/categories/order": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Reorder Categories
         * @description Порядок разделов — весь список id (перетаскивание или стрелки).
         */
        put: operations["reorder_categories_api_v1_admin_categories_order_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/categories/{category_id}/subcategories/order": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Reorder Subcategories */
        put: operations["reorder_subcategories_api_v1_admin_categories__category_id__subcategories_order_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/gallery/order": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Reorder Gallery */
        put: operations["reorder_gallery_api_v1_admin_gallery_order_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/fillings/order": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Reorder Fillings */
        put: operations["reorder_fillings_api_v1_admin_fillings_order_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/custom-cakes/order": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Reorder Custom Cakes */
        put: operations["reorder_custom_cakes_api_v1_admin_custom_cakes_order_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/consultations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Consultations
         * @description Заявки (011e): вкладки по статусу со счётчиками, повод, дата события (по дню
         *     кондитерской), источник. Новые сверху.
         */
        get: operations["list_consultations_api_v1_admin_consultations_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/consultations/{request_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Consultation
         * @description Карточка заявки. Просмотр — в журнал (152-ФЗ, как у заказов); в ленте главной
         *     просмотры не показываются.
         */
        get: operations["get_consultation_api_v1_admin_consultations__request_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Update Consultation */
        patch: operations["update_consultation_api_v1_admin_consultations__request_id__patch"];
        trace?: never;
    };
    "/api/v1/admin/reviews": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Reviews
         * @description Отзывы (011e): «Ждут публикации / Опубликованы / Все», товар, источник.
         */
        get: operations["list_reviews_api_v1_admin_reviews_get"];
        put?: never;
        /** Create Review */
        post: operations["create_review_api_v1_admin_reviews_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Dashboard
         * @description Старая сводка — её читают как раньше; новая главная — `GET /admin/dashboard`.
         *
         *     «Сегодня» — от полуночи по времени кондитерской, а не UTC (011b): в 01:00 по
         *     Москве в UTC ещё вчерашний вечер, и вчерашние заказы считались «сегодняшними».
         */
        get: operations["dashboard_api_v1_admin_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/categories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Categories */
        get: operations["list_categories_api_v1_admin_categories_get"];
        put?: never;
        /** Create Category */
        post: operations["create_category_api_v1_admin_categories_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/categories/{item_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update Category */
        put: operations["update_category_api_v1_admin_categories__item_id__put"];
        post?: never;
        /** Delete Category */
        delete: operations["delete_category_api_v1_admin_categories__item_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/subcategories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Subcategories */
        get: operations["list_subcategories_api_v1_admin_subcategories_get"];
        put?: never;
        /** Create Subcategory */
        post: operations["create_subcategory_api_v1_admin_subcategories_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/subcategories/{item_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update Subcategory */
        put: operations["update_subcategory_api_v1_admin_subcategories__item_id__put"];
        post?: never;
        /** Delete Subcategory */
        delete: operations["delete_subcategory_api_v1_admin_subcategories__item_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/products/{item_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Product Admin */
        get: operations["get_product_admin_api_v1_admin_products__item_id__get"];
        /** Update Product */
        put: operations["update_product_api_v1_admin_products__item_id__put"];
        post?: never;
        /** Delete Product */
        delete: operations["delete_product_api_v1_admin_products__item_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/products/{product_id}/images": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Product Images */
        get: operations["list_product_images_api_v1_admin_products__product_id__images_get"];
        put?: never;
        /**
         * Upload Product Image
         * @description Загружает фото товара. Лимит 6 штук — требование договора,
         *     в старом коде оно нигде не проверялось.
         */
        post: operations["upload_product_image_api_v1_admin_products__product_id__images_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/products/{product_id}/images/order": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Reorder Product Images
         * @description Порядок фото в карточке товара (011d): перетаскивание или «влево/вправо».
         *     Присылается весь список id — так порядок не разъедется, если два сотрудника
         *     двигают фото одновременно: последний запрос задаёт порядок целиком.
         */
        put: operations["reorder_product_images_api_v1_admin_products__product_id__images_order_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/products/{product_id}/images/{image_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete Product Image */
        delete: operations["delete_product_image_api_v1_admin_products__product_id__images__image_id__delete"];
        options?: never;
        head?: never;
        /**
         * Set Main Product Image
         * @description Делает фото главным. Остальные сбрасываются на уровне сервиса,
         *     а не по данным от клиента.
         */
        patch: operations["set_main_product_image_api_v1_admin_products__product_id__images__image_id__patch"];
        trace?: never;
    };
    "/api/v1/admin/products/{product_id}/images/{image_id}/role": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Set Product Image Role
         * @description Подпись фото на странице товара: «Целиком», «Срез», «Деталь», «Упаковка».
         */
        put: operations["set_product_image_role_api_v1_admin_products__product_id__images__image_id__role_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/uploads": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Upload Media
         * @description Одиночная загрузка для разделов, где фото хранится полем в самой записи.
         *
         *     Префикс ограничен списком: иначе клиент смог бы задать произвольный путь
         *     внутри бакета. `pages` — фото из контента страниц: портрет Елены
         *     и интерьер кондитерской.
         */
        post: operations["upload_media_api_v1_admin_uploads_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/uploads/video": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Upload Hero Video */
        post: operations["upload_hero_video_api_v1_admin_uploads_video_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/custom-cakes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Custom Cakes */
        get: operations["list_custom_cakes_api_v1_admin_custom_cakes_get"];
        put?: never;
        /** Create Custom Cake */
        post: operations["create_custom_cake_api_v1_admin_custom_cakes_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/custom-cakes/{item_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update Custom Cake */
        put: operations["update_custom_cake_api_v1_admin_custom_cakes__item_id__put"];
        post?: never;
        /** Delete Custom Cake */
        delete: operations["delete_custom_cake_api_v1_admin_custom_cakes__item_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/fillings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Fillings */
        get: operations["list_fillings_api_v1_admin_fillings_get"];
        put?: never;
        /** Create Filling */
        post: operations["create_filling_api_v1_admin_fillings_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/fillings/{item_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update Filling */
        put: operations["update_filling_api_v1_admin_fillings__item_id__put"];
        post?: never;
        /** Delete Filling */
        delete: operations["delete_filling_api_v1_admin_fillings__item_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/gallery": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Gallery Admin */
        get: operations["list_gallery_admin_api_v1_admin_gallery_get"];
        put?: never;
        /** Create Gallery Item */
        post: operations["create_gallery_item_api_v1_admin_gallery_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/gallery/{item_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update Gallery Item */
        put: operations["update_gallery_item_api_v1_admin_gallery__item_id__put"];
        post?: never;
        /** Delete Gallery Item */
        delete: operations["delete_gallery_item_api_v1_admin_gallery__item_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/reviews/{review_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete Review */
        delete: operations["delete_review_api_v1_admin_reviews__review_id__delete"];
        options?: never;
        head?: never;
        /** Update Review */
        patch: operations["update_review_api_v1_admin_reviews__review_id__patch"];
        trace?: never;
    };
    "/api/v1/admin/pages/{page_key}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Page Admin */
        get: operations["get_page_admin_api_v1_admin_pages__page_key__get"];
        /** Update Page */
        put: operations["update_page_api_v1_admin_pages__page_key__put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/orders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Orders
         * @description Список заказов с вкладками и фильтрами (011d). Новые сверху.
         */
        get: operations["list_orders_api_v1_admin_orders_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/orders/export.csv": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Export Orders
         * @description CSV текущей выборки — как отчёт на главной, без телефонов: файл уходит
         *     из системы, и лишние ПДн в нём не нужны.
         */
        get: operations["export_orders_api_v1_admin_orders_export_csv_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/orders/{order_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Order Admin
         * @description Карточка заказа. Просмотр пишется в журнал (152-ФЗ: кто и когда открывал
         *     телефон и адрес клиента). В ленте главной просмотры не показываются.
         */
        get: operations["get_order_admin_api_v1_admin_orders__order_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Update Order Status */
        patch: operations["update_order_status_api_v1_admin_orders__order_id__patch"];
        trace?: never;
    };
    "/api/v1/admin/consultations/{request_id}/images/{image_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Consultation Image
         * @description Фото-образец из заявки (до пяти, 008a). Только через админку, не по публичной ссылке.
         *
         *     Просмотр пишется в журнал: это персональные данные клиента, и по 152-ФЗ
         *     оператор должен понимать, кто и когда к ним обращался.
         */
        get: operations["get_consultation_image_api_v1_admin_consultations__request_id__images__image_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Users */
        get: operations["list_users_api_v1_admin_users_get"];
        put?: never;
        /** Create User */
        post: operations["create_user_api_v1_admin_users_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/users/{user_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete User */
        delete: operations["delete_user_api_v1_admin_users__user_id__delete"];
        options?: never;
        head?: never;
        /** Update User */
        patch: operations["update_user_api_v1_admin_users__user_id__patch"];
        trace?: never;
    };
    "/api/v1/admin/backups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Backups
         * @description Копии с автором (011f): кто создал — из журнала, автоматические — без автора.
         *     Отдельной колонки в таблице копий не заводим: журнал и так знает, кто нажал.
         */
        get: operations["list_backups_api_v1_admin_backups_get"];
        put?: never;
        /**
         * Create Backup
         * @description Ручной запуск копии. Выполняется синхронно: владелица должна увидеть
         *     результат сразу, а не гадать, сняласьли копия.
         */
        post: operations["create_backup_api_v1_admin_backups_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/backups/{backup_id}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Restore Backup
         * @description Восстановление из копии — необратимая операция.
         *
         *     Требует явного подтверждения в теле запроса: случайный запрос по этому
         *     адресу не должен затирать боевые данные. Пишется в журнал до выполнения,
         *     чтобы след остался даже если восстановление оборвётся.
         */
        post: operations["restore_backup_api_v1_admin_backups__backup_id__restore_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/backups/{backup_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete Backup */
        delete: operations["delete_backup_api_v1_admin_backups__backup_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/retention/purge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Purge Personal Data
         * @description Ручной запуск очистки ПДн по сроку хранения.
         *
         *     Обычно выполняется по расписанию; ручной вызов нужен, чтобы показать
         *     работу механизма при приёмке и по запросу субъекта данных.
         */
        post: operations["purge_personal_data_api_v1_admin_retention_purge_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/dashboard": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Dashboard
         * @description Вся главная одним запросом: на экране десяток блоков, и десяток запросов
         *     с вкладки при каждом открытии главной — лишняя задержка и нагрузка.
         */
        get: operations["get_dashboard_api_v1_admin_dashboard_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/dashboard/calendar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Calendar
         * @description Календарь другого месяца — при перелистывании, без пересчёта всей главной.
         */
        get: operations["get_calendar_api_v1_admin_dashboard_calendar_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/dashboard/report.csv": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Week Report */
        get: operations["week_report_api_v1_admin_dashboard_report_csv_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/dashboard/popular.csv": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Popular Report */
        get: operations["popular_report_api_v1_admin_dashboard_popular_csv_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/clock": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Clock
         * @description «Сегодня» кондитерской (011d): по нему карточка товара подсказывает ближайшую
         *     дату для покупателя. Браузер в другом поясе посчитал бы её на день раньше.
         */
        get: operations["get_clock_api_v1_admin_clock_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/counters": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Counters
         * @description Счётчики меню и колокольчика. Лёгкий: три count, вкладка опрашивает его раз в минуту.
         */
        get: operations["get_counters_api_v1_admin_counters_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Search
         * @description Поиск по заказам (номер, имя, телефон), товарам и заявкам — до 5 каждого.
         *
         *     Телефон ищется по цифрам: в базе он хранится так, как его ввёл клиент
         *     («+7 (916) 123-45-67»), а ищут обычно куском номера без скобок и пробелов.
         */
        get: operations["search_api_v1_admin_search_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/journal": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Journal
         * @description Лента целиком с фильтрами. Вкладка «Безопасность» — входы, выходы,
         *     блокировки и подозрения на кражу сессии (`entity="auth"`).
         */
        get: operations["get_journal_api_v1_admin_journal_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/settings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Settings Page */
        get: operations["get_settings_page_api_v1_admin_settings_get"];
        /** Update Settings */
        put: operations["update_settings_api_v1_admin_settings_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** AboutContent */
        AboutContent: {
            /** Title */
            title?: string | null;
            /** Main Text */
            main_text?: string | null;
            /**
             * Principles
             * @default []
             */
            principles: components["schemas"]["AboutTextBlock"][];
            coffee_shop?: components["schemas"]["AboutTextBlock"] | null;
            /** Biography */
            biography?: string[] | null;
            /** Timeline */
            timeline?: components["schemas"]["AboutMilestone"][] | null;
            /** Workflow */
            workflow?: components["schemas"]["AboutTextBlock"][] | null;
            /** Workshop Image Key */
            workshop_image_key?: string | null;
            /** Team */
            team?: components["schemas"]["TeamMember"][] | null;
        };
        /** AboutMilestone */
        AboutMilestone: {
            /** Title */
            title: string;
            /** Text */
            text: string;
            /** Year */
            year: string;
        };
        /** AboutPageOut */
        AboutPageOut: {
            page_key: components["schemas"]["PageKey"];
            content: components["schemas"]["AboutContent"];
            /** Address */
            address?: string | null;
            /** Phone */
            phone?: string | null;
            /** Work Hours Weekdays */
            work_hours_weekdays?: string | null;
            /** Work Hours Weekend */
            work_hours_weekend?: string | null;
            /** Delivery Hours */
            delivery_hours?: string | null;
            /** Map Embed Code */
            map_embed_code?: string | null;
            /** Yandex Rating */
            yandex_rating?: string | null;
            /** Yandex Reviews Count */
            yandex_reviews_count?: number | null;
            /** Yandex Maps Url */
            yandex_maps_url?: string | null;
            /** Telegram Url */
            telegram_url?: string | null;
        };
        /** AboutTextBlock */
        AboutTextBlock: {
            /** Title */
            title: string;
            /** Text */
            text: string;
        };
        /** ActivityItem */
        ActivityItem: {
            /** Id */
            id: number;
            /** Actor */
            actor: string;
            /** Actor Role */
            actor_role: string | null;
            /** Is You */
            is_you: boolean;
            /**
             * Is Site
             * @default false
             */
            is_site: boolean;
            /**
             * At
             * Format: date-time
             */
            at: string;
            /** Text */
            text: string;
            /** Meta */
            meta?: string | null;
        };
        /** AdminCreate */
        AdminCreate: {
            /**
             * Email
             * Format: email
             */
            email: string;
            /** Name */
            name: string;
            /** Password */
            password: string;
            /** @default manager */
            role: components["schemas"]["AdminRole"];
        };
        /** AdminOut */
        AdminOut: {
            /** Id */
            id: number;
            /**
             * Email
             * Format: email
             */
            email: string;
            /** Name */
            name: string;
            role: components["schemas"]["AdminRole"];
            /** Is Active */
            is_active: boolean;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /**
         * AdminRole
         * @enum {string}
         */
        AdminRole: "owner" | "manager";
        /** AdminUpdate */
        AdminUpdate: {
            /** Name */
            name?: string | null;
            role?: components["schemas"]["AdminRole"] | null;
            /** Is Active */
            is_active?: boolean | null;
            /** Password */
            password?: string | null;
        };
        /**
         * AuthorBlock
         * @description Блок Елены на главной: портрет, цитата, два абзаца и три показателя.
         */
        AuthorBlock: {
            /** Name */
            name: string;
            /** Role */
            role: string;
            /** Quote */
            quote: string;
            /**
             * Paragraphs
             * @default []
             */
            paragraphs: string[];
            /**
             * Stats
             * @default []
             */
            stats: components["schemas"]["AuthorStat"][];
            /** Image Key */
            image_key?: string | null;
        };
        /** AuthorStat */
        AuthorStat: {
            /** Value */
            value: string;
            /** Label */
            label: string;
        };
        /**
         * Availability
         * @description Фильтр «Срок» — радио: любой срок, забрать сегодня, под заказ.
         *
         *     `any` — явное «без условия»: у радио в панели фильтров это отдельный пункт
         *     со своим счётчиком, и фронтенду удобнее передать его как значение.
         * @enum {string}
         */
        Availability: "any" | "today" | "preorder";
        /** BackupOut */
        BackupOut: {
            /** Id */
            id: number;
            /** Storage Key */
            storage_key: string;
            type: components["schemas"]["BackupType"];
            status: components["schemas"]["BackupStatus"];
            /** Size Bytes */
            size_bytes: number | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Created By */
            created_by?: string | null;
            /** Note */
            note?: string | null;
        };
        /** BackupRestoreRequest */
        BackupRestoreRequest: {
            /** Confirm */
            confirm: string;
        };
        /**
         * BackupStatus
         * @enum {string}
         */
        BackupStatus: "pending" | "success" | "failed";
        /**
         * BackupType
         * @enum {string}
         */
        BackupType: "auto" | "manual";
        /** BakerySettings */
        BakerySettings: {
            /**
             * Large Order Total
             * @description Крупный заказ — от этой суммы, ₽
             * @default 10000
             */
            large_order_total: number;
            /**
             * Large Event Guests
             * @description Крупное событие в заявке — от этого числа гостей
             * @default 30
             */
            large_event_guests: number;
            /**
             * Inscription Price
             * @description Надпись на шоколадной табличке, ₽
             * @default 300
             */
            inscription_price: number;
            /**
             * Slot Cutoff Minutes
             * @description Закрывать окно выдачи за N минут до начала
             * @default 60
             */
            slot_cutoff_minutes: number;
            /**
             * Delivery Price
             * @description Доставка по Москве, ₽
             * @default 500
             */
            delivery_price: number;
            /**
             * Free Delivery From
             * @description Бесплатная доставка от суммы, ₽
             * @default 5000
             */
            free_delivery_from: number;
            /**
             * Delivery Note
             * @description Текст под «Доставка» в корзине
             * @default Доставляем в пределах МКАД. За МКАД стоимость рассчитаем отдельно при подтверждении
             */
            delivery_note: string;
            /**
             * Delivery Intervals
             * @description Окна доставки; у самовывоза — все окна
             * @default [
             *       "09-12",
             *       "12-15",
             *       "15-18"
             *     ]
             */
            delivery_intervals: components["schemas"]["DeliveryInterval"][];
            /**
             * Work Hours Start
             * @description Отвечаем на заказы с, ч
             * @default 9
             */
            work_hours_start: number;
            /**
             * Work Hours End
             * @description Отвечаем на заказы до, ч
             * @default 21
             */
            work_hours_end: number;
            /**
             * Cake Price Classic
             * @description Классическое оформление, ₽ за кг
             * @default 3200
             */
            cake_price_classic: number;
            /**
             * Cake Price Cream Drawing
             * @description Рисунок кремом, ₽ за кг
             * @default 3800
             */
            cake_price_cream_drawing: number;
            /**
             * Cake Price Multi Tier
             * @description Многоярусный, ₽ за кг
             * @default 4500
             */
            cake_price_multi_tier: number;
            /**
             * Cake Min Weight Kg
             * @description Минимальный вес торта, кг
             * @default 2
             */
            cake_min_weight_kg: number;
            /**
             * Cake Lead Days
             * @description Торт на заказ — не раньше чем через N дней
             * @default 5
             */
            cake_lead_days: number;
            /**
             * Cake Grams Per Guest
             * @description Граммов торта на гостя
             * @default 150
             */
            cake_grams_per_guest: number;
            /**
             * Cake Tiers
             * @description Ярусы по весу
             * @default [
             *       {
             *         "from_kg": 0,
             *         "tiers": 1
             *       },
             *       {
             *         "from_kg": 3.5,
             *         "tiers": 2
             *       },
             *       {
             *         "from_kg": 6,
             *         "tiers": 3
             *       }
             *     ]
             */
            cake_tiers: components["schemas"]["CakeTierStep"][];
            /**
             * Cake Extras
             * @description Дополнения в окне заявки
             * @default [
             *       {
             *         "name": "Свечи",
             *         "price": 200,
             *         "price_from": true
             *       },
             *       {
             *         "name": "Топпер с надписью",
             *         "price": 600,
             *         "price_from": true
             *       },
             *       {
             *         "name": "Открытка",
             *         "price": 150,
             *         "price_from": false
             *       }
             *     ]
             */
            cake_extras: components["schemas"]["CakeExtra"][];
        };
        /** Body_upload_hero_video_api_v1_admin_uploads_video_post */
        Body_upload_hero_video_api_v1_admin_uploads_video_post: {
            /** File */
            file: string;
        };
        /** Body_upload_media_api_v1_admin_uploads_post */
        Body_upload_media_api_v1_admin_uploads_post: {
            /** File */
            file: string;
        };
        /** Body_upload_product_image_api_v1_admin_products__product_id__images_post */
        Body_upload_product_image_api_v1_admin_products__product_id__images_post: {
            /** File */
            file: string;
        };
        /** BusinessClock */
        BusinessClock: {
            /**
             * Today
             * Format: date
             */
            today: string;
            /**
             * Now
             * Format: date-time
             */
            now: string;
            /** Timezone */
            timezone: string;
        };
        /**
         * CakeDecoration
         * @description Оформление торта на заказ — от него зависит цена за кг (блок «Цены», 008a).
         * @enum {string}
         */
        CakeDecoration: "classic" | "cream_drawing" | "multi_tier";
        /**
         * CakeExtra
         * @description Дополнение к торту в окне заявки: «Свечи — от 200 ₽».
         */
        CakeExtra: {
            /** Name */
            name: string;
            /** Price */
            price: number;
            /**
             * Price From
             * @default false
             */
            price_from: boolean;
        };
        /** CakeExtraOut */
        CakeExtraOut: {
            /** Name */
            name: string;
            /** Price */
            price: number;
            /** Price From */
            price_from: boolean;
        };
        /**
         * CakeFacet
         * @description «Таблетка» фильтра поводов — тот же набор, что у «Работ» (009).
         */
        CakeFacet: {
            value: components["schemas"]["GalleryOccasion"];
            /** Label */
            label: string;
            /** Count */
            count: number;
        };
        /**
         * CakeFact
         * @description Факт под шагами «Как заказать»: подпись сверху, значение крупно.
         */
        CakeFact: {
            /** Label */
            label: string;
            /** Value */
            value: string;
        };
        /** CakeFaqItem */
        CakeFaqItem: {
            /** Question */
            question: string;
            /** Answer */
            answer: string;
        };
        /**
         * CakeImageRole
         * @description Подпись фото дизайна торта на заказ (008a). Свой набор, а не `ImageRole`:
         *     у торта на заказ нет упаковки, зато есть вид сбоку — ярусы видно только так.
         * @enum {string}
         */
        CakeImageRole: "whole" | "cut" | "detail" | "side";
        /** CakePriceOut */
        CakePriceOut: {
            decoration: components["schemas"]["CakeDecoration"];
            /** Label */
            label: string;
            /** Price Per Kg */
            price_per_kg: number;
            /** Note */
            note: string;
        };
        /** CakeQuestion */
        CakeQuestion: {
            /** Question */
            question: string;
            /** Answer */
            answer: string;
        };
        /**
         * CakeSpecs
         * @description Таблица на странице дизайна: «Оформление / Минимальный вес / Ярусы / Начинка».
         */
        CakeSpecs: {
            /** Decoration Label */
            decoration_label: string;
            /** Price Per Kg */
            price_per_kg: number;
            /** Min Weight Kg */
            min_weight_kg: string;
            /** Tiers */
            tiers: number;
            /** Filling Note */
            filling_note: string;
        };
        /**
         * CakeStage
         * @description Этап заказа торта: блок «Торт под событие» на главной.
         */
        CakeStage: {
            /** Title */
            title: string;
            /** Duration */
            duration?: string | null;
            /** Text */
            text: string;
        };
        /**
         * CakeTierStep
         * @description Строка таблицы ярусов калькулятора: «от N кг — столько ярусов».
         */
        CakeTierStep: {
            /** From Kg */
            from_kg: number;
            /** Tiers */
            tiers: number;
        };
        /**
         * CakesHeaderMenu
         * @description Мега-меню «Торты на заказ» в шапке (014): четыре повода и строка фактов
         *     «от 2 кг · от 5 дней · от 3 200 ₽ за кг» — текстом, как в макете.
         */
        CakesHeaderMenu: {
            /** Facts */
            facts?: string | null;
            /**
             * Cards
             * @default []
             */
            cards: components["schemas"]["CakesMenuCard"][];
        };
        /**
         * CakesMenuCard
         * @description Карточка повода в мега-меню «Торты на заказ» (014).
         */
        CakesMenuCard: {
            occasion: components["schemas"]["GalleryOccasion"];
            /** Label */
            label: string;
            /** Image Key */
            image_key?: string | null;
        };
        /** Calendar */
        Calendar: {
            /** Month */
            month: string;
            /** Days */
            days: components["schemas"]["DayCount"][];
            /** Large */
            large: components["schemas"]["LargeEvent"][];
        };
        /**
         * CartItemIn
         * @description Добавление в корзину: вариант (у пирожного он единственный) и надпись.
         *
         *     Надпись — до 24 символов после обрезки пробелов; пустая строка — без надписи.
         *     К товару без «можно надпись» надпись не принимается (422).
         */
        CartItemIn: {
            /** Variant Id */
            variant_id: number;
            /**
             * Quantity
             * @default 1
             */
            quantity: number;
            /** Inscription Text */
            inscription_text?: string | null;
        };
        /** CartItemOut */
        CartItemOut: {
            /** Id */
            id: number;
            /** Product Id */
            product_id: number;
            /** Variant Id */
            variant_id: number;
            /** Name */
            name: string;
            /** Slug */
            slug: string;
            /** Variant Label */
            variant_label: string;
            /** Has Variants */
            has_variants: boolean;
            /** Is Cake */
            is_cake: boolean;
            /** Allows Inscription */
            allows_inscription: boolean;
            /** Price */
            price: string;
            /** Inscription Text */
            inscription_text: string | null;
            /** Inscription Price */
            inscription_price: string | null;
            /** Quantity */
            quantity: number;
            /** Line Total */
            line_total: string;
            /** Main Image */
            main_image: string | null;
            /** Is Available */
            is_available: boolean;
            /** Lead Time Days */
            lead_time_days: number;
        };
        /**
         * CartItemQuantityIn
         * @description Правка строки корзины: количество и/или надпись (007a, кадр «Правка надписи»).
         *
         *     Поле, которого нет в запросе, не меняется. `inscription_text: null` или пустая
         *     строка — снять надпись; правила те же, что при добавлении (24 знака после обрезки).
         */
        CartItemQuantityIn: {
            /** Quantity */
            quantity?: number | null;
            /** Inscription Text */
            inscription_text?: string | null;
        };
        /** CartOut */
        CartOut: {
            /** Items */
            items: components["schemas"]["CartItemOut"][];
            /** Total Items */
            total_items: number;
            /** Subtotal */
            subtotal: string;
            /** Total Price */
            total_price: string;
            /** Delivery Price Pickup */
            delivery_price_pickup: string;
            /** Delivery Price Delivery */
            delivery_price_delivery: string;
            /** Free Delivery From */
            free_delivery_from: string;
            /** Free Delivery Left */
            free_delivery_left: string;
            /** Delivery Note */
            delivery_note: string;
            /**
             * Earliest Date
             * Format: date
             */
            earliest_date: string;
            earliest_reason: components["schemas"]["EarliestReasonOut"] | null;
            slots: components["schemas"]["CartSlotsOut"];
            /** Work Hours Start */
            work_hours_start: number;
            /** Work Hours End */
            work_hours_end: number;
        };
        /**
         * CartSlotsOut
         * @description 7 дней для каждого способа получения: у доставки нет окна 18–21 (007a).
         */
        CartSlotsOut: {
            /** Pickup */
            pickup: components["schemas"]["SlotDayOut"][];
            /** Delivery */
            delivery: components["schemas"]["SlotDayOut"][];
        };
        /**
         * CatalogFilters
         * @description Всё, что нужно фронтенду, чтобы нарисовать панель фильтров: значения,
         *     подписи и счётчики по текущему выбору. Группы — в порядке макета.
         */
        CatalogFilters: {
            /** Availability */
            availability: components["schemas"]["FilterOption_Availability_"][];
            /** Dietary */
            dietary: components["schemas"]["FilterOption_DietaryTag_"][];
            /** Recipients */
            recipients: components["schemas"]["FilterOption_Recipient_"][];
            /** Occasions */
            occasions: components["schemas"]["FilterOption_Occasion_"][];
            /** Portions */
            portions: components["schemas"]["FilterOption_PortionsRange_"][];
            price: components["schemas"]["PriceRange"];
            /** Total */
            total: number;
        };
        /**
         * CatalogSitemap
         * @description Всё, что нужно sitemap.xml сайта, одним лёгким запросом (задание 012).
         *
         *     Список товаров каталога для этого не годится: он постраничный (до 60 на
         *     страницу) и тянет фото, цены и метки, а карте нужны только слаги и даты.
         */
        CatalogSitemap: {
            /** Categories */
            categories: components["schemas"]["SitemapCategory"][];
            /** Products */
            products: components["schemas"]["SitemapProduct"][];
        };
        /** CategoryAdminOut */
        CategoryAdminOut: {
            /** Id */
            id: number;
            /** Name */
            name: string;
            /** Slug */
            slug: string;
            /** Order */
            order: number;
            /** Is Active */
            is_active: boolean;
            /** Intro */
            intro?: string | null;
            /** All Label */
            all_label?: string | null;
            /**
             * Subcategories
             * @default []
             */
            subcategories: components["schemas"]["SubCategoryAdminOut"][];
        };
        /** CategoryBreadcrumb */
        CategoryBreadcrumb: {
            /** Name */
            name: string;
            /** Slug */
            slug: string;
        };
        /** CategoryIn */
        CategoryIn: {
            /** Name */
            name: string;
            /** Slug */
            slug: string;
            /**
             * Order
             * @default 0
             */
            order: number;
            /**
             * Is Active
             * @default true
             */
            is_active: boolean;
            /** Intro */
            intro?: string | null;
            /** All Label */
            all_label?: string | null;
        };
        /** CategoryOut */
        CategoryOut: {
            /** Id */
            id: number;
            /** Name */
            name: string;
            /** Slug */
            slug: string;
            /** Order */
            order: number;
            /** Intro */
            intro?: string | null;
            /** All Label */
            all_label?: string | null;
            /**
             * Subcategories
             * @default []
             */
            subcategories: components["schemas"]["SubCategoryOut"][];
            /**
             * Product Count
             * @default 0
             */
            product_count: number;
        };
        /** CategoryShare */
        CategoryShare: {
            /** Name */
            name: string;
            /** Items */
            items: number;
        };
        /** CategoryShares */
        CategoryShares: {
            /** Week */
            week: components["schemas"]["CategoryShare"][];
            /** Month */
            month: components["schemas"]["CategoryShare"][];
        };
        /**
         * ConsultationAccepted
         * @description «Заявка принята»: номер, «Белый с пионами, свадьба, 24 октября», маски контактов.
         */
        ConsultationAccepted: {
            /** Id */
            id: number;
            /** Number */
            number: string;
            /** Title */
            title: string;
            /** Phone Masked */
            phone_masked: string;
            /** Email Masked */
            email_masked: string;
            contact_method: components["schemas"]["ContactMethod"];
            estimate: components["schemas"]["EstimateOut"];
        };
        /** ConsultationAdminOut */
        ConsultationAdminOut: {
            /** Id */
            id: number;
            /** Number */
            number: string | null;
            /** Name */
            name: string;
            /** Phone */
            phone: string;
            /** Email */
            email: string | null;
            contact_method: components["schemas"]["ContactMethod"] | null;
            /** Description */
            description: string | null;
            occasion: components["schemas"]["RequestOccasion"] | null;
            /** Event Date */
            event_date: string | null;
            /** Guests Count */
            guests_count: number | null;
            design: components["schemas"]["ConsultationRef"] | null;
            gallery_item: components["schemas"]["ConsultationRef"] | null;
            filling: components["schemas"]["ConsultationRef"] | null;
            /** Wishes */
            wishes: string | null;
            /** Extras */
            extras: components["schemas"]["ConsultationExtra"][];
            delivery_method: components["schemas"]["DeliveryMethod"] | null;
            estimate: components["schemas"]["ConsultationEstimate"] | null;
            /** Image Ids */
            image_ids: number[];
            /** Has Reference */
            has_reference: boolean;
            source: components["schemas"]["ConsultationSource"];
            status: components["schemas"]["ConsultationStatus"];
            /** Consent Pd */
            consent_pd: boolean;
            /** Consent At */
            consent_at: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /** ConsultationBrief */
        ConsultationBrief: {
            /** Id */
            id: number;
            /** Name */
            name: string;
            occasion: components["schemas"]["Occasion"] | null;
            /** Event Date */
            event_date: string | null;
            /** Guests Count */
            guests_count: number | null;
            status: components["schemas"]["ConsultationStatus"];
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /** ConsultationEstimate */
        ConsultationEstimate: {
            /** Weight Kg */
            weight_kg: string;
            /** Tiers */
            tiers: number;
            /** Price Per Kg */
            price_per_kg: number;
            /** Price From */
            price_from: number;
        };
        /** ConsultationExtra */
        ConsultationExtra: {
            /** Name */
            name: string;
            /** Price */
            price: number;
            /**
             * Price From
             * @default false
             */
            price_from: boolean;
        };
        /**
         * ConsultationForm
         * @description Та же заявка multipart-формой с файлами. Файлы внутри модели: FastAPI
         *     разворачивает форму-модель в плоские поля, только когда она — единственный
         *     параметр тела.
         */
        ConsultationForm: {
            /** Website */
            website?: string | null;
            /** Consent Pd */
            consent_pd: boolean;
            /** Name */
            name: string;
            /** Phone */
            phone: string;
            /** Email */
            email: string;
            /** @default call */
            contact_method: components["schemas"]["ContactMethod"];
            occasion: components["schemas"]["RequestOccasion"];
            /**
             * Event Date
             * Format: date
             */
            event_date: string;
            /** Guests Count */
            guests_count: number;
            /** Design Id */
            design_id?: number | null;
            /** Gallery Item Id */
            gallery_item_id?: number | null;
            /** Filling Id */
            filling_id?: number | null;
            /** Wishes */
            wishes?: string | null;
            /** Extras */
            extras?: string[];
            /** @default pickup */
            delivery_method: components["schemas"]["DeliveryMethod"];
            /**
             * References
             * @default []
             */
            references: string[];
        };
        /**
         * ConsultationListPage
         * @description Заявки (011e): страница + счётчики вкладок с теми же фильтрами.
         */
        ConsultationListPage: {
            /** Items */
            items: components["schemas"]["ConsultationAdminOut"][];
            /** Total */
            total: number;
            /** Page */
            page: number;
            /** Page Size */
            page_size: number;
            /** Counts */
            counts: {
                [key: string]: number;
            };
        };
        /**
         * ConsultationRef
         * @description Что выбрано на сайте: дизайн, работа или начинка — id и название.
         */
        ConsultationRef: {
            /** Id */
            id: number;
            /** Title */
            title: string;
        };
        /**
         * ConsultationSource
         * @description С какой формы пришла заявка (01-data-model.md, ConsultationRequest.source).
         * @enum {string}
         */
        ConsultationSource: "custom_cake" | "contact_page";
        /**
         * ConsultationStatus
         * @enum {string}
         */
        ConsultationStatus: "new" | "contacted" | "completed";
        /** ConsultationStatusUpdate */
        ConsultationStatusUpdate: {
            status: components["schemas"]["ConsultationStatus"];
        };
        /** Consultations */
        Consultations: {
            /** Items */
            items: components["schemas"]["ConsultationBrief"][];
            /** More */
            more: number;
        };
        /**
         * ContactMethod
         * @description «Как связаться для подтверждения» в оформлении (007a, макет cart-checkout).
         * @enum {string}
         */
        ContactMethod: "call" | "telegram";
        /**
         * ContactsContent
         * @description Контакты: тексты страницы и всё, что выводится в блоке кондитерской
         *     на главной и в подвале, кроме адреса, телефона и часов — те лежат
         *     структурированными полями `PageContent`.
         */
        ContactsContent: {
            /** Title */
            title?: string | null;
            /** Intro */
            intro?: string | null;
            /** Email */
            email?: string | null;
            /** Pickup Description */
            pickup_description?: string | null;
            /** Delivery Description */
            delivery_description?: string | null;
            /** Delivery */
            delivery?: string | null;
            /** Pickup */
            pickup?: string | null;
            /** Payment */
            payment?: string | null;
            /** Catalog Note */
            catalog_note?: string | null;
            /** Product Pickup */
            product_pickup?: string | null;
            /** Pickup Place */
            pickup_place?: string | null;
            /** Product Delivery */
            product_delivery?: string | null;
            /** How To Get */
            how_to_get?: string | null;
            /**
             * Features
             * @default []
             */
            features: string[];
            /** Route Url */
            route_url?: string | null;
            /** Reviews Count Text */
            reviews_count_text?: string | null;
            /** Award */
            award?: string | null;
            /** Interior Image Key */
            interior_image_key?: string | null;
            /**
             * Socials
             * @default []
             */
            socials: components["schemas"]["SocialLink"][];
            legal?: components["schemas"]["LegalInfo"] | null;
            geo?: components["schemas"]["GeoPoint"] | null;
        };
        /**
         * ContactsPageOut
         * @description `GET /pages/contacts`: тот же ответ, но `content` описан схемой.
         */
        ContactsPageOut: {
            page_key: components["schemas"]["PageKey"];
            content: components["schemas"]["ContactsContent"];
            /** Address */
            address?: string | null;
            /** Phone */
            phone?: string | null;
            /** Work Hours Weekdays */
            work_hours_weekdays?: string | null;
            /** Work Hours Weekend */
            work_hours_weekend?: string | null;
            /** Delivery Hours */
            delivery_hours?: string | null;
            /** Map Embed Code */
            map_embed_code?: string | null;
            /** Yandex Rating */
            yandex_rating?: string | null;
            /** Yandex Reviews Count */
            yandex_reviews_count?: number | null;
            /** Yandex Maps Url */
            yandex_maps_url?: string | null;
            /** Telegram Url */
            telegram_url?: string | null;
        };
        /**
         * Counters
         * @description Счётчики меню и колокольчика: то, что ждёт реакции.
         */
        Counters: {
            /** Orders New */
            orders_new: number;
            /** Consultations New */
            consultations_new: number;
            /** Reviews Unpublished */
            reviews_unpublished: number;
        };
        /** Cta */
        Cta: {
            /** Label */
            label: string;
            /** Href */
            href: string;
        };
        /** CustomCakeAdminOut */
        CustomCakeAdminOut: {
            /** Slug */
            slug: string;
            /** Title */
            title: string;
            /** Subtitle */
            subtitle?: string | null;
            /**
             * Description
             * @default
             */
            description: string;
            occasion: components["schemas"]["GalleryOccasion"];
            /**
             * Tiers
             * @default 1
             */
            tiers: number;
            /**
             * Min Guests
             * @default 10
             */
            min_guests: number;
            /** @default classic */
            decoration: components["schemas"]["CakeDecoration"];
            /**
             * Images
             * @default []
             */
            images: components["schemas"]["CustomCakeImageIn"][];
            /**
             * Is Active
             * @default true
             */
            is_active: boolean;
            /**
             * Order
             * @default 0
             */
            order: number;
            /** Id */
            id: number;
            /** Price From */
            price_from: number;
            /** Weight Kg */
            weight_kg: string;
            /** Price Per Kg */
            price_per_kg: number;
        };
        /**
         * CustomCakeCard
         * @description Карточка списка: «СВАДЬБА · Белый с пионами · 3 яруса · от 40 гостей · от 27 000 ₽».
         */
        CustomCakeCard: {
            /** Id */
            id: number;
            /** Slug */
            slug: string;
            /** Title */
            title: string;
            /** Subtitle */
            subtitle: string | null;
            occasion: components["schemas"]["GalleryOccasion"];
            /** Occasion Label */
            occasion_label: string;
            /** Tiers */
            tiers: number;
            /** Min Guests */
            min_guests: number;
            decoration: components["schemas"]["CakeDecoration"];
            /** Price From */
            price_from: number;
            /** Image Key */
            image_key: string | null;
        };
        /** CustomCakeDetailOut */
        CustomCakeDetailOut: {
            /** Id */
            id: number;
            /** Slug */
            slug: string;
            /** Title */
            title: string;
            /** Subtitle */
            subtitle: string | null;
            occasion: components["schemas"]["GalleryOccasion"];
            /** Occasion Label */
            occasion_label: string;
            /** Tiers */
            tiers: number;
            /** Min Guests */
            min_guests: number;
            decoration: components["schemas"]["CakeDecoration"];
            /** Price From */
            price_from: number;
            /** Image Key */
            image_key: string | null;
            /** Description */
            description: string;
            /** Images */
            images: components["schemas"]["CustomCakeImageOut"][];
            specs: components["schemas"]["CakeSpecs"];
            estimate: components["schemas"]["EstimateOut"];
            /** Lead Days */
            lead_days: number;
            /**
             * Earliest Date
             * Format: date
             */
            earliest_date: string;
            /** Others */
            others: components["schemas"]["CustomCakeCard"][];
        };
        /**
         * CustomCakeImageIn
         * @description Фото дизайна: ключ из `POST /admin/upload?prefix=custom-cakes` и подпись.
         */
        CustomCakeImageIn: {
            /** Storage Key */
            storage_key: string;
            role?: components["schemas"]["CakeImageRole"] | null;
        };
        /** CustomCakeImageOut */
        CustomCakeImageOut: {
            /** Storage Key */
            storage_key: string;
            role: components["schemas"]["CakeImageRole"] | null;
            /** Role Label */
            role_label: string | null;
        };
        /**
         * CustomCakeIn
         * @description Дизайн торта на заказ (008a). Цены «от» здесь нет — её считает сервер
         *     из минимума гостей и цены за кг оформления (Настройки → «Торты на заказ»).
         */
        CustomCakeIn: {
            /** Slug */
            slug: string;
            /** Title */
            title: string;
            /** Subtitle */
            subtitle?: string | null;
            /**
             * Description
             * @default
             */
            description: string;
            occasion: components["schemas"]["GalleryOccasion"];
            /**
             * Tiers
             * @default 1
             */
            tiers: number;
            /**
             * Min Guests
             * @default 10
             */
            min_guests: number;
            /** @default classic */
            decoration: components["schemas"]["CakeDecoration"];
            /**
             * Images
             * @default []
             */
            images: components["schemas"]["CustomCakeImageIn"][];
            /**
             * Is Active
             * @default true
             */
            is_active: boolean;
            /**
             * Order
             * @default 0
             */
            order: number;
        };
        /** CustomCakeListOut */
        CustomCakeListOut: {
            /** Items */
            items: components["schemas"]["CustomCakeCard"][];
            /** Total */
            total: number;
            /** Facets */
            facets: components["schemas"]["CakeFacet"][];
        };
        /**
         * CustomCakesContent
         * @description «Торты на заказ»: до 014 контент был свободным JSON (находка 11 из 004b).
         *     Схема повторяет то, что уже лежит в базе, плюс меню шапки.
         */
        CustomCakesContent: {
            /** Title */
            title?: string | null;
            /** Subtitle */
            subtitle?: string | null;
            /** Consultation Text */
            consultation_text?: string | null;
            /**
             * Stages
             * @default []
             */
            stages: components["schemas"]["CakeStage"][];
            header_menu?: components["schemas"]["CakesHeaderMenu"] | null;
            /** Calculator Text */
            calculator_text?: string | null;
            /** Calculator Note */
            calculator_note?: string | null;
            /** Prices Intro */
            prices_intro?: string | null;
            /** Prices Note */
            prices_note?: string | null;
            /** Fillings Intro */
            fillings_intro?: string | null;
            /** Lead Days Note */
            lead_days_note?: string | null;
            /**
             * Order Facts
             * @default []
             */
            order_facts: components["schemas"]["CakeFact"][];
            /**
             * Faq
             * @default []
             */
            faq: components["schemas"]["CakeQuestion"][];
            /** Design Filling Note */
            design_filling_note?: string | null;
            /** Tasting Set Slug */
            tasting_set_slug?: string | null;
        };
        /**
         * CustomCakesContentPageOut
         * @description `GET /pages/custom_cakes`: контент «Тортов на заказ» со схемой — его читает
         *     мега-меню шапки на каждой странице (014).
         */
        CustomCakesContentPageOut: {
            page_key: components["schemas"]["PageKey"];
            content: components["schemas"]["CustomCakesContent"];
            /** Address */
            address?: string | null;
            /** Phone */
            phone?: string | null;
            /** Work Hours Weekdays */
            work_hours_weekdays?: string | null;
            /** Work Hours Weekend */
            work_hours_weekend?: string | null;
            /** Delivery Hours */
            delivery_hours?: string | null;
            /** Map Embed Code */
            map_embed_code?: string | null;
            /** Yandex Rating */
            yandex_rating?: string | null;
            /** Yandex Reviews Count */
            yandex_reviews_count?: number | null;
            /** Yandex Maps Url */
            yandex_maps_url?: string | null;
            /** Telegram Url */
            telegram_url?: string | null;
        };
        /**
         * CustomCakesInfoOut
         * @description `GET /custom-cakes/info`: всё для страницы, кроме сетки дизайнов.
         */
        CustomCakesInfoOut: {
            /** Title */
            title: string | null;
            /** Subtitle */
            subtitle: string | null;
            /** Idea Text */
            idea_text: string | null;
            /** Calculator Text */
            calculator_text: string | null;
            /** Calculator Note */
            calculator_note: string | null;
            /** Facts */
            facts: components["schemas"]["LabeledValue"][];
            /** Prices Intro */
            prices_intro: string | null;
            /** Prices */
            prices: components["schemas"]["CakePriceOut"][];
            /** Prices Note */
            prices_note: string | null;
            /** Fillings Intro */
            fillings_intro: string | null;
            /** Fillings */
            fillings: components["schemas"]["FillingCardOut"][];
            /** Fillings More */
            fillings_more: boolean;
            tasting_set: components["schemas"]["TastingSetOut"] | null;
            /** Stages */
            stages: components["schemas"]["CakeStage"][];
            /** Order Facts */
            order_facts: components["schemas"]["LabeledValue"][];
            /** Faq */
            faq: components["schemas"]["CakeFaqItem"][];
            /** Min Weight Kg */
            min_weight_kg: string;
            /** Lead Days */
            lead_days: number;
            /** Grams Per Guest */
            grams_per_guest: number;
            /**
             * Earliest Date
             * Format: date
             */
            earliest_date: string;
            /** Extras */
            extras: components["schemas"]["CakeExtraOut"][];
            /** Occasions */
            occasions: components["schemas"]["OccasionOption"][];
        };
        /** Dashboard */
        Dashboard: {
            /**
             * Today
             * Format: date
             */
            today: string;
            /**
             * Now
             * Format: date-time
             */
            now: string;
            counters: components["schemas"]["Counters"];
            revenue: components["schemas"]["Revenue"];
            orders_by_day: components["schemas"]["OrdersByDay"];
            categories: components["schemas"]["CategoryShares"];
            plan: components["schemas"]["Plan"];
            consultations: components["schemas"]["Consultations"];
            /** Popular */
            popular: components["schemas"]["PopularProduct"][];
            calendar: components["schemas"]["Calendar"];
            /** Activity */
            activity: components["schemas"]["ActivityItem"][];
            /** Reviews */
            reviews: components["schemas"]["ReviewBrief"][];
        };
        /** DashboardStats */
        DashboardStats: {
            /** Orders New */
            orders_new: number;
            /** Orders Today */
            orders_today: number;
            /** Orders Week */
            orders_week: number;
            /** Consultations New */
            consultations_new: number;
            /** Consultations Week */
            consultations_week: number;
            /** Products Total */
            products_total: number;
            /** Reviews Unpublished */
            reviews_unpublished: number;
        };
        /** DayCount */
        DayCount: {
            /**
             * Day
             * Format: date
             */
            day: string;
            /** Count */
            count: number;
        };
        /**
         * DeliveryInterval
         * @description Интервал доставки/выдачи в оформлении заказа (PDF «Этап 1», путь Марины).
         *
         *     Набор фиксирован в коде, а не редактируется в админке: часы доставки
         *     09:00–21:00 не меняются от заказа к заказу, а свободный текст в этом поле
         *     ломал бы планирование. Если сетка интервалов изменится — это правка enum
         *     и миграция, а не контента.
         * @enum {string}
         */
        DeliveryInterval: "09-12" | "12-15" | "15-18" | "18-21";
        /**
         * DeliveryMethod
         * @enum {string}
         */
        DeliveryMethod: "pickup" | "delivery";
        /**
         * DietaryTag
         * @description Ограничения в питании — сквозной сегмент (PDF «Этап 1», раздел 6).
         *
         *     Отдельно от ProductTag: «новинка/хит/сезон» — маркетинговые метки,
         *     а это обещание о составе, и фильтруется оно по-другому (через И, а не ИЛИ).
         * @enum {string}
         */
        DietaryTag: "gluten_free" | "lactose_free" | "low_sugar";
        /**
         * EarliestReasonOut
         * @description Позиция, которая сдвинула раннюю дату: «Три шоколада, 1,4 кг готовится
         *     2 дня, поэтому весь заказ можно получить с 9 октября». Текст собирает фронт.
         */
        EarliestReasonOut: {
            /** Name */
            name: string;
            /** Variant Label */
            variant_label: string;
            /** Has Variants */
            has_variants: boolean;
            /** Lead Time Days */
            lead_time_days: number;
        };
        /**
         * EstimateOut
         * @description Калькулятор «Сколько нужно торта» и ориентир окна заявки.
         */
        EstimateOut: {
            /** Guests */
            guests: number;
            /** Weight Kg */
            weight_kg: string;
            /** Tiers */
            tiers: number;
            decoration: components["schemas"]["CakeDecoration"];
            /** Price Per Kg */
            price_per_kg: number;
            /** Price From */
            price_from: number;
        };
        /** FaqItem */
        FaqItem: {
            /** Question */
            question: string;
            /** Answer */
            answer: string;
        };
        /** FeedbackCreate */
        FeedbackCreate: {
            /** Website */
            website?: string | null;
            /** Consent Pd */
            consent_pd: boolean;
            /** Name */
            name: string;
            /** Phone */
            phone: string;
            /** Message */
            message?: string | null;
        };
        /** FillingAdminOut */
        FillingAdminOut: {
            /** Name */
            name: string;
            /** Description */
            description: string;
            /** Short Description */
            short_description?: string | null;
            /**
             * Dietary
             * @default []
             */
            dietary: components["schemas"]["DietaryTag"][];
            /** Image Key */
            image_key: string;
            /** Price Per Kg */
            price_per_kg: string;
            /**
             * Is Available
             * @default true
             */
            is_available: boolean;
            /**
             * Order
             * @default 0
             */
            order: number;
            /** Id */
            id: number;
        };
        /** FillingCardOut */
        FillingCardOut: {
            /** Id */
            id: number;
            /** Name */
            name: string;
            /** Short Description */
            short_description: string;
            /** Description */
            description: string;
            /** Image Key */
            image_key: string;
            /** Dietary */
            dietary: components["schemas"]["DietaryTag"][];
            /** Dietary Labels */
            dietary_labels: string[];
        };
        /** FillingIn */
        FillingIn: {
            /** Name */
            name: string;
            /** Description */
            description: string;
            /** Short Description */
            short_description?: string | null;
            /**
             * Dietary
             * @default []
             */
            dietary: components["schemas"]["DietaryTag"][];
            /** Image Key */
            image_key: string;
            /** Price Per Kg */
            price_per_kg: number | string;
            /**
             * Is Available
             * @default true
             */
            is_available: boolean;
            /**
             * Order
             * @default 0
             */
            order: number;
        };
        /** FillingOut */
        FillingOut: {
            /** Id */
            id: number;
            /** Name */
            name: string;
            /** Description */
            description: string;
            /** Image Key */
            image_key: string;
            /** Price Per Kg */
            price_per_kg: string;
        };
        /** FilterOption[Availability] */
        FilterOption_Availability_: {
            value: components["schemas"]["Availability"];
            /** Label */
            label: string;
            /** Count */
            count: number;
        };
        /** FilterOption[DietaryTag] */
        FilterOption_DietaryTag_: {
            value: components["schemas"]["DietaryTag"];
            /** Label */
            label: string;
            /** Count */
            count: number;
        };
        /** FilterOption[Occasion] */
        FilterOption_Occasion_: {
            value: components["schemas"]["Occasion"];
            /** Label */
            label: string;
            /** Count */
            count: number;
        };
        /** FilterOption[PortionsRange] */
        FilterOption_PortionsRange_: {
            value: components["schemas"]["PortionsRange"];
            /** Label */
            label: string;
            /** Count */
            count: number;
        };
        /** FilterOption[Recipient] */
        FilterOption_Recipient_: {
            value: components["schemas"]["Recipient"];
            /** Label */
            label: string;
            /** Count */
            count: number;
        };
        /**
         * GalleryContent
         * @description Страница «Работы» (009): текст справа от заголовка и плашка внизу.
         *     Отдельная страница контента, а не блок «Тортов на заказ»: в «Страницах сайта»
         *     редактор ищет текст «Работ» на вкладке «Работы».
         */
        GalleryContent: {
            /** Intro */
            intro?: string | null;
            cta?: components["schemas"]["GalleryCta"] | null;
        };
        /**
         * GalleryCta
         * @description Бордовая плашка внизу «Работ»: «Не нашли похожий?».
         */
        GalleryCta: {
            /** Title */
            title: string;
            /** Text */
            text: string;
        };
        /**
         * GalleryFacet
         * @description «Таблетка» фильтра «Работ»: повод (или группа поводов) и число работ.
         */
        GalleryFacet: {
            value: components["schemas"]["GalleryOccasion"];
            /** Label */
            label: string;
            /** Count */
            count: number;
        };
        /** GalleryItemAdminOut */
        GalleryItemAdminOut: {
            /** Image Key */
            image_key: string;
            /** Detail Image Key */
            detail_image_key?: string | null;
            /** Caption */
            caption: string;
            /** Description */
            description?: string | null;
            occasion?: components["schemas"]["Occasion"] | null;
            /** Tiers */
            tiers?: number | null;
            /** Weight Grams */
            weight_grams?: number | null;
            /** Guests */
            guests?: number | null;
            /** Made In */
            made_in?: string | null;
            /**
             * Is Active
             * @default true
             */
            is_active: boolean;
            /**
             * Order
             * @default 0
             */
            order: number;
            /** Id */
            id: number;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /** GalleryItemIn */
        GalleryItemIn: {
            /** Image Key */
            image_key: string;
            /** Detail Image Key */
            detail_image_key?: string | null;
            /** Caption */
            caption: string;
            /** Description */
            description?: string | null;
            occasion?: components["schemas"]["Occasion"] | null;
            /** Tiers */
            tiers?: number | null;
            /** Weight Grams */
            weight_grams?: number | null;
            /** Guests */
            guests?: number | null;
            /** Made In */
            made_in?: string | null;
            /**
             * Is Active
             * @default true
             */
            is_active: boolean;
            /**
             * Order
             * @default 0
             */
            order: number;
        };
        /** GalleryItemOut */
        GalleryItemOut: {
            /** Id */
            id: number;
            /** Image Key */
            image_key: string;
            /** Detail Image Key */
            detail_image_key: string | null;
            /** Caption */
            caption: string;
            /** Description */
            description: string | null;
            occasion: components["schemas"]["Occasion"] | null;
            /** Tiers */
            tiers: number | null;
            /** Weight Grams */
            weight_grams: number | null;
            /** Guests */
            guests: number | null;
            /** Made In */
            made_in: string | null;
        };
        /**
         * GalleryOccasion
         * @description Фильтр «Работ» (009) и карточки мега-меню «Торты на заказ» (014).
         *
         *     Отдельно от `Occasion`: фильтр показывает «Юбилей и корпоратив» одной
         *     «таблеткой», а у работы повод один — юбилей или корпоратив. Значение-группа
         *     `anniversary_corporate` разворачивается в оба повода в запросе (GALLERY_GROUPS).
         *     Одно значение, а не список `?occasion=a&occasion=b`: адрес короче, его легко
         *     поставить в меню и в админке, а canonical/noindex считаются как у каталога.
         * @enum {string}
         */
        GalleryOccasion: "wedding" | "birthday" | "kids" | "anniversary_corporate";
        /**
         * GalleryPageOut
         * @description `GET /pages/gallery`: тексты страницы «Работы» (009).
         */
        GalleryPageOut: {
            page_key: components["schemas"]["PageKey"];
            content: components["schemas"]["GalleryContent"];
            /** Address */
            address?: string | null;
            /** Phone */
            phone?: string | null;
            /** Work Hours Weekdays */
            work_hours_weekdays?: string | null;
            /** Work Hours Weekend */
            work_hours_weekend?: string | null;
            /** Delivery Hours */
            delivery_hours?: string | null;
            /** Map Embed Code */
            map_embed_code?: string | null;
            /** Yandex Rating */
            yandex_rating?: string | null;
            /** Yandex Reviews Count */
            yandex_reviews_count?: number | null;
            /** Yandex Maps Url */
            yandex_maps_url?: string | null;
            /** Telegram Url */
            telegram_url?: string | null;
        };
        /**
         * GalleryWorkOut
         * @description `GET /gallery/{id}` — работа как образец в окне заявки («Заказать похожий»).
         */
        GalleryWorkOut: {
            /** Id */
            id: number;
            /** Caption */
            caption: string;
            /** Image Key */
            image_key: string;
            /** Occasion Label */
            occasion_label: string | null;
            /** Tiers */
            tiers: number | null;
            /** Guests */
            guests: number | null;
        };
        /**
         * GeoPoint
         * @description Координаты кондитерской для разметки `Bakery.geo` (задание 012).
         *
         *     Отдельно от адреса: из строки «Гжатская улица, 5к8» координаты не получить
         *     без геокодера, а выдумывать их нельзя — точка на карте в выдаче покажет не туда.
         */
        GeoPoint: {
            /** Latitude */
            latitude: number;
            /** Longitude */
            longitude: number;
        };
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail?: components["schemas"]["ValidationError"][];
        };
        /** HeroBlock */
        HeroBlock: {
            /** Title Lines */
            title_lines: string[];
            /** Subtitle Lines */
            subtitle_lines: string[];
            cta: components["schemas"]["Cta"];
            /** Video Key */
            video_key?: string | null;
            /** Poster Key */
            poster_key?: string | null;
        };
        /**
         * HomeContent
         * @description Главная сверху вниз. Любой блок может отсутствовать — тогда на сайте
         *     его нет (герой и заголовки витрины берут тексты макета по умолчанию).
         */
        HomeContent: {
            hero?: components["schemas"]["HeroBlock"] | null;
            /**
             * Ticker
             * @default []
             */
            ticker: string[];
            ready_today?: components["schemas"]["SectionIntro"] | null;
            made_to_order?: components["schemas"]["SectionIntro"] | null;
            /**
             * Fillings Intro
             * @default []
             */
            fillings_intro: string[];
            order_banner?: components["schemas"]["OrderBanner"] | null;
            author?: components["schemas"]["AuthorBlock"] | null;
            /**
             * Faq
             * @default []
             */
            faq: components["schemas"]["FaqItem"][];
        };
        /**
         * HomePageOut
         * @description `GET /pages/home`: тот же ответ, но `content` описан схемой.
         */
        HomePageOut: {
            page_key: components["schemas"]["PageKey"];
            content: components["schemas"]["HomeContent"];
            /** Address */
            address?: string | null;
            /** Phone */
            phone?: string | null;
            /** Work Hours Weekdays */
            work_hours_weekdays?: string | null;
            /** Work Hours Weekend */
            work_hours_weekend?: string | null;
            /** Delivery Hours */
            delivery_hours?: string | null;
            /** Map Embed Code */
            map_embed_code?: string | null;
            /** Yandex Rating */
            yandex_rating?: string | null;
            /** Yandex Reviews Count */
            yandex_reviews_count?: number | null;
            /** Yandex Maps Url */
            yandex_maps_url?: string | null;
            /** Telegram Url */
            telegram_url?: string | null;
        };
        /**
         * ImageRole
         * @description Что показывает фото товара: подпись миниатюры на странице товара.
         * @enum {string}
         */
        ImageRole: "whole" | "cut" | "detail" | "package";
        /**
         * LabeledValue
         * @description Факт «от 2 кг — минимальный вес» и факты под «Как заказать».
         */
        LabeledValue: {
            /** Value */
            value: string;
            /** Label */
            label: string;
        };
        /**
         * LargeEvent
         * @description Крупное событие для календаря: заявка (свадьба, много гостей) или большой заказ.
         */
        LargeEvent: {
            /**
             * Day
             * Format: date
             */
            day: string;
            /** Label */
            label: string;
            /** Href */
            href: string;
        };
        /**
         * LegacyKind
         * @enum {string}
         */
        LegacyKind: "product" | "subcategory" | "media";
        /**
         * LegacyTarget
         * @description Куда вести старый адрес: путь на сайте или ключ файла в хранилище.
         *
         *     Для картинки — ключ, а не готовый адрес: публичный адрес хранилища знает
         *     сайт (на проде это домен бакета), бэкенду он не нужен.
         */
        LegacyTarget: {
            /** Location */
            location?: string | null;
            /** Media Key */
            media_key?: string | null;
        };
        /**
         * LegalContent
         * @description Правовые документы (010b): «Редакция от …» под заголовком каждого.
         *
         *     Тексты документов — в коде страниц: их правит юрист вместе с разработчиком,
         *     а не редактор. Имя оператора ПДн — из реквизитов контактов (`legal.name`),
         *     чтобы исправлять его в одном месте. Дата — то, что меняется при каждой
         *     новой редакции, поэтому она здесь.
         */
        LegalContent: {
            /** Privacy Revised At */
            privacy_revised_at?: string | null;
            /** Terms Revised At */
            terms_revised_at?: string | null;
            /** Consent Revised At */
            consent_revised_at?: string | null;
        };
        /**
         * LegalInfo
         * @description Реквизиты ИП в подвале.
         */
        LegalInfo: {
            /** Name */
            name: string;
            /** Ogrnip */
            ogrnip: string;
            /** Inn */
            inn?: string | null;
            /** Production Address */
            production_address?: string | null;
        };
        /**
         * LegalPageOut
         * @description `GET /pages/legal`: даты редакции правовых документов (010b).
         */
        LegalPageOut: {
            page_key: components["schemas"]["PageKey"];
            content: components["schemas"]["LegalContent"];
            /** Address */
            address?: string | null;
            /** Phone */
            phone?: string | null;
            /** Work Hours Weekdays */
            work_hours_weekdays?: string | null;
            /** Work Hours Weekend */
            work_hours_weekend?: string | null;
            /** Delivery Hours */
            delivery_hours?: string | null;
            /** Map Embed Code */
            map_embed_code?: string | null;
            /** Yandex Rating */
            yandex_rating?: string | null;
            /** Yandex Reviews Count */
            yandex_reviews_count?: number | null;
            /** Yandex Maps Url */
            yandex_maps_url?: string | null;
            /** Telegram Url */
            telegram_url?: string | null;
        };
        /**
         * LoginPhotoOut
         * @description Фото для страницы входа в админку: работа из «Примеров работ» или главное
         *     фото товара. Только ключ картинки и название — ничего о покупателях.
         */
        LoginPhotoOut: {
            /** Image Key */
            image_key: string;
            /** Caption */
            caption: string;
            /**
             * Kind
             * @enum {string}
             */
            kind: "work" | "product";
            /** Width */
            width: number;
            /** Height */
            height: number;
            /** Bg */
            bg: string;
        };
        /** LoginRequest */
        LoginRequest: {
            /**
             * Email
             * Format: email
             */
            email: string;
            /** Password */
            password: string;
        };
        /**
         * NearestSlot
         * @description Ближайшее окно выдачи: «Можно забрать сегодня · ближайшее окно 15:00–18:00».
         *     Дата завтрашняя — «Можно забрать завтра».
         */
        NearestSlot: {
            /**
             * Date
             * Format: date
             */
            date: string;
            interval: components["schemas"]["DeliveryInterval"];
            /** Days Ahead */
            days_ahead: number;
        };
        /**
         * Nutrition
         * @description КБЖУ на 100 г. Приходит `null`, если не заполнен ни один показатель.
         */
        Nutrition: {
            /** Kcal */
            kcal: string | null;
            /** Proteins */
            proteins: string | null;
            /** Fats */
            fats: string | null;
            /** Carbs */
            carbs: string | null;
        };
        /**
         * Occasion
         * @description Повод — сквозной фильтр каталога и галереи (PDF «Этап 1», раздел 12).
         *
         *     Каталог по-прежнему строится по типу продукта (5 групп), а повод работает
         *     поверх дерева фильтром: у Абрикосовой ассортимент шире тортов, и ось «повод»
         *     его целиком не покрывает. Один товар может подходить под несколько поводов.
         * @enum {string}
         */
        Occasion: "birthday" | "kids" | "wedding" | "corporate" | "tea" | "anniversary";
        /** OccasionOption */
        OccasionOption: {
            value: components["schemas"]["RequestOccasion"];
            /** Label */
            label: string;
        };
        /**
         * OrderAdminDetail
         * @description Карточка заказа в админке: всё, что нужно менеджеру, включая контакты.
         *     Каждый просмотр пишется в журнал (152-ФЗ: кто смотрел ПДн клиента).
         */
        OrderAdminDetail: {
            /** Id */
            id: number;
            /** Order Number */
            order_number: string;
            /** Customer Name */
            customer_name: string;
            /** Customer Phone */
            customer_phone: string;
            /** Customer Comment */
            customer_comment: string | null;
            /** Customer Email */
            customer_email: string | null;
            contact_method: components["schemas"]["ContactMethod"] | null;
            /** Recipient Name */
            recipient_name: string | null;
            /** Recipient Phone */
            recipient_phone: string | null;
            delivery_method: components["schemas"]["DeliveryMethod"];
            /** Delivery Address */
            delivery_address: string | null;
            /** Address Apartment */
            address_apartment: string | null;
            /** Address Entrance */
            address_entrance: string | null;
            /** Address Floor */
            address_floor: string | null;
            /** Courier Comment */
            courier_comment: string | null;
            /** Desired Date */
            desired_date: string | null;
            delivery_interval: components["schemas"]["DeliveryInterval"] | null;
            /** Subtotal */
            subtotal: string;
            /** Delivery Price */
            delivery_price: string;
            /** Total Price */
            total_price: string;
            status: components["schemas"]["OrderStatus"];
            /** Cancel Reason */
            cancel_reason: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** After Hours */
            after_hours: boolean;
            /** Items */
            items: components["schemas"]["OrderAdminItem"][];
        };
        /** OrderAdminItem */
        OrderAdminItem: {
            /** Product Id */
            product_id: number;
            /** Name */
            name: string;
            /** Variant Label */
            variant_label: string;
            /** Quantity */
            quantity: number;
            /** Price */
            price: string;
            /** Inscription Text */
            inscription_text: string | null;
            /** Inscription Price */
            inscription_price: string | null;
            /** Line Total */
            line_total: string;
            /** Image Key */
            image_key: string | null;
        };
        /** OrderAdminListItem */
        OrderAdminListItem: {
            /** Id */
            id: number;
            /** Order Number */
            order_number: string;
            /** Customer Name */
            customer_name: string;
            /** Customer Phone */
            customer_phone: string;
            delivery_method: components["schemas"]["DeliveryMethod"];
            /** Desired Date */
            desired_date: string | null;
            delivery_interval: components["schemas"]["DeliveryInterval"] | null;
            /** Total Price */
            total_price: string;
            status: components["schemas"]["OrderStatus"];
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Items Summary
             * @default
             */
            items_summary: string;
        };
        /**
         * OrderBanner
         * @description Бордовая плашка «Опишите повод и дату» под этапами заказа.
         */
        OrderBanner: {
            /** Title */
            title: string;
            /** Text */
            text: string;
        };
        /**
         * OrderConfirmationOut
         * @description Страница «Заказ принят» (007a). Открывается по номеру и токену из ссылки,
         *     без входа, поэтому телефон и почта — в маске: «+7 (916) ***-**-67», «an***@mail.ru».
         *     Имени покупателя и получателя здесь нет: странице они не нужны.
         */
        OrderConfirmationOut: {
            /** Order Number */
            order_number: string;
            status: components["schemas"]["OrderStatus"];
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            contact_method: components["schemas"]["ContactMethod"] | null;
            /** Phone Masked */
            phone_masked: string;
            /** Email Masked */
            email_masked: string | null;
            delivery_method: components["schemas"]["DeliveryMethod"];
            /** Delivery Address */
            delivery_address: string | null;
            /** Address Apartment */
            address_apartment: string | null;
            /** Address Entrance */
            address_entrance: string | null;
            /** Address Floor */
            address_floor: string | null;
            /** Desired Date */
            desired_date: string | null;
            delivery_interval: components["schemas"]["DeliveryInterval"] | null;
            /** Items */
            items: components["schemas"]["OrderItemOut"][];
            /** Subtotal */
            subtotal: string;
            /** Delivery Price */
            delivery_price: string;
            /** Total Price */
            total_price: string;
            /** After Hours */
            after_hours: boolean;
            /** Work Hours Start */
            work_hours_start: number;
            /** Work Hours End */
            work_hours_end: number;
        };
        /** OrderCreate */
        OrderCreate: {
            /** Website */
            website?: string | null;
            /** Consent Pd */
            consent_pd: boolean;
            /** Customer Name */
            customer_name: string;
            /** Customer Phone */
            customer_phone: string;
            /** Customer Email */
            customer_email: string;
            /** @default call */
            contact_method: components["schemas"]["ContactMethod"];
            /** Customer Comment */
            customer_comment?: string | null;
            delivery_method: components["schemas"]["DeliveryMethod"];
            /** Delivery Address */
            delivery_address?: string | null;
            /** Address Apartment */
            address_apartment?: string | null;
            /** Address Entrance */
            address_entrance?: string | null;
            /** Address Floor */
            address_floor?: string | null;
            /** Courier Comment */
            courier_comment?: string | null;
            /**
             * Other Recipient
             * @default false
             */
            other_recipient: boolean;
            /** Recipient Name */
            recipient_name?: string | null;
            /** Recipient Phone */
            recipient_phone?: string | null;
            /**
             * Desired Date
             * Format: date
             */
            desired_date: string;
            delivery_interval: components["schemas"]["DeliveryInterval"];
        };
        /**
         * OrderCreated
         * @description Ответ оформления: всё для страницы «Заказ принят» и токен её адреса
         *     `/order/<номер>?t=<token>` (HMAC, 7 дней).
         */
        OrderCreated: {
            /** Order Number */
            order_number: string;
            status: components["schemas"]["OrderStatus"];
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            contact_method: components["schemas"]["ContactMethod"] | null;
            /** Phone Masked */
            phone_masked: string;
            /** Email Masked */
            email_masked: string | null;
            delivery_method: components["schemas"]["DeliveryMethod"];
            /** Delivery Address */
            delivery_address: string | null;
            /** Address Apartment */
            address_apartment: string | null;
            /** Address Entrance */
            address_entrance: string | null;
            /** Address Floor */
            address_floor: string | null;
            /** Desired Date */
            desired_date: string | null;
            delivery_interval: components["schemas"]["DeliveryInterval"] | null;
            /** Items */
            items: components["schemas"]["OrderItemOut"][];
            /** Subtotal */
            subtotal: string;
            /** Delivery Price */
            delivery_price: string;
            /** Total Price */
            total_price: string;
            /** After Hours */
            after_hours: boolean;
            /** Work Hours Start */
            work_hours_start: number;
            /** Work Hours End */
            work_hours_end: number;
            /** Token */
            token: string;
        };
        /**
         * OrderIds
         * @description Новый порядок — весь список id целиком (как у фото товара в 011d).
         */
        OrderIds: {
            /** Ids */
            ids: number[];
        };
        /** OrderItemOut */
        OrderItemOut: {
            /** Product Id */
            product_id: number;
            /** Name */
            name: string;
            /** Variant Label */
            variant_label: string;
            /** Quantity */
            quantity: number;
            /** Price */
            price: string;
            /** Inscription Text */
            inscription_text: string | null;
            /** Inscription Price */
            inscription_price: string | null;
            /** Line Total */
            line_total: string;
        };
        /**
         * OrderListPage
         * @description Список заказов (011d): страница + счётчики вкладок по статусам с теми же
         *     фильтрами даты и способа, чтобы цифры на вкладках совпадали со списком.
         */
        OrderListPage: {
            /** Items */
            items: components["schemas"]["OrderAdminListItem"][];
            /** Total */
            total: number;
            /** Page */
            page: number;
            /** Page Size */
            page_size: number;
            /** Counts */
            counts: {
                [key: string]: number;
            };
        };
        /**
         * OrderStatus
         * @enum {string}
         */
        OrderStatus: "new" | "confirmed" | "in_progress" | "ready" | "completed" | "cancelled";
        /** OrderStatusUpdate */
        OrderStatusUpdate: {
            status: components["schemas"]["OrderStatus"];
            /** Reason */
            reason?: string | null;
        };
        /**
         * OrdersByDay
         * @description Заказы к выдаче по желаемой дате.
         */
        OrdersByDay: {
            /** Days */
            days: components["schemas"]["DayCount"][];
            /** Today */
            today: number;
            /** Yesterday */
            yesterday: number;
            /** Upcoming */
            upcoming: components["schemas"]["UpcomingDay"][];
        };
        /** PageContentIn */
        PageContentIn: {
            /**
             * Content
             * @default {}
             */
            content: {
                [key: string]: unknown;
            };
            /** Address */
            address?: string | null;
            /** Phone */
            phone?: string | null;
            /** Work Hours Weekdays */
            work_hours_weekdays?: string | null;
            /** Work Hours Weekend */
            work_hours_weekend?: string | null;
            /** Delivery Hours */
            delivery_hours?: string | null;
            /** Map Embed Code */
            map_embed_code?: string | null;
            /** Yandex Rating */
            yandex_rating?: number | string | null;
            /** Yandex Reviews Count */
            yandex_reviews_count?: number | null;
            /** Yandex Maps Url */
            yandex_maps_url?: string | null;
            /** Telegram Url */
            telegram_url?: string | null;
        };
        /** PageContentOut */
        PageContentOut: {
            page_key: components["schemas"]["PageKey"];
            /** Content */
            content: {
                [key: string]: unknown;
            };
            /** Address */
            address?: string | null;
            /** Phone */
            phone?: string | null;
            /** Work Hours Weekdays */
            work_hours_weekdays?: string | null;
            /** Work Hours Weekend */
            work_hours_weekend?: string | null;
            /** Delivery Hours */
            delivery_hours?: string | null;
            /** Map Embed Code */
            map_embed_code?: string | null;
            /** Yandex Rating */
            yandex_rating?: string | null;
            /** Yandex Reviews Count */
            yandex_reviews_count?: number | null;
            /** Yandex Maps Url */
            yandex_maps_url?: string | null;
            /** Telegram Url */
            telegram_url?: string | null;
        };
        /**
         * PageKey
         * @enum {string}
         */
        PageKey: "home" | "about" | "custom_cakes" | "contacts" | "gallery" | "legal";
        /** Page[ActivityItem] */
        Page_ActivityItem_: {
            /** Items */
            items: components["schemas"]["ActivityItem"][];
            /** Total */
            total: number;
            /** Page */
            page: number;
            /** Page Size */
            page_size: number;
        };
        /** Page[GalleryItemOut] */
        Page_GalleryItemOut_: {
            /** Items */
            items: components["schemas"]["GalleryItemOut"][];
            /** Total */
            total: number;
            /** Page */
            page: number;
            /** Page Size */
            page_size: number;
        };
        /** Page[ProductAdminListItem] */
        Page_ProductAdminListItem_: {
            /** Items */
            items: components["schemas"]["ProductAdminListItem"][];
            /** Total */
            total: number;
            /** Page */
            page: number;
            /** Page Size */
            page_size: number;
        };
        /** Page[ProductListItem] */
        Page_ProductListItem_: {
            /** Items */
            items: components["schemas"]["ProductListItem"][];
            /** Total */
            total: number;
            /** Page */
            page: number;
            /** Page Size */
            page_size: number;
        };
        /** Page[ReviewOut] */
        Page_ReviewOut_: {
            /** Items */
            items: components["schemas"]["ReviewOut"][];
            /** Total */
            total: number;
            /** Page */
            page: number;
            /** Page Size */
            page_size: number;
        };
        /** PasswordChange */
        PasswordChange: {
            /** Current Password */
            current_password: string;
            /** New Password */
            new_password: string;
        };
        /** Plan */
        Plan: {
            /** Today */
            today: components["schemas"]["PlanItem"][];
            /** Tomorrow */
            tomorrow: components["schemas"]["PlanItem"][];
        };
        /** PlanItem */
        PlanItem: {
            /** Id */
            id: number;
            /** Order Number */
            order_number: string;
            /** Customer Name */
            customer_name: string;
            /** Items */
            items: string;
            delivery_method: components["schemas"]["DeliveryMethod"];
            delivery_interval: components["schemas"]["DeliveryInterval"] | null;
            status: components["schemas"]["OrderStatus"];
        };
        /** PopularProduct */
        PopularProduct: {
            /** Id */
            id: number;
            /** Name */
            name: string;
            /** Slug */
            slug: string;
            /** Category */
            category: string;
            /** Subcategory */
            subcategory: string;
            /** Image Key */
            image_key: string | null;
            /** Sold */
            sold: number;
            /** Is Active */
            is_active: boolean;
            /** Is Available */
            is_available: boolean;
            /** Lead Time Days */
            lead_time_days: number;
        };
        /**
         * PortionsRange
         * @description Корзины фильтра «Порции» (PDF «Этап 1», раздел 12): до 4, 4–8, 8–15, больше 15.
         * @enum {string}
         */
        PortionsRange: "up_to_4" | "4_8" | "8_15" | "over_15";
        /** PriceRange */
        PriceRange: {
            /** Min */
            min: string | null;
            /** Max */
            max: string | null;
        };
        /**
         * ProductAdminListItem
         * @description Строка списка каталога (011e): товар + главное фото и названия разделов,
         *     чтобы список не делал по запросу на строку.
         */
        ProductAdminListItem: {
            /** Name */
            name: string;
            /** Slug */
            slug: string;
            /** Category Id */
            category_id: number;
            /** Subcategory Id */
            subcategory_id: number;
            /**
             * Is Available
             * @default true
             */
            is_available: boolean;
            /**
             * Is Active
             * @default true
             */
            is_active: boolean;
            /** Description */
            description: string;
            /** Composition */
            composition: string;
            /** Subtitle */
            subtitle?: string | null;
            /** Card Ingredients */
            card_ingredients?: string | null;
            /** Allergens */
            allergens?: string | null;
            /** Packaging */
            packaging?: string | null;
            /** Kcal */
            kcal?: string | null;
            /** Proteins */
            proteins?: string | null;
            /** Fats */
            fats?: string | null;
            /** Carbs */
            carbs?: string | null;
            /** Shelf Life */
            shelf_life?: string | null;
            /** Storage Conditions */
            storage_conditions?: string | null;
            /** Transport Time */
            transport_time?: string | null;
            /** Card Label */
            card_label?: string | null;
            /**
             * Lead Time Days
             * @default 0
             */
            lead_time_days: number;
            /**
             * Sold Out Today
             * @default false
             */
            sold_out_today: boolean;
            /**
             * Tags
             * @default []
             */
            tags: components["schemas"]["ProductTag"][];
            /**
             * Occasions
             * @default []
             */
            occasions: components["schemas"]["Occasion"][];
            /**
             * Dietary
             * @default []
             */
            dietary: components["schemas"]["DietaryTag"][];
            /**
             * Recipients
             * @default []
             */
            recipients: components["schemas"]["Recipient"][];
            /**
             * Allows Inscription
             * @default false
             */
            allows_inscription: boolean;
            /**
             * Is Featured
             * @default false
             */
            is_featured: boolean;
            /**
             * Is Upsell
             * @default false
             */
            is_upsell: boolean;
            /**
             * Order
             * @default 0
             */
            order: number;
            /** Variants */
            variants: components["schemas"]["VariantAdminOut"][];
            /** Id */
            id: number;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            /** Price From */
            price_from: string | null;
            /** Main Image */
            main_image?: string | null;
            /**
             * Category Name
             * @default
             */
            category_name: string;
            /**
             * Subcategory Name
             * @default
             */
            subcategory_name: string;
        };
        /** ProductAdminOut */
        ProductAdminOut: {
            /** Name */
            name: string;
            /** Slug */
            slug: string;
            /** Category Id */
            category_id: number;
            /** Subcategory Id */
            subcategory_id: number;
            /**
             * Is Available
             * @default true
             */
            is_available: boolean;
            /**
             * Is Active
             * @default true
             */
            is_active: boolean;
            /** Description */
            description: string;
            /** Composition */
            composition: string;
            /** Subtitle */
            subtitle?: string | null;
            /** Card Ingredients */
            card_ingredients?: string | null;
            /** Allergens */
            allergens?: string | null;
            /** Packaging */
            packaging?: string | null;
            /** Kcal */
            kcal?: string | null;
            /** Proteins */
            proteins?: string | null;
            /** Fats */
            fats?: string | null;
            /** Carbs */
            carbs?: string | null;
            /** Shelf Life */
            shelf_life?: string | null;
            /** Storage Conditions */
            storage_conditions?: string | null;
            /** Transport Time */
            transport_time?: string | null;
            /** Card Label */
            card_label?: string | null;
            /**
             * Lead Time Days
             * @default 0
             */
            lead_time_days: number;
            /**
             * Sold Out Today
             * @default false
             */
            sold_out_today: boolean;
            /**
             * Tags
             * @default []
             */
            tags: components["schemas"]["ProductTag"][];
            /**
             * Occasions
             * @default []
             */
            occasions: components["schemas"]["Occasion"][];
            /**
             * Dietary
             * @default []
             */
            dietary: components["schemas"]["DietaryTag"][];
            /**
             * Recipients
             * @default []
             */
            recipients: components["schemas"]["Recipient"][];
            /**
             * Allows Inscription
             * @default false
             */
            allows_inscription: boolean;
            /**
             * Is Featured
             * @default false
             */
            is_featured: boolean;
            /**
             * Is Upsell
             * @default false
             */
            is_upsell: boolean;
            /**
             * Order
             * @default 0
             */
            order: number;
            /** Variants */
            variants: components["schemas"]["VariantAdminOut"][];
            /** Id */
            id: number;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            /** Price From */
            price_from: string | null;
        };
        /**
         * ProductBulkAction
         * @description Массовое действие над товарами (011e). Один запрос — дифф по каждому товару.
         */
        ProductBulkAction: {
            /** Ids */
            ids: number[];
            /**
             * Action
             * @enum {string}
             */
            action: "hide" | "show" | "unavailable" | "available" | "sold_out" | "back_in_stock";
        };
        /** ProductBulkResult */
        ProductBulkResult: {
            /** Updated */
            updated: number;
        };
        /**
         * ProductDetail
         * @description Карточка товара. Порядок полей повторяет порядок блоков на странице:
         *     галерея → название, варианты и цена → состав и метки → хранение → отзывы
         *     и похожие.
         */
        ProductDetail: {
            /** Id */
            id: number;
            /** Name */
            name: string;
            /** Slug */
            slug: string;
            /** Subtitle */
            subtitle: string | null;
            /** Price From */
            price_from: string;
            /** Has Variants */
            has_variants: boolean;
            /** Variants */
            variants: components["schemas"]["VariantOut"][];
            /** Allows Inscription */
            allows_inscription: boolean;
            /** Inscription Price */
            inscription_price: string;
            /** Delivery Price */
            delivery_price: string;
            /** Free Delivery From */
            free_delivery_from: string;
            nearest_slot: components["schemas"]["NearestSlot"] | null;
            /** Is Available */
            is_available: boolean;
            /** Lead Time Days */
            lead_time_days: number;
            /**
             * Sold Out Today
             * @default false
             */
            sold_out_today: boolean;
            /** Card Ingredients */
            card_ingredients?: string | null;
            /** Description */
            description: string;
            /** Composition */
            composition: string;
            /** Allergens */
            allergens: string | null;
            /** Packaging */
            packaging: string | null;
            nutrition: components["schemas"]["Nutrition"] | null;
            /** Tags */
            tags: components["schemas"]["ProductTag"][];
            /** Dietary */
            dietary: components["schemas"]["DietaryTag"][];
            /** Occasions */
            occasions: components["schemas"]["Occasion"][];
            /** Recipients */
            recipients: components["schemas"]["Recipient"][];
            /** Shelf Life */
            shelf_life: string | null;
            /** Storage Conditions */
            storage_conditions: string | null;
            /** Transport Time */
            transport_time: string | null;
            /** Main Image */
            main_image?: string | null;
            category: components["schemas"]["CategoryBreadcrumb"];
            subcategory: components["schemas"]["SubCategoryBreadcrumb"];
            /** Images */
            images: components["schemas"]["ProductImageOut"][];
            /**
             * Reviews
             * @default []
             */
            reviews: components["schemas"]["ReviewOut"][];
            /**
             * Reviews Total
             * @default 0
             */
            reviews_total: number;
            /**
             * Related Products
             * @default []
             */
            related_products: components["schemas"]["ProductListItem"][];
            /**
             * Fillings
             * @default []
             */
            fillings: components["schemas"]["FillingOut"][];
        };
        /** ProductImageOut */
        ProductImageOut: {
            /** Id */
            id: number;
            /** Storage Key */
            storage_key: string;
            /** Is Main */
            is_main: boolean;
            /** Order */
            order: number;
            role?: components["schemas"]["ImageRole"] | null;
        };
        /**
         * ProductImageRoleIn
         * @description Подпись фото: «Целиком», «Срез», «Деталь», «Упаковка»; null — без подписи.
         */
        ProductImageRoleIn: {
            role: components["schemas"]["ImageRole"] | null;
        };
        /** ProductImagesOrder */
        ProductImagesOrder: {
            /** Ids */
            ids: number[];
        };
        /** ProductIn */
        ProductIn: {
            /** Name */
            name: string;
            /** Slug */
            slug: string;
            /** Category Id */
            category_id: number;
            /** Subcategory Id */
            subcategory_id: number;
            /**
             * Is Available
             * @default true
             */
            is_available: boolean;
            /**
             * Is Active
             * @default true
             */
            is_active: boolean;
            /** Description */
            description: string;
            /** Composition */
            composition: string;
            /** Subtitle */
            subtitle?: string | null;
            /** Card Ingredients */
            card_ingredients?: string | null;
            /** Allergens */
            allergens?: string | null;
            /** Packaging */
            packaging?: string | null;
            /** Kcal */
            kcal?: number | string | null;
            /** Proteins */
            proteins?: number | string | null;
            /** Fats */
            fats?: number | string | null;
            /** Carbs */
            carbs?: number | string | null;
            /** Shelf Life */
            shelf_life?: string | null;
            /** Storage Conditions */
            storage_conditions?: string | null;
            /** Transport Time */
            transport_time?: string | null;
            /** Card Label */
            card_label?: string | null;
            /**
             * Lead Time Days
             * @default 0
             */
            lead_time_days: number;
            /**
             * Sold Out Today
             * @default false
             */
            sold_out_today: boolean;
            /**
             * Tags
             * @default []
             */
            tags: components["schemas"]["ProductTag"][];
            /**
             * Occasions
             * @default []
             */
            occasions: components["schemas"]["Occasion"][];
            /**
             * Dietary
             * @default []
             */
            dietary: components["schemas"]["DietaryTag"][];
            /**
             * Recipients
             * @default []
             */
            recipients: components["schemas"]["Recipient"][];
            /**
             * Allows Inscription
             * @default false
             */
            allows_inscription: boolean;
            /**
             * Is Featured
             * @default false
             */
            is_featured: boolean;
            /**
             * Is Upsell
             * @default false
             */
            is_upsell: boolean;
            /**
             * Order
             * @default 0
             */
            order: number;
            /** Variants */
            variants: components["schemas"]["VariantIn"][];
        };
        /**
         * ProductListItem
         * @description Карточка товара в сетке каталога.
         *
         *     Кроме названия и цены несёт ответ на «первый вопрос про размер» — варианты
         *     с весом и порциями, а также короткий состав и метки ограничений: по макету
         *     карточки они видны ещё до перехода на страницу товара.
         */
        ProductListItem: {
            /** Id */
            id: number;
            /** Name */
            name: string;
            /** Slug */
            slug: string;
            /** Price From */
            price_from: string;
            /** Has Variants */
            has_variants: boolean;
            /** Variants */
            variants: components["schemas"]["VariantShort"][];
            /** Is Available */
            is_available: boolean;
            /** Tags */
            tags: components["schemas"]["ProductTag"][];
            /** Dietary */
            dietary: components["schemas"]["DietaryTag"][];
            /** Occasions */
            occasions: components["schemas"]["Occasion"][];
            /** Recipients */
            recipients: components["schemas"]["Recipient"][];
            /** Card Ingredients */
            card_ingredients: string | null;
            /** Allows Inscription */
            allows_inscription: boolean;
            /** Lead Time Days */
            lead_time_days: number;
            /**
             * Sold Out Today
             * @default false
             */
            sold_out_today: boolean;
            subcategory: components["schemas"]["SubCategoryRef"];
            /** Card Label */
            card_label?: string | null;
            /** Main Image */
            main_image?: string | null;
        };
        /**
         * ProductTag
         * @enum {string}
         */
        ProductTag: "new" | "hit" | "season";
        /**
         * ProfileUpdate
         * @description Что сотрудник меняет в своём профиле сам. Роль и активность — только владелец.
         */
        ProfileUpdate: {
            /** Name */
            name: string;
        };
        /**
         * Recipient
         * @description Фильтр «Кому» в каталоге (макет `new/design/catalog/02-filters-open.png`).
         *
         *     Отдельная ось, а не повод: «для детей» — про того, кто будет есть, и он
         *     сочетается с любым поводом («детский день рождения»). Раньше это был
         *     повод `kids`; в каталоге его заменил получатель, а в галерее работ
         *     `Occasion.KIDS` остаётся — там это тип события (задание 009).
         * @enum {string}
         */
        Recipient: "her" | "him" | "kids";
        /** RequestAccepted */
        RequestAccepted: {
            /** Id */
            id: number;
            /**
             * Message
             * @default Заявка отправлена, свяжемся с вами в ближайшее время
             */
            message: string;
        };
        /**
         * RequestOccasion
         * @description Повод в заявке на торт (окно заявки, 008a): «таблетки» фильтра «Работ»
         *     плюс «Другое». Отдельно от `Occasion` каталога: в окне «Юбилей и корпоратив»
         *     — один выбор, а чаепитию торт на заказ не нужен.
         * @enum {string}
         */
        RequestOccasion: "wedding" | "birthday" | "kids" | "anniversary_corporate" | "other";
        /**
         * Revenue
         * @description Выручка и показатели за 7 дней против предыдущих 7.
         */
        Revenue: {
            /**
             * Period Start
             * Format: date
             */
            period_start: string;
            /**
             * Period End
             * Format: date
             */
            period_end: string;
            /** Total */
            total: string;
            /** Previous Total */
            previous_total: string;
            /** Orders */
            orders: number;
            /** Previous Orders */
            previous_orders: number;
            /** Average */
            average: string;
            /** Previous Average */
            previous_average: string;
            /** Cancelled */
            cancelled: number;
            /** Previous Cancelled */
            previous_cancelled: number;
            /** New Customers */
            new_customers: number;
            /** Previous New Customers */
            previous_new_customers: number;
        };
        /** ReviewAdminOut */
        ReviewAdminOut: {
            /** Id */
            id: number;
            /** Product Id */
            product_id: number | null;
            /** Author Name */
            author_name: string;
            /** Text */
            text: string;
            /** Image Key */
            image_key: string | null;
            /** Rating */
            rating: number | null;
            /** Is Published */
            is_published: boolean;
            source: components["schemas"]["ReviewSource"];
            /** External Url */
            external_url: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Product Name */
            product_name?: string | null;
        };
        /** ReviewBrief */
        ReviewBrief: {
            /** Id */
            id: number;
            /** Author Name */
            author_name: string;
            /** Rating */
            rating: number | null;
            /** Text */
            text: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /** ReviewIn */
        ReviewIn: {
            /** Product Id */
            product_id?: number | null;
            /** Author Name */
            author_name: string;
            /** Text */
            text: string;
            /** Image Key */
            image_key?: string | null;
            /** Rating */
            rating?: number | null;
            /**
             * Is Published
             * @default false
             */
            is_published: boolean;
            /** @default manual */
            source: components["schemas"]["ReviewSource"];
            /** External Url */
            external_url?: string | null;
            /** Review Date */
            review_date?: string | null;
        };
        /** ReviewListPage */
        ReviewListPage: {
            /** Items */
            items: components["schemas"]["ReviewAdminOut"][];
            /** Total */
            total: number;
            /** Page */
            page: number;
            /** Page Size */
            page_size: number;
            /** Counts */
            counts: {
                [key: string]: number;
            };
        };
        /** ReviewOut */
        ReviewOut: {
            /** Id */
            id: number;
            /** Author Name */
            author_name: string;
            /** Text */
            text: string;
            /** Image Key */
            image_key: string | null;
            /** Rating */
            rating: number | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            source: components["schemas"]["ReviewSource"];
            /** External Url */
            external_url?: string | null;
            product?: components["schemas"]["ReviewProductRef"] | null;
        };
        /** ReviewProductRef */
        ReviewProductRef: {
            /** Name */
            name: string;
            /** Slug */
            slug: string;
        };
        /**
         * ReviewSource
         * @description Откуда отзыв.
         *
         *     `yandex` — отзыв, перенесённый с Яндекс.Карт (блок «Что говорят гости»
         *     на главной). Его текст внесён вручную, а ссылка `external_url` ведёт на
         *     оригинал: гость должен иметь возможность проверить, что отзыв настоящий.
         * @enum {string}
         */
        ReviewSource: "site_form" | "manual" | "yandex";
        /** ReviewUpdate */
        ReviewUpdate: {
            /** Product Id */
            product_id?: number | null;
            /** Author Name */
            author_name?: string | null;
            /** Text */
            text?: string | null;
            /** Rating */
            rating?: number | null;
            /** Is Published */
            is_published?: boolean | null;
            source?: components["schemas"]["ReviewSource"] | null;
            /** External Url */
            external_url?: string | null;
            /** Review Date */
            review_date?: string | null;
        };
        /** SearchConsultation */
        SearchConsultation: {
            /** Id */
            id: number;
            /** Name */
            name: string;
            /** Phone */
            phone: string;
        };
        /** SearchOrder */
        SearchOrder: {
            /** Id */
            id: number;
            /** Order Number */
            order_number: string;
            /** Customer Name */
            customer_name: string;
            /** Customer Phone */
            customer_phone: string;
        };
        /** SearchProduct */
        SearchProduct: {
            /** Id */
            id: number;
            /** Name */
            name: string;
        };
        /** SearchResults */
        SearchResults: {
            /** Orders */
            orders: components["schemas"]["SearchOrder"][];
            /** Products */
            products: components["schemas"]["SearchProduct"][];
            /** Consultations */
            consultations: components["schemas"]["SearchConsultation"][];
        };
        /** SectionIntro */
        SectionIntro: {
            /** Title */
            title: string;
            /** Subtitle */
            subtitle: string;
            cta: components["schemas"]["Cta"];
        };
        /**
         * SessionOut
         * @description Вход в админку для списка «Где выполнен вход».
         */
        SessionOut: {
            /** Id */
            id: string;
            /** Device */
            device: string;
            /** Ip */
            ip: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Last Used At
             * Format: date-time
             */
            last_used_at: string;
            /** Current */
            current: boolean;
        };
        /** SitemapCategory */
        SitemapCategory: {
            /** Slug */
            slug: string;
            /** Subcategories */
            subcategories: components["schemas"]["SitemapSubcategory"][];
        };
        /** SitemapProduct */
        SitemapProduct: {
            /** Slug */
            slug: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /** SitemapSubcategory */
        SitemapSubcategory: {
            /** Slug */
            slug: string;
        };
        /**
         * SlotDayOut
         * @description День в форме «Дата и время»: «Сегодня», «Завтра», «Пт» и окна способа.
         */
        SlotDayOut: {
            /**
             * Date
             * Format: date
             */
            date: string;
            /** Label */
            label: string;
            /** Available */
            available: boolean;
            /** Intervals */
            intervals: components["schemas"]["SlotIntervalOut"][];
        };
        /** SlotIntervalOut */
        SlotIntervalOut: {
            interval: components["schemas"]["DeliveryInterval"];
            /** Available */
            available: boolean;
        };
        /** SocialLink */
        SocialLink: {
            /** Label */
            label: string;
            /** Href */
            href: string;
        };
        /** SubCategoryAdminOut */
        SubCategoryAdminOut: {
            /** Id */
            id: number;
            /** Category Id */
            category_id: number;
            /** Name */
            name: string;
            /** Slug */
            slug: string;
            /** Order */
            order: number;
            /** Is Active */
            is_active: boolean;
            /** Applies Fillings */
            applies_fillings: boolean;
            /** Intro */
            intro?: string | null;
        };
        /** SubCategoryBreadcrumb */
        SubCategoryBreadcrumb: {
            /** Name */
            name: string;
            /** Slug */
            slug: string;
            /** Applies Fillings */
            applies_fillings: boolean;
        };
        /** SubCategoryIn */
        SubCategoryIn: {
            /** Category Id */
            category_id: number;
            /** Name */
            name: string;
            /** Slug */
            slug: string;
            /**
             * Order
             * @default 0
             */
            order: number;
            /**
             * Is Active
             * @default true
             */
            is_active: boolean;
            /**
             * Applies Fillings
             * @default false
             */
            applies_fillings: boolean;
            /** Intro */
            intro?: string | null;
        };
        /** SubCategoryOut */
        SubCategoryOut: {
            /** Id */
            id: number;
            /** Name */
            name: string;
            /** Slug */
            slug: string;
            /** Order */
            order: number;
            /** Applies Fillings */
            applies_fillings: boolean;
            /** Intro */
            intro?: string | null;
            /**
             * Product Count
             * @default 0
             */
            product_count: number;
        };
        /** SubCategoryRef */
        SubCategoryRef: {
            /** Name */
            name: string;
            /** Slug */
            slug: string;
        };
        /**
         * TastingSetOut
         * @description Плашка «Дегустационный сет» — обычный товар каталога в скрытом разделе.
         */
        TastingSetOut: {
            /** Product Id */
            product_id: number;
            /** Variant Id */
            variant_id: number;
            /** Slug */
            slug: string;
            /** Name */
            name: string;
            /** Description */
            description: string;
            /** Price */
            price: string;
        };
        /** TeamMember */
        TeamMember: {
            /** Name */
            name: string;
            /** Role */
            role: string;
            /** Image Key */
            image_key?: string | null;
            /** Placeholder */
            placeholder?: string | null;
        };
        /** TokenResponse */
        TokenResponse: {
            /** Access Token */
            access_token: string;
            /**
             * Token Type
             * @default bearer
             */
            token_type: string;
            /** Expires In */
            expires_in: number;
        };
        /** UpcomingDay */
        UpcomingDay: {
            /**
             * Day
             * Format: date
             */
            day: string;
            /** Count */
            count: number;
            /** Has Wedding */
            has_wedding: boolean;
            /** Has Large */
            has_large: boolean;
        };
        /** ValidationError */
        ValidationError: {
            /** Location */
            loc: (string | number)[];
            /** Message */
            msg: string;
            /** Error Type */
            type: string;
            /** Input */
            input?: unknown;
            /** Context */
            ctx?: Record<string, never>;
        };
        /** VariantAdminOut */
        VariantAdminOut: {
            /** Id */
            id: number;
            /** Label */
            label: string;
            /** Price */
            price: string;
            /** Weight Grams */
            weight_grams?: number | null;
            /** Portions Min */
            portions_min?: number | null;
            /** Portions Max */
            portions_max?: number | null;
            /** Size Note */
            size_note?: string | null;
            /**
             * Is Active
             * @default true
             */
            is_active: boolean;
            /**
             * In Orders
             * @default false
             */
            in_orders: boolean;
        };
        /**
         * VariantIn
         * @description Вариант товара в форме админки. `id` — у существующего варианта; без id —
         *     новый. Порядок вариантов — порядок в списке.
         */
        VariantIn: {
            /** Id */
            id?: number | null;
            /** Label */
            label: string;
            /** Price */
            price: number | string;
            /** Weight Grams */
            weight_grams?: number | null;
            /** Portions Min */
            portions_min?: number | null;
            /** Portions Max */
            portions_max?: number | null;
            /** Size Note */
            size_note?: string | null;
            /**
             * Is Active
             * @default true
             */
            is_active: boolean;
        };
        /**
         * VariantOut
         * @description Вариант на странице товара — с размером для строки «Вес и размер».
         */
        VariantOut: {
            /** Id */
            id: number;
            /** Label */
            label: string;
            /** Price */
            price: string;
            /** Weight Grams */
            weight_grams: number | null;
            /** Portions Min */
            portions_min: number | null;
            /** Portions Max */
            portions_max: number | null;
            /** Size Note */
            size_note: string | null;
        };
        /**
         * VariantShort
         * @description Вариант в карточке сетки: строку «1–2 кг · 8–10 порций» и «от 2 400 ₽»
         *     собирает фронтенд из этих полей. Только активные, по порядку; первый —
         *     вариант по умолчанию.
         */
        VariantShort: {
            /** Id */
            id: number;
            /** Label */
            label: string;
            /** Price */
            price: string;
            /** Weight Grams */
            weight_grams: number | null;
            /** Portions Min */
            portions_min: number | null;
            /** Portions Max */
            portions_max: number | null;
        };
        /** VideoUploadOut */
        VideoUploadOut: {
            /** Storage Key */
            storage_key: string;
            /** Poster Key */
            poster_key: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    health_api_v1_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: string;
                    };
                };
            };
        };
    };
    list_categories_api_v1_catalog_categories_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CategoryOut"][];
                };
            };
        };
    };
    get_filters_api_v1_catalog_filters_get: {
        parameters: {
            query?: {
                category?: string | null;
                subcategory?: string | null;
                search?: string | null;
                is_featured?: boolean | null;
                availability?: components["schemas"]["Availability"] | null;
                dietary?: components["schemas"]["DietaryTag"][];
                recipient?: components["schemas"]["Recipient"][];
                occasion?: components["schemas"]["Occasion"][];
                portions?: components["schemas"]["PortionsRange"][];
                price_min?: number | string | null;
                price_max?: number | string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CatalogFilters"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_products_api_v1_catalog_products_get: {
        parameters: {
            query?: {
                sort?: ("today_first" | "price_asc" | "price_desc" | "new") | null;
                page?: number;
                page_size?: number;
                category?: string | null;
                subcategory?: string | null;
                search?: string | null;
                is_featured?: boolean | null;
                availability?: components["schemas"]["Availability"] | null;
                dietary?: components["schemas"]["DietaryTag"][];
                recipient?: components["schemas"]["Recipient"][];
                occasion?: components["schemas"]["Occasion"][];
                portions?: components["schemas"]["PortionsRange"][];
                price_min?: number | string | null;
                price_max?: number | string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page_ProductListItem_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_product_api_v1_catalog_products__slug__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                slug: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductDetail"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_sitemap_api_v1_catalog_sitemap_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CatalogSitemap"];
                };
            };
        };
    };
    resolve_legacy_api_v1_legacy_resolve_get: {
        parameters: {
            query: {
                kind: components["schemas"]["LegacyKind"];
                key: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LegacyTarget"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_custom_cakes_api_v1_custom_cakes_get: {
        parameters: {
            query?: {
                occasion?: components["schemas"]["GalleryOccasion"] | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomCakeListOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    custom_cakes_info_api_v1_custom_cakes_info_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomCakesInfoOut"];
                };
            };
        };
    };
    list_fillings_api_v1_custom_cakes_fillings_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FillingCardOut"][];
                };
            };
        };
    };
    estimate_cake_api_v1_custom_cakes_estimate_get: {
        parameters: {
            query: {
                guests: number;
                design?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EstimateOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_custom_cake_api_v1_custom_cakes__slug__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                slug: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomCakeDetailOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_consultation_api_v1_consultations_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["ConsultationForm"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsultationAccepted"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_gallery_api_v1_gallery_get: {
        parameters: {
            query?: {
                occasion?: components["schemas"]["GalleryOccasion"] | null;
                page?: number;
                page_size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page_GalleryItemOut_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    gallery_occasions_api_v1_gallery_occasions_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GalleryFacet"][];
                };
            };
        };
    };
    get_gallery_item_api_v1_gallery__item_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                item_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GalleryWorkOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    login_photos_api_v1_content_login_photos_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LoginPhotoOut"][];
                };
            };
        };
    };
    list_reviews_api_v1_reviews_get: {
        parameters: {
            query?: {
                /** @description slug товара */
                product?: string | null;
                /** @description откуда отзыв */
                source?: components["schemas"]["ReviewSource"] | null;
                page?: number;
                page_size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page_ReviewOut_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_home_page_api_v1_pages_home_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HomePageOut"];
                };
            };
        };
    };
    get_contacts_page_api_v1_pages_contacts_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContactsPageOut"];
                };
            };
        };
    };
    get_about_page_api_v1_pages_about_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AboutPageOut"];
                };
            };
        };
    };
    get_custom_cakes_content_api_v1_pages_custom_cakes_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomCakesContentPageOut"];
                };
            };
        };
    };
    get_gallery_page_api_v1_pages_gallery_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GalleryPageOut"];
                };
            };
        };
    };
    get_legal_page_api_v1_pages_legal_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LegalPageOut"];
                };
            };
        };
    };
    get_page_content_api_v1_pages__page_key__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                page_key: components["schemas"]["PageKey"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PageContentOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_feedback_api_v1_contacts_feedback_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["FeedbackCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RequestAccepted"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_cart_api_v1_cart_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: {
                cart_id?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CartOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    clear_cart_api_v1_cart_delete: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: {
                cart_id?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CartOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_upsell_api_v1_cart_upsell_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: {
                cart_id?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductListItem"][];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    add_cart_item_api_v1_cart_items_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: {
                cart_id?: string | null;
            };
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CartItemIn"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CartOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_cart_item_api_v1_cart_items__item_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                item_id: number;
            };
            cookie?: {
                cart_id?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CartOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_cart_item_api_v1_cart_items__item_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                item_id: number;
            };
            cookie?: {
                cart_id?: string | null;
            };
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CartItemQuantityIn"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CartOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_order_api_v1_orders_post: {
        parameters: {
            query?: never;
            header?: {
                /** @description Один ключ на попытку оформления: повтор вернёт тот же заказ */
                "Idempotency-Key"?: string | null;
            };
            path?: never;
            cookie?: {
                cart_id?: string | null;
            };
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OrderCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderCreated"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_order_api_v1_orders__order_number__get: {
        parameters: {
            query?: {
                /** @description Токен из ссылки */
                t?: string | null;
            };
            header?: never;
            path: {
                order_number: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderConfirmationOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    login_api_v1_auth_login_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LoginRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TokenResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description Вход временно заблокирован: `detail`, `retry_after` */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    refresh_tokens_api_v1_auth_refresh_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: {
                refresh_token?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TokenResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    logout_api_v1_auth_logout_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: {
                refresh_token?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    me_api_v1_auth_me_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminOut"];
                };
            };
        };
    };
    update_me_api_v1_auth_me_patch: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProfileUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    change_password_api_v1_auth_change_password_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PasswordChange"];
            };
        };
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_sessions_api_v1_auth_sessions_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SessionOut"][];
                };
            };
        };
    };
    revoke_session_api_v1_auth_sessions__session_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                session_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    revoke_other_sessions_api_v1_auth_sessions_revoke_others_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    list_products_api_v1_admin_products_get: {
        parameters: {
            query?: {
                search?: string | null;
                category_id?: number | null;
                subcategory_id?: number | null;
                availability?: ("today" | "preorder" | "out") | null;
                is_active?: boolean | null;
                page?: number;
                page_size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page_ProductAdminListItem_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_product_api_v1_admin_products_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProductIn"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductAdminOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    bulk_update_products_api_v1_admin_products_bulk_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProductBulkAction"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductBulkResult"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    reorder_categories_api_v1_admin_categories_order_put: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OrderIds"];
            };
        };
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    reorder_subcategories_api_v1_admin_categories__category_id__subcategories_order_put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                category_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OrderIds"];
            };
        };
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    reorder_gallery_api_v1_admin_gallery_order_put: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OrderIds"];
            };
        };
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    reorder_fillings_api_v1_admin_fillings_order_put: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OrderIds"];
            };
        };
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    reorder_custom_cakes_api_v1_admin_custom_cakes_order_put: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OrderIds"];
            };
        };
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_consultations_api_v1_admin_consultations_get: {
        parameters: {
            query?: {
                tab?: "all" | "new" | "work" | "closed";
                occasion?: components["schemas"]["RequestOccasion"] | null;
                source?: components["schemas"]["ConsultationSource"] | null;
                period?: ("today" | "tomorrow" | "week") | null;
                date_from?: string | null;
                date_to?: string | null;
                page?: number;
                page_size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsultationListPage"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_consultation_api_v1_admin_consultations__request_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                request_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsultationAdminOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_consultation_api_v1_admin_consultations__request_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                request_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ConsultationStatusUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConsultationAdminOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_reviews_api_v1_admin_reviews_get: {
        parameters: {
            query?: {
                tab?: "pending" | "published" | "all";
                product_id?: number | null;
                source?: components["schemas"]["ReviewSource"] | null;
                page?: number;
                page_size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReviewListPage"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_review_api_v1_admin_reviews_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReviewIn"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReviewAdminOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    dashboard_api_v1_admin_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DashboardStats"];
                };
            };
        };
    };
    list_categories_api_v1_admin_categories_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CategoryAdminOut"][];
                };
            };
        };
    };
    create_category_api_v1_admin_categories_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CategoryIn"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CategoryAdminOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_category_api_v1_admin_categories__item_id__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                item_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CategoryIn"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CategoryAdminOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_category_api_v1_admin_categories__item_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                item_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_subcategories_api_v1_admin_subcategories_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SubCategoryAdminOut"][];
                };
            };
        };
    };
    create_subcategory_api_v1_admin_subcategories_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SubCategoryIn"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SubCategoryAdminOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_subcategory_api_v1_admin_subcategories__item_id__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                item_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SubCategoryIn"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SubCategoryAdminOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_subcategory_api_v1_admin_subcategories__item_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                item_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_product_admin_api_v1_admin_products__item_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                item_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductAdminOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_product_api_v1_admin_products__item_id__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                item_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProductIn"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductAdminOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_product_api_v1_admin_products__item_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                item_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_product_images_api_v1_admin_products__product_id__images_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                product_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductImageOut"][];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    upload_product_image_api_v1_admin_products__product_id__images_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                product_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_upload_product_image_api_v1_admin_products__product_id__images_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductImageOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    reorder_product_images_api_v1_admin_products__product_id__images_order_put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                product_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProductImagesOrder"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductImageOut"][];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_product_image_api_v1_admin_products__product_id__images__image_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                product_id: number;
                image_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    set_main_product_image_api_v1_admin_products__product_id__images__image_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                product_id: number;
                image_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductImageOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    set_product_image_role_api_v1_admin_products__product_id__images__image_id__role_put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                product_id: number;
                image_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProductImageRoleIn"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductImageOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    upload_media_api_v1_admin_uploads_post: {
        parameters: {
            query?: {
                prefix?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_upload_media_api_v1_admin_uploads_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: string;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    upload_hero_video_api_v1_admin_uploads_video_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_upload_hero_video_api_v1_admin_uploads_video_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VideoUploadOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_custom_cakes_api_v1_admin_custom_cakes_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomCakeAdminOut"][];
                };
            };
        };
    };
    create_custom_cake_api_v1_admin_custom_cakes_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CustomCakeIn"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomCakeAdminOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_custom_cake_api_v1_admin_custom_cakes__item_id__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                item_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CustomCakeIn"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomCakeAdminOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_custom_cake_api_v1_admin_custom_cakes__item_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                item_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_fillings_api_v1_admin_fillings_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FillingAdminOut"][];
                };
            };
        };
    };
    create_filling_api_v1_admin_fillings_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["FillingIn"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FillingAdminOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_filling_api_v1_admin_fillings__item_id__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                item_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["FillingIn"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FillingAdminOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_filling_api_v1_admin_fillings__item_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                item_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_gallery_admin_api_v1_admin_gallery_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GalleryItemAdminOut"][];
                };
            };
        };
    };
    create_gallery_item_api_v1_admin_gallery_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["GalleryItemIn"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GalleryItemAdminOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_gallery_item_api_v1_admin_gallery__item_id__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                item_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["GalleryItemIn"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GalleryItemAdminOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_gallery_item_api_v1_admin_gallery__item_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                item_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_review_api_v1_admin_reviews__review_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                review_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_review_api_v1_admin_reviews__review_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                review_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReviewUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReviewAdminOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_page_admin_api_v1_admin_pages__page_key__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                page_key: components["schemas"]["PageKey"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PageContentOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_page_api_v1_admin_pages__page_key__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                page_key: components["schemas"]["PageKey"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PageContentIn"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PageContentOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_orders_api_v1_admin_orders_get: {
        parameters: {
            query?: {
                /** @description Вкладка статусов */
                tab?: "all" | "new" | "work" | "ready" | "done";
                page?: number;
                page_size?: number;
                /** @description Дата получения: сегодня, завтра или 7 дней от сегодня */
                period?: ("today" | "tomorrow" | "week") | null;
                /** @description Свой диапазон: с даты */
                date_from?: string | null;
                /** @description Свой диапазон: по дату */
                date_to?: string | null;
                /** @description Способ получения */
                method?: components["schemas"]["DeliveryMethod"] | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderListPage"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    export_orders_api_v1_admin_orders_export_csv_get: {
        parameters: {
            query?: {
                /** @description Вкладка статусов */
                tab?: "all" | "new" | "work" | "ready" | "done";
                /** @description Дата получения: сегодня, завтра или 7 дней от сегодня */
                period?: ("today" | "tomorrow" | "week") | null;
                /** @description Свой диапазон: с даты */
                date_from?: string | null;
                /** @description Свой диапазон: по дату */
                date_to?: string | null;
                /** @description Способ получения */
                method?: components["schemas"]["DeliveryMethod"] | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_order_admin_api_v1_admin_orders__order_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                order_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderAdminDetail"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_order_status_api_v1_admin_orders__order_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                order_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OrderStatusUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderAdminListItem"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_consultation_image_api_v1_admin_consultations__request_id__images__image_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                request_id: number;
                image_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "image/webp": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_users_api_v1_admin_users_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminOut"][];
                };
            };
        };
    };
    create_user_api_v1_admin_users_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AdminCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_user_api_v1_admin_users__user_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_user_api_v1_admin_users__user_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AdminUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_backups_api_v1_admin_backups_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BackupOut"][];
                };
            };
        };
    };
    create_backup_api_v1_admin_backups_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BackupOut"];
                };
            };
        };
    };
    restore_backup_api_v1_admin_backups__backup_id__restore_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                backup_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BackupRestoreRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_backup_api_v1_admin_backups__backup_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                backup_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    purge_personal_data_api_v1_admin_retention_purge_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    get_dashboard_api_v1_admin_dashboard_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Dashboard"];
                };
            };
        };
    };
    get_calendar_api_v1_admin_dashboard_calendar_get: {
        parameters: {
            query?: {
                /** @description ГГГГ-ММ */
                month?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Calendar"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    week_report_api_v1_admin_dashboard_report_csv_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    popular_report_api_v1_admin_dashboard_popular_csv_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    get_clock_api_v1_admin_clock_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessClock"];
                };
            };
        };
    };
    get_counters_api_v1_admin_counters_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Counters"];
                };
            };
        };
    };
    search_api_v1_admin_search_get: {
        parameters: {
            query: {
                q: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SearchResults"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_journal_api_v1_admin_journal_get: {
        parameters: {
            query?: {
                tab?: "actions" | "security";
                /** @description id сотрудника или «site» — события сайта */
                actor?: string | null;
                /** @description тип события (только для вкладки «Действия») */
                kind?: ("catalog" | "orders" | "requests" | "reviews" | "pages" | "staff" | "system") | null;
                page?: number;
                page_size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page_ActivityItem_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_settings_page_api_v1_admin_settings_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BakerySettings"];
                };
            };
        };
    };
    update_settings_api_v1_admin_settings_put: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BakerySettings"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BakerySettings"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
}
