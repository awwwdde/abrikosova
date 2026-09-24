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
         * @description Дерево активных категорий с подкатегориями — для меню и сайдбара каталога.
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
         * @description Справочник сквозных фильтров с подписями и границы цены.
         *
         *     Подписи отдаёт бэкенд, чтобы сайт и админка не держали каждый свою копию.
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
         *     Повод и порции объединяются через ИЛИ, ограничения в питании — через И.
         *     В старом коде список жёстко обрезался 12 позициями без возможности увидеть
         *     остальные (ANALYSIS.md, п. 2.1.8) — здесь именно постраничная выдача.
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
    "/api/v1/custom-cakes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Custom Cakes Page */
        get: operations["get_custom_cakes_page_api_v1_custom_cakes_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/custom-cakes/consultation": {
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
         * @description Заявка на торт под событие. multipart/form-data: поля формы + необязательное фото.
         *
         *     Порядок важен: сначала FastAPI валидирует поля (согласие, телефон, даты),
         *     и только потом файл уходит в хранилище — чтобы заведомо отклонённая заявка
         *     не оставляла после себя загруженных картинок.
         */
        post: operations["create_consultation_api_v1_custom_cakes_consultation_post"];
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
         *     Без `product` — все отзывы (блок на главной), с `product` — отзывы о позиции
         *     (продолжение блока 06 карточки товара, где первые отзывы приходят сразу).
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
    "/api/v1/cart/items": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Add Cart Item */
        post: operations["add_cart_item_api_v1_cart_items_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cart/items/{product_id}": {
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
        delete: operations["delete_cart_item_api_v1_cart_items__product_id__delete"];
        options?: never;
        head?: never;
        /** Update Cart Item */
        patch: operations["update_cart_item_api_v1_cart_items__product_id__patch"];
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
         * @description Публично по номеру заказа — номер содержит случайную часть, перебором не подобрать.
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
         * @description Выход: refresh-токен отзывается на сервере, а не только удаляется у клиента.
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
        /** Dashboard */
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
    "/api/v1/admin/products": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Products Admin */
        get: operations["list_products_admin_api_v1_admin_products_get"];
        put?: never;
        /** Create Product */
        post: operations["create_product_api_v1_admin_products_post"];
        delete?: never;
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
         *     внутри бакета.
         */
        post: operations["upload_media_api_v1_admin_uploads_post"];
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
    "/api/v1/admin/reviews": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Reviews Admin
         * @description Все отзывы, включая неопубликованные. Можно сузить до одного товара.
         */
        get: operations["list_reviews_admin_api_v1_admin_reviews_get"];
        put?: never;
        /** Create Review */
        post: operations["create_review_api_v1_admin_reviews_post"];
        delete?: never;
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
        /** List Orders */
        get: operations["list_orders_api_v1_admin_orders_get"];
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
        /** Get Order Admin */
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
    "/api/v1/admin/consultations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Consultations */
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
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Update Consultation */
        patch: operations["update_consultation_api_v1_admin_consultations__request_id__patch"];
        trace?: never;
    };
    "/api/v1/admin/consultations/{request_id}/reference": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Consultation Reference
         * @description Фото-референс из заявки. Отдаётся только через админку, не по публичной ссылке.
         *
         *     Просмотр пишется в журнал: это персональные данные клиента, и по 152-ФЗ
         *     оператор должен понимать, кто и когда к ним обращался.
         */
        get: operations["get_consultation_reference_api_v1_admin_consultations__request_id__reference_get"];
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
        /** List Backups */
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
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** AdminCreate */
        AdminCreate: {
            /**
             * Email
             * Format: email
             */
            email: string;
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
            role?: components["schemas"]["AdminRole"] | null;
            /** Is Active */
            is_active?: boolean | null;
        };
        /**
         * Availability
         * @description Фильтр «Срок»: забрать сегодня или готовится под заказ.
         * @enum {string}
         */
        Availability: "today" | "preorder";
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
        /** CartItemIn */
        CartItemIn: {
            /** Product Id */
            product_id: number;
            /**
             * Quantity
             * @default 1
             */
            quantity: number;
        };
        /** CartItemOut */
        CartItemOut: {
            /** Product Id */
            product_id: number;
            /** Name */
            name: string;
            /** Slug */
            slug: string;
            /** Price */
            price: string;
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
        /** CartItemQuantityIn */
        CartItemQuantityIn: {
            /** Quantity */
            quantity: number;
        };
        /** CartOut */
        CartOut: {
            /** Items */
            items: components["schemas"]["CartItemOut"][];
            /** Total Items */
            total_items: number;
            /** Total Price */
            total_price: string;
            /**
             * Earliest Date
             * Format: date
             */
            earliest_date: string;
        };
        /**
         * CatalogFilters
         * @description Всё, что нужно фронтенду, чтобы нарисовать панель фильтров:
         *     допустимые значения, их подписи и границы цены по текущей выборке.
         */
        CatalogFilters: {
            /** Occasions */
            occasions: components["schemas"]["FilterOption_Occasion_"][];
            /** Dietary */
            dietary: components["schemas"]["FilterOption_DietaryTag_"][];
            /** Portions */
            portions: components["schemas"]["FilterOption_PortionsRange_"][];
            /** Availability */
            availability: components["schemas"]["FilterOption_Availability_"][];
            price: components["schemas"]["PriceRange"];
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
            /**
             * Subcategories
             * @default []
             */
            subcategories: components["schemas"]["SubCategoryOut"][];
        };
        /** ConsultationAdminOut */
        ConsultationAdminOut: {
            /** Id */
            id: number;
            /** Name */
            name: string;
            /** Phone */
            phone: string;
            /** Description */
            description: string | null;
            occasion: components["schemas"]["Occasion"] | null;
            /** Event Date */
            event_date: string | null;
            /** Guests Count */
            guests_count: number | null;
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
        /**
         * ConsultationForm
         * @description Та же заявка в виде multipart-формы — с необязательным файлом.
         *
         *     Файл объявлен внутри модели, а не отдельным параметром эндпоинта:
         *     FastAPI разворачивает форму-модель в плоские поля только тогда, когда
         *     она единственный параметр тела запроса.
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
            /** Description */
            description?: string | null;
            occasion?: components["schemas"]["Occasion"] | null;
            /** Event Date */
            event_date?: string | null;
            /** Guests Count */
            guests_count?: number | null;
            /** Reference */
            reference?: string | null;
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
        /** CustomCakeAdminOut */
        CustomCakeAdminOut: {
            /** Title */
            title: string;
            /** Description */
            description: string;
            /** Price From */
            price_from: string;
            /** Image Key */
            image_key: string;
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
        };
        /** CustomCakeIn */
        CustomCakeIn: {
            /** Title */
            title: string;
            /** Description */
            description: string;
            /** Price From */
            price_from: number | string;
            /** Image Key */
            image_key: string;
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
        /** CustomCakeOut */
        CustomCakeOut: {
            /** Id */
            id: number;
            /** Title */
            title: string;
            /** Description */
            description: string;
            /** Price From */
            price_from: string;
            /** Image Key */
            image_key: string;
        };
        /** CustomCakesPageOut */
        CustomCakesPageOut: {
            /** Cakes */
            cakes: components["schemas"]["CustomCakeOut"][];
            /** Fillings */
            fillings: components["schemas"]["FillingOut"][];
            page: components["schemas"]["PageContentOut"] | null;
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
        /** FillingIn */
        FillingIn: {
            /** Name */
            name: string;
            /** Description */
            description: string;
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
        };
        /** FilterOption[DietaryTag] */
        FilterOption_DietaryTag_: {
            value: components["schemas"]["DietaryTag"];
            /** Label */
            label: string;
        };
        /** FilterOption[Occasion] */
        FilterOption_Occasion_: {
            value: components["schemas"]["Occasion"];
            /** Label */
            label: string;
        };
        /** FilterOption[PortionsRange] */
        FilterOption_PortionsRange_: {
            value: components["schemas"]["PortionsRange"];
            /** Label */
            label: string;
        };
        /** GalleryItemAdminOut */
        GalleryItemAdminOut: {
            /** Image Key */
            image_key: string;
            /** Caption */
            caption: string;
            /** Description */
            description?: string | null;
            occasion?: components["schemas"]["Occasion"] | null;
            /** Tiers */
            tiers?: number | null;
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
            /** Caption */
            caption: string;
            /** Description */
            description?: string | null;
            occasion?: components["schemas"]["Occasion"] | null;
            /** Tiers */
            tiers?: number | null;
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
            /** Caption */
            caption: string;
            /** Description */
            description: string | null;
            occasion: components["schemas"]["Occasion"] | null;
            /** Tiers */
            tiers: number | null;
            /** Guests */
            guests: number | null;
            /** Made In */
            made_in: string | null;
        };
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail?: components["schemas"]["ValidationError"][];
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
        Occasion: "birthday" | "kids" | "wedding" | "corporate" | "tea";
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
            /** Customer Comment */
            customer_comment?: string | null;
            delivery_method: components["schemas"]["DeliveryMethod"];
            /** Delivery Address */
            delivery_address?: string | null;
            /** Desired Date */
            desired_date?: string | null;
            delivery_interval?: components["schemas"]["DeliveryInterval"] | null;
        };
        /** OrderCreated */
        OrderCreated: {
            /** Order Number */
            order_number: string;
        };
        /** OrderItemOut */
        OrderItemOut: {
            /** Product Id */
            product_id: number;
            /** Name */
            name: string;
            /** Quantity */
            quantity: number;
            /** Price */
            price: string;
            /** Line Total */
            line_total: string;
        };
        /** OrderOut */
        OrderOut: {
            /** Order Number */
            order_number: string;
            /** Customer Name */
            customer_name: string;
            /** Customer Phone */
            customer_phone: string;
            /** Customer Comment */
            customer_comment: string | null;
            delivery_method: components["schemas"]["DeliveryMethod"];
            /** Delivery Address */
            delivery_address: string | null;
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
            /** Items */
            items: components["schemas"]["OrderItemOut"][];
        };
        /**
         * OrderStatus
         * @enum {string}
         */
        OrderStatus: "new" | "confirmed" | "in_progress" | "ready" | "completed" | "cancelled";
        /** OrderStatusUpdate */
        OrderStatusUpdate: {
            status: components["schemas"]["OrderStatus"];
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
        PageKey: "home" | "about" | "custom_cakes" | "contacts";
        /** Page[ConsultationAdminOut] */
        Page_ConsultationAdminOut_: {
            /** Items */
            items: components["schemas"]["ConsultationAdminOut"][];
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
        /** Page[OrderAdminListItem] */
        Page_OrderAdminListItem_: {
            /** Items */
            items: components["schemas"]["OrderAdminListItem"][];
            /** Total */
            total: number;
            /** Page */
            page: number;
            /** Page Size */
            page_size: number;
        };
        /** Page[ProductAdminOut] */
        Page_ProductAdminOut_: {
            /** Items */
            items: components["schemas"]["ProductAdminOut"][];
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
            /** Price */
            price: string;
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
            /** Weight Grams */
            weight_grams: number;
            /** Portions Min */
            portions_min?: number | null;
            /** Portions Max */
            portions_max?: number | null;
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
            /**
             * Lead Time Days
             * @default 0
             */
            lead_time_days: number;
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
             * Is Featured
             * @default false
             */
            is_featured: boolean;
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
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /**
         * ProductDetail
         * @description Карточка товара. Порядок полей повторяет порядок блоков на странице:
         *     галерея → цена и размер → состав и метки → хранение → отзывы и похожие.
         */
        ProductDetail: {
            /** Id */
            id: number;
            /** Name */
            name: string;
            /** Slug */
            slug: string;
            /** Price */
            price: string;
            /** Is Available */
            is_available: boolean;
            /** Weight Grams */
            weight_grams: number;
            /** Portions Min */
            portions_min: number | null;
            /** Portions Max */
            portions_max: number | null;
            /** Lead Time Days */
            lead_time_days: number;
            /** Description */
            description: string;
            /** Composition */
            composition: string;
            nutrition: components["schemas"]["Nutrition"] | null;
            /** Tags */
            tags: components["schemas"]["ProductTag"][];
            /** Dietary */
            dietary: components["schemas"]["DietaryTag"][];
            /** Occasions */
            occasions: components["schemas"]["Occasion"][];
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
            /** Price */
            price: number | string;
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
            /** Weight Grams */
            weight_grams: number;
            /** Portions Min */
            portions_min?: number | null;
            /** Portions Max */
            portions_max?: number | null;
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
            /**
             * Lead Time Days
             * @default 0
             */
            lead_time_days: number;
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
             * Is Featured
             * @default false
             */
            is_featured: boolean;
            /**
             * Order
             * @default 0
             */
            order: number;
        };
        /**
         * ProductListItem
         * @description Карточка товара в сетке каталога.
         *
         *     Кроме названия и цены несёт ответ на «первый вопрос про размер» — вес
         *     и порции, а также состав строкой и метки ограничений: по макету карточки
         *     они видны ещё до перехода на страницу товара (PDF «Этап 1», раздел 14).
         */
        ProductListItem: {
            /** Id */
            id: number;
            /** Name */
            name: string;
            /** Slug */
            slug: string;
            /** Price */
            price: string;
            /** Is Available */
            is_available: boolean;
            /** Tags */
            tags: components["schemas"]["ProductTag"][];
            /** Dietary */
            dietary: components["schemas"]["DietaryTag"][];
            /** Occasions */
            occasions: components["schemas"]["Occasion"][];
            /** Composition */
            composition: string;
            /** Weight Grams */
            weight_grams: number;
            /** Portions Min */
            portions_min: number | null;
            /** Portions Max */
            portions_max: number | null;
            /** Lead Time Days */
            lead_time_days: number;
            /** Main Image */
            main_image?: string | null;
        };
        /**
         * ProductTag
         * @enum {string}
         */
        ProductTag: "new" | "hit" | "season";
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
         * @enum {string}
         */
        ReviewSource: "site_form" | "manual";
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
                category?: string | null;
                subcategory?: string | null;
                search?: string | null;
                sort?: ("price_asc" | "price_desc" | "name" | "new") | null;
                is_featured?: boolean | null;
                occasion?: components["schemas"]["Occasion"][];
                dietary?: components["schemas"]["DietaryTag"][];
                portions?: components["schemas"]["PortionsRange"][];
                availability?: components["schemas"]["Availability"] | null;
                price_min?: number | string | null;
                price_max?: number | string | null;
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
    get_custom_cakes_page_api_v1_custom_cakes_get: {
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
                    "application/json": components["schemas"]["CustomCakesPageOut"];
                };
            };
        };
    };
    create_consultation_api_v1_custom_cakes_consultation_post: {
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
    list_gallery_api_v1_gallery_get: {
        parameters: {
            query?: {
                occasion?: components["schemas"]["Occasion"] | null;
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
    list_reviews_api_v1_reviews_get: {
        parameters: {
            query?: {
                /** @description slug товара */
                product?: string | null;
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
    delete_cart_item_api_v1_cart_items__product_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                product_id: number;
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
    update_cart_item_api_v1_cart_items__product_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                product_id: number;
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
            header?: never;
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
            query?: never;
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
                    "application/json": components["schemas"]["OrderOut"];
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
    list_products_admin_api_v1_admin_products_get: {
        parameters: {
            query?: {
                search?: string | null;
                category_id?: number | null;
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
                    "application/json": components["schemas"]["Page_ProductAdminOut_"];
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
    list_reviews_admin_api_v1_admin_reviews_get: {
        parameters: {
            query?: {
                product_id?: number | null;
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
                    "application/json": components["schemas"]["ReviewAdminOut"][];
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
                status?: components["schemas"]["OrderStatus"] | null;
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
                    "application/json": components["schemas"]["Page_OrderAdminListItem_"];
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
                    "application/json": components["schemas"]["OrderOut"];
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
    list_consultations_api_v1_admin_consultations_get: {
        parameters: {
            query?: {
                source?: components["schemas"]["ConsultationSource"] | null;
                status?: components["schemas"]["ConsultationStatus"] | null;
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
                    "application/json": components["schemas"]["Page_ConsultationAdminOut_"];
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
    get_consultation_reference_api_v1_admin_consultations__request_id__reference_get: {
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
}
