"""Admin API (02-api-contract.md, раздел Admin API).

Префикс отдельный от публичного API, чтобы права доступа и rate-limit
настраивались независимо. Роль проверяется на бэкенде на каждом эндпоинте,
а не только скрытием пунктов меню в UI.
"""

import logging
from datetime import date, timedelta
from typing import Annotated, Any
from urllib.parse import quote

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.clock import local_today
from app.core.db import get_session
from app.core.deps import CurrentAdmin, OwnerOnly
from app.core.password_policy import (
    PasswordPolicyError,
    as_validation_error,
    validate_password,
)
from app.core.security import hash_password
from app.models import (
    AdminUser,
    AuditLogEntry,
    BackupType,
    Category,
    ConsultationRequest,
    ConsultationStatus,
    CustomCake,
    CustomCakeImage,
    DeliveryMethod,
    Filling,
    GalleryItem,
    Order,
    OrderItem,
    OrderStatus,
    PageContent,
    PageKey,
    Product,
    ProductImage,
    ProductVariant,
    Review,
    SubCategory,
)
from app.routers.admin_lists import review_moment
from app.schemas.admin import (
    MAX_PRODUCT_IMAGES,
    RESTORE_CONFIRMATION,
    BackupOut,
    BackupRestoreRequest,
    CategoryAdminOut,
    CategoryIn,
    CustomCakeAdminOut,
    CustomCakeImageIn,
    CustomCakeIn,
    DashboardStats,
    FillingAdminOut,
    FillingIn,
    GalleryItemAdminOut,
    GalleryItemIn,
    OrderAdminDetail,
    OrderAdminItem,
    OrderAdminListItem,
    OrderListPage,
    OrderStatusUpdate,
    PageContentIn,
    ProductAdminOut,
    ProductImageOut,
    ProductImageRoleIn,
    ProductImagesOrder,
    ProductIn,
    ReviewAdminOut,
    ReviewIn,
    ReviewUpdate,
    SubCategoryAdminOut,
    SubCategoryIn,
    VariantIn,
    VideoUploadOut,
)
from app.schemas.auth import AdminCreate, AdminOut, AdminUpdate
from app.schemas.pages import PAGE_CONTENT_SCHEMAS, check_links
from app.schemas.settings import BakerySettings
from app.schemas.shop import PageContentOut
from app.services import (
    admin_orders,
    audit,
    backups,
    bakery_settings,
    retention,
    revalidate,
    sessions,
    storage,
)
from app.services import catalog as catalog_service
from app.services import custom_cakes as cake_service
from app.services import dashboard as dashboard_service
from app.services import orders as order_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


def _drop_cache(background: BackgroundTasks, product_slug: str | None = None) -> None:
    """Ставит сброс кэша публичных страниц в фон — ответ админке его не ждёт."""
    background.add_task(revalidate.revalidate_paths, revalidate.catalog_paths(product_slug))


def _drop_paths(background: BackgroundTasks, *paths: str) -> None:
    """То же для разделов вне каталога: галерея, отзывы, торты на заказ."""
    background.add_task(revalidate.revalidate_paths, list(paths))


async def _check_product_refs(session: AsyncSession, data: ProductIn) -> None:
    """Подкатегория должна принадлежать выбранной категории.

    Две независимые ссылки в товаре (category_id и subcategory_id) позволяют
    сохранить «Торты › Печенье» — товар тогда пропадёт из обоих разделов
    каталога и из хлебных крошек. База этого не ловит, поэтому проверяем здесь.
    """
    subcategory = await session.get(SubCategory, data.subcategory_id)
    if subcategory is None or subcategory.category_id != data.category_id:
        raise HTTPException(
            status_code=422,
            detail="Подкатегория не относится к выбранной категории",
        )


async def _product_slug(session: AsyncSession, product_id: int | None) -> str | None:
    """Slug товара для сброса кэша его страницы; заодно проверяет, что товар есть."""
    if product_id is None:
        return None
    slug = await session.scalar(select(Product.slug).where(Product.id == product_id))
    if slug is None:
        raise HTTPException(status_code=422, detail="Товар для отзыва не найден")
    return slug


async def _delete_files(keys: list[str]) -> None:
    """Удаляет фото записи из хранилища. Заглушки сида (`placeholder/…`) файлов
    не имеют — их не трогаем. Ошибка хранилища не роняет запрос (см. storage)."""
    for key in keys:
        if not key.startswith("placeholder/"):
            await storage.delete_image(key)


async def _ensure_no_products(session: AsyncSession, condition: Any, where: str) -> None:
    """Удалить можно только пустой раздел (011e). Иначе товары остались бы без
    раздела — база этого не даст, и человек увидел бы безликую ошибку."""
    count = await session.scalar(select(func.count()).select_from(Product).where(condition)) or 0
    if count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"В {where} {count} {_goods(count)}. Перенесите их в другой раздел или "
                "удалите, потом удалите раздел"
            ),
        )


def _goods(count: int) -> str:
    if 11 <= count % 100 <= 14:
        return "товаров"
    if count % 10 == 1:
        return "товар"
    if 2 <= count % 10 <= 4:
        return "товара"
    return "товаров"


async def _get_or_404(session: AsyncSession, model: Any, item_id: int) -> Any:
    obj = await session.get(model, item_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Запись не найдена")
    return obj


# --- Дашборд ---


@router.get("", response_model=DashboardStats)
async def dashboard(admin: CurrentAdmin, session: SessionDep) -> DashboardStats:
    """Старая сводка — её читают как раньше; новая главная — `GET /admin/dashboard`.

    «Сегодня» — от полуночи по времени кондитерской, а не UTC (011b): в 01:00 по
    Москве в UTC ещё вчерашний вечер, и вчерашние заказы считались «сегодняшними».
    """
    local = local_today()
    today = dashboard_service.day_start(local)
    week = dashboard_service.day_start(local - timedelta(days=6))

    async def count(model: Any, *conditions: Any) -> int:
        query = select(func.count()).select_from(model)
        if conditions:
            query = query.where(*conditions)
        return await session.scalar(query) or 0

    return DashboardStats(
        orders_new=await count(Order, Order.status == OrderStatus.NEW),
        orders_today=await count(Order, Order.created_at >= today),
        orders_week=await count(Order, Order.created_at >= week),
        consultations_new=await count(
            ConsultationRequest, ConsultationRequest.status == ConsultationStatus.NEW
        ),
        consultations_week=await count(ConsultationRequest, ConsultationRequest.created_at >= week),
        products_total=await count(Product),
        reviews_unpublished=await count(Review, Review.is_published.is_(False)),
    )


# --- Категории и подкатегории ---


@router.get("/categories", response_model=list[CategoryAdminOut])
async def list_categories(admin: CurrentAdmin, session: SessionDep):
    query = (
        select(Category)
        .options(selectinload(Category.subcategories))
        .order_by(Category.order, Category.id)
    )
    return list((await session.scalars(query)).all())


@router.post("/categories", response_model=CategoryAdminOut, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: CategoryIn, admin: CurrentAdmin, session: SessionDep, request: Request
):
    category = Category(**data.model_dump())
    session.add(category)
    await session.flush()
    await audit.record(
        session, request, admin, action="create", entity="category", entity_id=category.id
    )
    await session.commit()
    await session.refresh(category, ["subcategories"])
    return category


@router.put("/categories/{item_id}", response_model=CategoryAdminOut)
async def update_category(
    item_id: int, data: CategoryIn, admin: CurrentAdmin, session: SessionDep, request: Request
):
    category = await _get_or_404(session, Category, item_id)
    # В журнал — только реально изменённые поля, цены и наличие — «было → стало» (011c)
    details = audit.apply_changes(category, data.model_dump())
    if details is not None:
        await audit.record(
            session,
            request,
            admin,
            action="update",
            entity="category",
            entity_id=item_id,
            details=details,
        )
    await session.commit()
    await session.refresh(category, ["subcategories"])
    return category


@router.delete("/categories/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    item_id: int, admin: CurrentAdmin, session: SessionDep, request: Request
) -> None:
    category = await _get_or_404(session, Category, item_id)
    await _ensure_no_products(session, Product.category_id == item_id, "разделе")
    await session.delete(category)
    await audit.record(
        session, request, admin, action="delete", entity="category", entity_id=item_id
    )
    await session.commit()


@router.get("/subcategories", response_model=list[SubCategoryAdminOut])
async def list_subcategories(admin: CurrentAdmin, session: SessionDep):
    query = select(SubCategory).order_by(SubCategory.category_id, SubCategory.order)
    return list((await session.scalars(query)).all())


@router.post(
    "/subcategories", response_model=SubCategoryAdminOut, status_code=status.HTTP_201_CREATED
)
async def create_subcategory(
    data: SubCategoryIn, admin: CurrentAdmin, session: SessionDep, request: Request
):
    subcategory = SubCategory(**data.model_dump())
    session.add(subcategory)
    await session.flush()
    await audit.record(
        session, request, admin, action="create", entity="subcategory", entity_id=subcategory.id
    )
    await session.commit()
    return subcategory


@router.put("/subcategories/{item_id}", response_model=SubCategoryAdminOut)
async def update_subcategory(
    item_id: int, data: SubCategoryIn, admin: CurrentAdmin, session: SessionDep, request: Request
):
    subcategory = await _get_or_404(session, SubCategory, item_id)
    # В журнал — только реально изменённые поля, цены и наличие — «было → стало» (011c)
    details = audit.apply_changes(subcategory, data.model_dump())
    if details is not None:
        await audit.record(
            session,
            request,
            admin,
            action="update",
            entity="subcategory",
            entity_id=item_id,
            details=details,
        )
    await session.commit()
    return subcategory


@router.delete("/subcategories/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subcategory(
    item_id: int, admin: CurrentAdmin, session: SessionDep, request: Request
) -> None:
    subcategory = await _get_or_404(session, SubCategory, item_id)
    await _ensure_no_products(session, Product.subcategory_id == item_id, "подразделе")
    await session.delete(subcategory)
    await audit.record(
        session, request, admin, action="delete", entity="subcategory", entity_id=item_id
    )
    await session.commit()


# --- Товары ---

# Поля варианта, которые журнал хранит «было → стало»; подпись и размер — только имя
VARIANT_SAFE_FIELDS = frozenset({"price", "is_active", "weight_grams", "label"})


async def _load_product(session: AsyncSession, product_id: int) -> Product:
    product = await session.get(
        Product, product_id, options=[selectinload(Product.variants)], populate_existing=True
    )
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Запись не найдена")
    return product


async def _variants_in_orders(session: AsyncSession, variant_ids: list[int]) -> set[int]:
    if not variant_ids:
        return set()
    rows = await session.scalars(
        select(OrderItem.variant_id).where(OrderItem.variant_id.in_(variant_ids)).distinct()
    )
    return set(rows.all())


async def product_out(session: AsyncSession, product: Product) -> ProductAdminOut:
    """Товар для админки: с вариантами и признаком «вариант есть в заказах» —
    у такого варианта форма прячет «удалить» и предлагает выключить."""
    out = ProductAdminOut.model_validate(product)
    in_orders = await _variants_in_orders(session, [v.id for v in out.variants])
    return out.model_copy(
        update={
            "variants": [
                v.model_copy(update={"in_orders": v.id in in_orders}) for v in out.variants
            ]
        }
    )


async def _sync_variants(
    session: AsyncSession, product: Product, data: list[VariantIn]
) -> list[dict[str, Any]]:
    """Приводит варианты товара к списку из формы и возвращает изменения для журнала.

    Вариант с id обновляется, без id — создаётся, пропавший из списка удаляется.
    Удалить вариант из заказов нельзя (RESTRICT): 409 с подсказкой выключить его.
    Порядок — порядок в списке: первый вариант показывает карточка.
    """
    existing = {variant.id: variant for variant in product.variants}
    unknown = [v.id for v in data if v.id is not None and v.id not in existing]
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Список вариантов изменился, обновите страницу",
        )

    kept = {v.id for v in data if v.id is not None}
    removed = [variant for variant_id, variant in existing.items() if variant_id not in kept]
    blocked = await _variants_in_orders(session, [variant.id for variant in removed])
    if blocked:
        labels = ", ".join(f"«{existing[i].label}»" for i in sorted(blocked))
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Вариант {labels} есть в заказах — его можно только выключить",
        )

    log: list[dict[str, Any]] = []
    for variant in removed:
        log.append({"label": variant.label, "action": "removed"})
        product.variants.remove(variant)

    variants: list[ProductVariant] = []
    for index, item in enumerate(data):
        values = item.model_dump(exclude={"id"})
        if item.id is None:
            variant = ProductVariant(**values)
            log.append({"label": variant.label, "action": "added"})
        else:
            variant = existing[item.id]
            old_label = variant.label
            details = audit.apply_changes(variant, values, safe=VARIANT_SAFE_FIELDS)
            if details is not None:
                log.append({"label": old_label, **details})
        # Порядок в журнал не пишем: перестановка вариантов — не событие для ленты
        variant.order = index
        variants.append(variant)
    product.variants = variants
    return log


@router.get("/products/{item_id}", response_model=ProductAdminOut)
async def get_product_admin(item_id: int, admin: CurrentAdmin, session: SessionDep):
    return await product_out(session, await _load_product(session, item_id))


@router.post("/products", response_model=ProductAdminOut, status_code=status.HTTP_201_CREATED)
async def create_product(
    data: ProductIn,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
    background: BackgroundTasks,
):
    await _check_product_refs(session, data)
    product = Product(**data.model_dump(exclude={"variants"}))
    product.variants = [
        ProductVariant(**item.model_dump(exclude={"id"}), order=index)
        for index, item in enumerate(data.variants)
    ]
    session.add(product)
    await session.flush()
    await audit.record(
        session, request, admin, action="create", entity="product", entity_id=product.id
    )
    await session.commit()
    _drop_cache(background, product.slug)
    return await product_out(session, await _load_product(session, product.id))


@router.put("/products/{item_id}", response_model=ProductAdminOut)
async def update_product(
    item_id: int,
    data: ProductIn,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
    background: BackgroundTasks,
):
    product = await _load_product(session, item_id)
    await _check_product_refs(session, data)
    old_slug = product.slug
    # В журнал — только реально изменённые поля, цены и наличие — «было → стало» (011c)
    details = audit.apply_changes(product, data.model_dump(exclude={"variants"})) or {}
    variant_log = await _sync_variants(session, product, data.variants)
    if variant_log:
        details["variants"] = variant_log
    if details:
        await audit.record(
            session,
            request,
            admin,
            action="update",
            entity="product",
            entity_id=item_id,
            details=details,
        )
    await session.commit()
    # updated_at проставляет БД (onupdate=now()), после коммита значение в объекте
    # помечено устаревшим — перечитываем товар вместе с вариантами, иначе
    # сериализация ответа полезет в базу синхронно и упадёт в async-сессии
    product = await _load_product(session, item_id)
    _drop_cache(background, product.slug)
    if old_slug != product.slug:
        # Старый адрес тоже закэширован — без сброса он продолжит отдавать товар
        _drop_cache(background, old_slug)
    return await product_out(session, product)


@router.delete("/products/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    item_id: int,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
    background: BackgroundTasks,
) -> None:
    product = await _get_or_404(session, Product, item_id)
    slug = product.slug
    await session.delete(product)
    await audit.record(
        session, request, admin, action="delete", entity="product", entity_id=item_id
    )
    await session.commit()
    _drop_cache(background, slug)


# --- Изображения товара ---


@router.get("/products/{product_id}/images", response_model=list[ProductImageOut])
async def list_product_images(product_id: int, admin: CurrentAdmin, session: SessionDep):
    await _get_or_404(session, Product, product_id)
    query = (
        select(ProductImage)
        .where(ProductImage.product_id == product_id)
        .order_by(ProductImage.order, ProductImage.id)
    )
    return list((await session.scalars(query)).all())


@router.post(
    "/products/{product_id}/images",
    response_model=ProductImageOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_product_image(
    product_id: int,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
    file: Annotated[UploadFile, File()],
):
    """Загружает фото товара. Лимит 6 штук — требование договора,
    в старом коде оно нигде не проверялось."""
    await _get_or_404(session, Product, product_id)

    count = (
        await session.scalar(
            select(func.count())
            .select_from(ProductImage)
            .where(ProductImage.product_id == product_id)
        )
        or 0
    )
    if count >= MAX_PRODUCT_IMAGES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"У товара уже {MAX_PRODUCT_IMAGES} фотографий — удалите лишние",
        )

    key = await storage.upload_image(file, prefix=f"products/{product_id}")

    image = ProductImage(
        product_id=product_id,
        storage_key=key,
        # Первое загруженное фото автоматически становится главным
        is_main=count == 0,
        order=count,
    )
    session.add(image)
    await session.flush()
    await audit.record(
        session, request, admin, action="upload_image", entity="product", entity_id=product_id
    )
    await session.commit()
    return image


@router.put("/products/{product_id}/images/order", response_model=list[ProductImageOut])
async def reorder_product_images(
    product_id: int,
    data: ProductImagesOrder,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
):
    """Порядок фото в карточке товара (011d): перетаскивание или «влево/вправо».
    Присылается весь список id — так порядок не разъедется, если два сотрудника
    двигают фото одновременно: последний запрос задаёт порядок целиком."""
    await _get_or_404(session, Product, product_id)
    images = list(
        (
            await session.scalars(select(ProductImage).where(ProductImage.product_id == product_id))
        ).all()
    )
    by_id = {image.id: image for image in images}
    if sorted(data.ids) != sorted(by_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Список фото изменился, обновите страницу",
        )
    for index, image_id in enumerate(data.ids):
        by_id[image_id].order = index
    await audit.record(
        session, request, admin, action="reorder_images", entity="product", entity_id=product_id
    )
    await session.commit()
    return sorted(images, key=lambda image: image.order)


@router.patch("/products/{product_id}/images/{image_id}", response_model=ProductImageOut)
async def set_main_product_image(
    product_id: int,
    image_id: int,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
):
    """Делает фото главным. Остальные сбрасываются на уровне сервиса,
    а не по данным от клиента."""
    image = await _get_or_404(session, ProductImage, image_id)
    if image.product_id != product_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Фото не найдено")

    await catalog_service.enforce_single_main_image(session, product_id, image_id)
    await audit.record(
        session, request, admin, action="set_main_image", entity="product", entity_id=product_id
    )
    await session.commit()
    return image


@router.put("/products/{product_id}/images/{image_id}/role", response_model=ProductImageOut)
async def set_product_image_role(
    product_id: int,
    image_id: int,
    data: ProductImageRoleIn,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
    background: BackgroundTasks,
):
    """Подпись фото на странице товара: «Целиком», «Срез», «Деталь», «Упаковка»."""
    image = await _get_or_404(session, ProductImage, image_id)
    if image.product_id != product_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Фото не найдено")
    image.role = data.role
    await audit.record(
        session, request, admin, action="image_role", entity="product", entity_id=product_id
    )
    await session.commit()
    _drop_cache(background, await _product_slug(session, product_id))
    return image


@router.delete("/products/{product_id}/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product_image(
    product_id: int,
    image_id: int,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
) -> None:
    image = await _get_or_404(session, ProductImage, image_id)
    if image.product_id != product_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Фото не найдено")

    was_main = image.is_main
    key = image.storage_key
    await session.delete(image)
    await session.flush()

    # Товар не должен остаться без главного фото — назначаем следующее
    if was_main:
        replacement = await session.scalar(
            select(ProductImage)
            .where(ProductImage.product_id == product_id)
            .order_by(ProductImage.order, ProductImage.id)
            .limit(1)
        )
        if replacement is not None:
            replacement.is_main = True

    await audit.record(
        session, request, admin, action="delete_image", entity="product", entity_id=product_id
    )
    await session.commit()
    await storage.delete_image(key)


@router.post("/uploads", status_code=status.HTTP_201_CREATED)
async def upload_media(
    admin: CurrentAdmin,
    request: Request,
    file: Annotated[UploadFile, File()],
    prefix: Annotated[
        str, Query(pattern="^(gallery|fillings|custom-cakes|reviews|pages)$")
    ] = "gallery",
) -> dict[str, str]:
    """Одиночная загрузка для разделов, где фото хранится полем в самой записи.

    Префикс ограничен списком: иначе клиент смог бы задать произвольный путь
    внутри бакета. `pages` — фото из контента страниц: портрет Елены
    и интерьер кондитерской.
    """
    key = await storage.upload_image(file, prefix=prefix)
    logger.info("Загружен файл %s пользователем %s", key, admin.email)
    return {"storage_key": key}


@router.post("/uploads/video", status_code=status.HTTP_201_CREATED, response_model=VideoUploadOut)
async def upload_hero_video(
    admin: CurrentAdmin,
    file: Annotated[UploadFile, File()],
) -> VideoUploadOut:
    from app.services.video import upload_video

    result = await upload_video(file)
    logger.info("Загружено видео %s пользователем %s", result["storage_key"], admin.id)
    return VideoUploadOut(**result)


# --- Торты на заказ, начинки, галерея ---


def _cake_out(cake: CustomCake, settings: BakerySettings) -> CustomCakeAdminOut:
    estimate = cake_service.estimate(settings, cake.min_guests, cake.decoration)
    return CustomCakeAdminOut(
        id=cake.id,
        slug=cake.slug,
        title=cake.title,
        subtitle=cake.subtitle,
        description=cake.description,
        occasion=cake.occasion,
        tiers=cake.tiers,
        min_guests=cake.min_guests,
        decoration=cake.decoration,
        images=[CustomCakeImageIn.model_validate(image) for image in cake.images],
        is_active=cake.is_active,
        order=cake.order,
        price_from=estimate.price_from,
        weight_kg=estimate.weight_kg,
        price_per_kg=estimate.price_per_kg,
    )


def _set_cake_images(cake: CustomCake, images: list[CustomCakeImageIn]) -> list[str]:
    """Заменяет фото дизайна списком из формы и возвращает ключи убранных файлов —
    их удаляют из хранилища после коммита."""
    kept = {image.storage_key for image in images}
    removed = [image.storage_key for image in cake.images if image.storage_key not in kept]
    cake.images = [
        CustomCakeImage(storage_key=image.storage_key, role=image.role, order=index)
        for index, image in enumerate(images)
    ]
    return removed


@router.get("/custom-cakes", response_model=list[CustomCakeAdminOut])
async def list_custom_cakes(admin: CurrentAdmin, session: SessionDep):
    settings = await bakery_settings.load(session)
    cakes = await session.scalars(select(CustomCake).order_by(CustomCake.order, CustomCake.id))
    return [_cake_out(cake, settings) for cake in cakes]


@router.post(
    "/custom-cakes", response_model=CustomCakeAdminOut, status_code=status.HTTP_201_CREATED
)
async def create_custom_cake(
    data: CustomCakeIn,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
    background: BackgroundTasks,
):
    cake = CustomCake(**data.model_dump(exclude={"images"}))
    _set_cake_images(cake, data.images)
    session.add(cake)
    await session.flush()
    await audit.record(
        session, request, admin, action="create", entity="custom_cake", entity_id=cake.id
    )
    await session.commit()
    _drop_paths(background, "/", "/custom-cakes", f"/custom-cakes/{cake.slug}", "/sitemap.xml")
    return _cake_out(cake, await bakery_settings.load(session))


@router.put("/custom-cakes/{item_id}", response_model=CustomCakeAdminOut)
async def update_custom_cake(
    item_id: int,
    data: CustomCakeIn,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
    background: BackgroundTasks,
):
    cake = await _get_or_404(session, CustomCake, item_id)
    old_slug = cake.slug
    # В журнал — только реально изменённые поля «было → стало» (011c); фото — числом
    before_images = [(image.storage_key, image.role) for image in cake.images]
    details = audit.apply_changes(cake, data.model_dump(exclude={"images"})) or {}
    removed = _set_cake_images(cake, data.images)
    after_images = [(image.storage_key, image.role) for image in data.images]
    if before_images != after_images:
        details.setdefault("fields", []).append("images")
    if details:
        await audit.record(
            session,
            request,
            admin,
            action="update",
            entity="custom_cake",
            entity_id=item_id,
            details=details,
        )
    await session.commit()
    await _delete_files(removed)
    _drop_paths(
        background,
        "/",
        "/custom-cakes",
        f"/custom-cakes/{old_slug}",
        f"/custom-cakes/{cake.slug}",
        "/sitemap.xml",
    )
    return _cake_out(cake, await bakery_settings.load(session))


@router.delete("/custom-cakes/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_custom_cake(
    item_id: int,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
    background: BackgroundTasks,
) -> None:
    cake = await _get_or_404(session, CustomCake, item_id)
    keys = [image.storage_key for image in cake.images]
    slug = cake.slug
    await session.delete(cake)
    await audit.record(
        session, request, admin, action="delete", entity="custom_cake", entity_id=item_id
    )
    await session.commit()
    await _delete_files(keys)
    _drop_paths(background, "/", "/custom-cakes", f"/custom-cakes/{slug}", "/sitemap.xml")


@router.get("/fillings", response_model=list[FillingAdminOut])
async def list_fillings(admin: CurrentAdmin, session: SessionDep):
    return list((await session.scalars(select(Filling).order_by(Filling.order))).all())


@router.post("/fillings", response_model=FillingAdminOut, status_code=status.HTTP_201_CREATED)
async def create_filling(
    data: FillingIn,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
    background: BackgroundTasks,
):
    filling = Filling(**data.model_dump())
    session.add(filling)
    await session.flush()
    await audit.record(
        session, request, admin, action="create", entity="filling", entity_id=filling.id
    )
    await session.commit()
    _drop_paths(background, "/", "/custom-cakes")
    return filling


@router.put("/fillings/{item_id}", response_model=FillingAdminOut)
async def update_filling(
    item_id: int,
    data: FillingIn,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
    background: BackgroundTasks,
):
    filling = await _get_or_404(session, Filling, item_id)
    # В журнал — только реально изменённые поля, цены и наличие — «было → стало» (011c)
    details = audit.apply_changes(filling, data.model_dump())
    if details is not None:
        await audit.record(
            session,
            request,
            admin,
            action="update",
            entity="filling",
            entity_id=item_id,
            details=details,
        )
    await session.commit()
    _drop_paths(background, "/", "/custom-cakes")
    return filling


@router.delete("/fillings/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_filling(
    item_id: int,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
    background: BackgroundTasks,
) -> None:
    filling = await _get_or_404(session, Filling, item_id)
    keys = [filling.image_key] if filling.image_key else []
    await session.delete(filling)
    await audit.record(
        session, request, admin, action="delete", entity="filling", entity_id=item_id
    )
    await session.commit()
    await _delete_files(keys)
    _drop_paths(background, "/", "/custom-cakes")


@router.get("/gallery", response_model=list[GalleryItemAdminOut])
async def list_gallery_admin(admin: CurrentAdmin, session: SessionDep):
    return list((await session.scalars(select(GalleryItem).order_by(GalleryItem.order))).all())


@router.post("/gallery", response_model=GalleryItemAdminOut, status_code=status.HTTP_201_CREATED)
async def create_gallery_item(
    data: GalleryItemIn,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
    background: BackgroundTasks,
):
    item = GalleryItem(**data.model_dump())
    session.add(item)
    await session.flush()
    await audit.record(
        session, request, admin, action="create", entity="gallery_item", entity_id=item.id
    )
    await session.commit()
    _drop_paths(background, "/", "/gallery")
    return item


@router.put("/gallery/{item_id}", response_model=GalleryItemAdminOut)
async def update_gallery_item(
    item_id: int,
    data: GalleryItemIn,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
    background: BackgroundTasks,
):
    item = await _get_or_404(session, GalleryItem, item_id)
    # В журнал — только реально изменённые поля, цены и наличие — «было → стало» (011c)
    details = audit.apply_changes(item, data.model_dump())
    if details is not None:
        await audit.record(
            session,
            request,
            admin,
            action="update",
            entity="gallery_item",
            entity_id=item_id,
            details=details,
        )
    await session.commit()
    _drop_paths(background, "/", "/gallery")
    return item


@router.delete("/gallery/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_gallery_item(
    item_id: int,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
    background: BackgroundTasks,
) -> None:
    item = await _get_or_404(session, GalleryItem, item_id)
    keys = [key for key in (item.image_key, item.detail_image_key) if key]
    await session.delete(item)
    await audit.record(
        session, request, admin, action="delete", entity="gallery_item", entity_id=item_id
    )
    await session.commit()
    # Файлы — после коммита (011f): упади коммит, работа осталась бы без фото
    await _delete_files(keys)
    _drop_paths(background, "/", "/gallery")


# --- Отзывы: модерация ---


def _review_paths(*product_slugs: str | None) -> list[str]:
    """Отзывы показываются на главной и в карточках своих товаров."""
    return ["/", *(f"/product/{slug}" for slug in product_slugs if slug)]


@router.post("/reviews", response_model=ReviewAdminOut, status_code=status.HTTP_201_CREATED)
async def create_review(
    data: ReviewIn,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
    background: BackgroundTasks,
):
    slug = await _product_slug(session, data.product_id)
    values = data.model_dump(exclude={"review_date"})
    if data.review_date is not None:
        values["created_at"] = review_moment(data.review_date)
    review = Review(**values)
    session.add(review)
    await session.flush()
    await audit.record(
        session, request, admin, action="create", entity="review", entity_id=review.id
    )
    await session.commit()
    _drop_paths(background, *_review_paths(slug))
    return review


@router.patch("/reviews/{review_id}", response_model=ReviewAdminOut)
async def update_review(
    review_id: int,
    data: ReviewUpdate,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
    background: BackgroundTasks,
):
    review = await _get_or_404(session, Review, review_id)
    changes = data.model_dump(exclude_unset=True)
    # Дата отзыва живёт в created_at (по нему сортирует сайт), см. ReviewUpdate
    if "review_date" in changes:
        day = changes.pop("review_date")
        if day is not None:
            changes["created_at"] = review_moment(day)

    # Отзыв могли перенести с одного товара на другой — сбрасываем обе карточки
    old_slug = await _product_slug(session, review.product_id)
    new_slug = (
        await _product_slug(session, changes["product_id"]) if "product_id" in changes else None
    )

    # Значение — только у публикации; текст и имя автора отзыва в журнал не пишутся
    details = audit.apply_changes(review, changes, safe=audit.REVIEW_SAFE_FIELDS)
    if details is not None:
        await audit.record(
            session,
            request,
            admin,
            action="update",
            entity="review",
            entity_id=review_id,
            details=details,
        )
    await session.commit()
    _drop_paths(background, *_review_paths(old_slug, new_slug))
    return review


@router.delete("/reviews/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_review(
    review_id: int,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
    background: BackgroundTasks,
) -> None:
    review = await _get_or_404(session, Review, review_id)
    slug = await _product_slug(session, review.product_id)
    await session.delete(review)
    await audit.record(
        session, request, admin, action="delete", entity="review", entity_id=review_id
    )
    await session.commit()
    _drop_paths(background, *_review_paths(slug))


# --- Контент страниц ---


@router.get("/pages/{page_key}", response_model=PageContentOut)
async def get_page_admin(page_key: PageKey, admin: CurrentAdmin, session: SessionDep):
    page = await session.scalar(select(PageContent).where(PageContent.page_key == page_key))
    if page is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Страница не найдена")
    return page


def _validated_content(page_key: PageKey, content: dict[str, Any]) -> dict[str, Any]:
    """Проверяет `content` страницы перед записью.

    У главной и контактов — по схеме из schemas/pages.py; у остальных страниц
    content пока свободный, и в нём проверяются только ссылки. Ошибки — обычные
    422 валидации с путём `body.content...`, как у любого другого поля.
    """
    schema = PAGE_CONTENT_SCHEMAS.get(page_key)
    if schema is None:
        errors = check_links(content, ("body", "content"))
        if errors:
            raise RequestValidationError(errors)
        return content
    try:
        parsed = schema.model_validate(content)
    except ValidationError as exc:
        raise RequestValidationError(
            [
                {**error, "loc": ("body", "content", *error["loc"])}
                for error in exc.errors(include_url=False, include_context=False)
            ]
        ) from None
    # exclude_unset: в базу ложится то, что прислала админка, без добавленных
    # схемой пустых значений по умолчанию
    return parsed.model_dump(mode="json", exclude_unset=True)


# Поля страницы, значения которых можно хранить в журнале: рейтинг, число оценок
# и ссылки. Тексты блоков — только именем блока (журнал не копия контента)
PAGE_SAFE_FIELDS = ("yandex_rating", "yandex_reviews_count", "yandex_maps_url", "telegram_url")
PAGE_SAFE_CONTENT = ("route_url",)


def _page_diff(page: PageContent, values: dict[str, Any]) -> dict[str, Any]:
    """Что изменилось на странице (011f): список блоков контента и «было → стало»
    безопасных полей. `{}` — ничего не поменялось."""
    old_content = page.content or {}
    new_content = values.get("content") or {}
    blocks = sorted(
        key
        for key in set(old_content) | set(new_content)
        if old_content.get(key) != new_content.get(key)
    )
    changes: dict[str, list[Any]] = {}
    for field in PAGE_SAFE_FIELDS:
        old, new = getattr(page, field, None), values.get(field)
        if old != new:
            changes[field] = [audit._plain(old), audit._plain(new)]
    for key in PAGE_SAFE_CONTENT:
        if old_content.get(key) != new_content.get(key):
            changes[key] = [old_content.get(key), new_content.get(key)]
    socials_old = [item.get("href") for item in old_content.get("socials", []) or []]
    socials_new = [item.get("href") for item in new_content.get("socials", []) or []]
    if socials_old != socials_new:
        changes["socials"] = [socials_old, socials_new]
    fields = sorted(
        field
        for field in values
        if field != "content"
        and field not in PAGE_SAFE_FIELDS
        and getattr(page, field, None) != values[field]
    )
    details: dict[str, Any] = {}
    if blocks:
        details["blocks"] = blocks
    if changes:
        details["changes"] = changes
    if fields:
        details["fields"] = fields
    return details


@router.put("/pages/{page_key}", response_model=PageContentOut)
async def update_page(
    page_key: PageKey,
    data: PageContentIn,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
    background: BackgroundTasks,
):
    page = await session.scalar(select(PageContent).where(PageContent.page_key == page_key))
    if page is None:
        page = PageContent(page_key=page_key)
        session.add(page)

    values = data.model_dump()
    values["content"] = _validated_content(page_key, data.content)
    details = _page_diff(page, values)
    for field, value in values.items():
        setattr(page, field, value)

    await audit.record(
        session,
        request,
        admin,
        action="update",
        entity="page",
        entity_id=page_key.value,
        details=details,
    )
    await session.commit()
    await session.refresh(page)
    # Правовые документы читают и даты редакции (legal), и реквизиты оператора (contacts).
    # Тег ключа страницы (014) сбрасывает всё, что её читает: контакты — шапка
    # и подвал на каждой странице, каталог и каждая карточка товара; «Торты на
    # заказ» — мега-меню шапки
    background.add_task(
        revalidate.revalidate_paths,
        ["/", "/about", "/contacts", "/custom-cakes", "/privacy", "/terms", "/consent"],
        [page_key.value],
    )
    return page


# --- Заказы ---


OrderPeriod = Annotated[
    admin_orders.Period | None,
    Query(description="Дата получения: сегодня, завтра или 7 дней от сегодня"),
]
OrderTab = Annotated[admin_orders.Tab, Query(description="Вкладка статусов")]


def _order_filters(
    period: OrderPeriod = None,
    date_from: Annotated[date | None, Query(description="Свой диапазон: с даты")] = None,
    date_to: Annotated[date | None, Query(description="Свой диапазон: по дату")] = None,
    method: Annotated[DeliveryMethod | None, Query(description="Способ получения")] = None,
) -> admin_orders.OrderFilters:
    return admin_orders.OrderFilters(
        period=period, date_from=date_from, date_to=date_to, method=method
    )


OrderFiltersDep = Annotated[admin_orders.OrderFilters, Depends(_order_filters)]


@router.get("/orders", response_model=OrderListPage)
async def list_orders(
    admin: CurrentAdmin,
    session: SessionDep,
    filters: OrderFiltersDep,
    tab: OrderTab = "all",
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> OrderListPage:
    """Список заказов с вкладками и фильтрами (011d). Новые сверху."""
    query = admin_orders.base_query(filters, tab)
    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
    orders = (
        await session.scalars(
            query.order_by(Order.created_at.desc(), Order.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    summaries = await dashboard_service.item_summaries(session, [o.id for o in orders])
    return OrderListPage(
        items=[
            OrderAdminListItem.model_validate(o).model_copy(
                update={"items_summary": summaries.get(o.id, "")}
            )
            for o in orders
        ],
        total=total,
        page=page,
        page_size=page_size,
        counts=await admin_orders.tab_counts(session, filters),
    )


@router.get("/orders/export.csv", response_class=Response)
async def export_orders(
    admin: CurrentAdmin,
    session: SessionDep,
    filters: OrderFiltersDep,
    tab: OrderTab = "all",
) -> Response:
    """CSV текущей выборки — как отчёт на главной, без телефонов: файл уходит
    из системы, и лишние ПДн в нём не нужны."""
    orders = (
        await session.scalars(
            admin_orders.base_query(filters, tab).order_by(Order.created_at.desc())
        )
    ).all()
    summaries = await dashboard_service.item_summaries(session, [o.id for o in orders])
    tz = dashboard_service.business_tz()
    rows = [
        [
            o.order_number,
            o.created_at.astimezone(tz).strftime("%d.%m.%Y %H:%M"),
            o.desired_date.strftime("%d.%m.%Y") if o.desired_date else "",
            admin_orders.interval_label(o.delivery_interval),
            "Доставка" if o.delivery_method is DeliveryMethod.DELIVERY else "Самовывоз",
            o.customer_name,
            summaries.get(o.id, ""),
            str(o.total_price),
            dashboard_service.ORDER_STATUS_LABELS[o.status],
        ]
        for o in orders
    ]
    body = dashboard_service.to_csv(
        [
            "Номер",
            "Оформлен",
            "Получение",
            "Время",
            "Способ",
            "Клиент",
            "Состав",
            "Сумма, ₽",
            "Статус",
        ],
        rows,
    )
    name = f"zakazy-{local_today():%Y-%m-%d}.csv"
    return Response(
        content=body,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename*=UTF-8''" + quote(name)},
    )


async def _order_detail(session: AsyncSession, order: Order) -> OrderAdminDetail:
    product_ids = [item.product_id for item in order.items]
    images = dict(
        (
            await session.execute(
                select(ProductImage.product_id, ProductImage.storage_key).where(
                    ProductImage.product_id.in_(product_ids), ProductImage.is_main.is_(True)
                )
            )
        ).all()
    )
    return OrderAdminDetail(
        id=order.id,
        order_number=order.order_number,
        customer_name=order.customer_name,
        customer_phone=order.customer_phone,
        customer_comment=order.customer_comment,
        customer_email=order.customer_email,
        contact_method=order.contact_method,
        recipient_name=order.recipient_name,
        recipient_phone=order.recipient_phone,
        delivery_method=order.delivery_method,
        delivery_address=order.delivery_address,
        address_apartment=order.address_apartment,
        address_entrance=order.address_entrance,
        address_floor=order.address_floor,
        courier_comment=order.courier_comment,
        desired_date=order.desired_date,
        delivery_interval=order.delivery_interval,
        subtotal=order.subtotal,
        delivery_price=order.delivery_price,
        total_price=order.total_price,
        status=order.status,
        cancel_reason=order.cancel_reason,
        # «Оформлен 1 октября, 17:53» — по часам кондитерской, как и всё в админке
        created_at=order.created_at.astimezone(dashboard_service.business_tz()),
        after_hours=order_service.is_after_hours(
            order.created_at, await bakery_settings.load(session)
        ),
        items=[
            OrderAdminItem(
                product_id=item.product_id,
                # Название и вариант — снапшоты: заказ читается так, как его оформили
                name=item.product_name,
                variant_label=item.variant_label,
                quantity=item.quantity,
                price=item.price,
                inscription_text=item.inscription_text,
                inscription_price=item.inscription_price,
                line_total=item.line_total,
                image_key=images.get(item.product_id),
            )
            for item in sorted(order.items, key=lambda i: i.id)
        ],
    )


@router.get("/orders/{order_id}", response_model=OrderAdminDetail)
async def get_order_admin(
    order_id: int, admin: CurrentAdmin, session: SessionDep, request: Request
) -> OrderAdminDetail:
    """Карточка заказа. Просмотр пишется в журнал (152-ФЗ: кто и когда открывал
    телефон и адрес клиента). В ленте главной просмотры не показываются."""
    order = await session.get(Order, order_id, options=[selectinload(Order.items)])
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Заказ не найден")
    detail = await _order_detail(session, order)
    await audit.record(session, request, admin, action="view", entity="order", entity_id=order_id)
    await session.commit()
    return detail


@router.patch("/orders/{order_id}", response_model=OrderAdminListItem)
async def update_order_status(
    order_id: int,
    data: OrderStatusUpdate,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
):
    order = await _get_or_404(session, Order, order_id)
    try:
        admin_orders.check_transition(order.status, data.status)
    except admin_orders.TransitionError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from None
    order.status = data.status
    if data.status is OrderStatus.CANCELLED:
        order.cancel_reason = (data.reason or "").strip() or None
    await audit.record(
        session,
        request,
        admin,
        action="update_status",
        entity="order",
        entity_id=order_id,
        # Только факт и новый статус: причина отмены остаётся в заказе
        details={"status": data.status.value},
    )
    await session.commit()
    await session.refresh(order)
    summaries = await dashboard_service.item_summaries(session, [order.id])
    return OrderAdminListItem.model_validate(order).model_copy(
        update={"items_summary": summaries.get(order.id, "")}
    )


# --- Заявки ---


@router.get(
    "/consultations/{request_id}/images/{image_id}",
    response_class=Response,
    responses={200: {"content": {"image/webp": {}}}},
)
async def get_consultation_image(
    request_id: int, image_id: int, admin: CurrentAdmin, session: SessionDep, request: Request
) -> Response:
    """Фото-образец из заявки (до пяти, 008a). Только через админку, не по публичной ссылке.

    Просмотр пишется в журнал: это персональные данные клиента, и по 152-ФЗ
    оператор должен понимать, кто и когда к ним обращался.
    """
    row = await _get_or_404(session, ConsultationRequest, request_id)
    image = next((image for image in row.images if image.id == image_id), None)
    if image is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Фото-образца нет")

    content = await storage.read_object(image.storage_key)
    if content is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл не найден")

    await audit.record(
        session,
        request,
        admin,
        action="view_reference",
        entity="consultation",
        entity_id=request_id,
        details={"image_id": image_id},
    )
    await session.commit()
    return Response(
        content=content,
        media_type="image/webp",
        headers={"Cache-Control": "private, no-store"},
    )


# --- Пользователи: только владелец ---


@router.get("/users", response_model=list[AdminOut])
async def list_users(admin: OwnerOnly, session: SessionDep):
    return list((await session.scalars(select(AdminUser).order_by(AdminUser.id))).all())


@router.post("/users", response_model=AdminOut, status_code=status.HTTP_201_CREATED)
async def create_user(data: AdminCreate, admin: OwnerOnly, session: SessionDep, request: Request):
    exists = await session.scalar(select(AdminUser).where(AdminUser.email == data.email.lower()))
    if exists is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Пользователь с таким e-mail уже есть"
        )

    try:
        validate_password(data.password, email=data.email)
    except PasswordPolicyError as error:
        raise as_validation_error("password", error) from None

    user = AdminUser(
        email=data.email.lower(),
        name=data.name,
        password_hash=hash_password(data.password),
        role=data.role,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    # В журнал — только id и роль, пароль и его хеш туда не попадают
    await audit.record(
        session,
        request,
        admin,
        action="create",
        entity="admin_user",
        entity_id=user.id,
        details={"role": data.role.value},
    )
    await session.commit()
    return user


@router.patch("/users/{user_id}", response_model=AdminOut)
async def update_user(
    user_id: int, data: AdminUpdate, admin: OwnerOnly, session: SessionDep, request: Request
):
    user = await _get_or_404(session, AdminUser, user_id)

    # Владелец не должен случайно разжаловать или отключить сам себя и потерять доступ
    if user.id == admin.id and (data.role is not None or data.is_active is False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя изменить роль или отключить собственную учётную запись",
        )

    changes = data.model_dump(exclude_unset=True)
    new_password = changes.pop("password", None)
    if new_password is not None:
        # Та же политика, что и при создании; e-mail — этого сотрудника
        try:
            validate_password(new_password, email=user.email)
        except PasswordPolicyError as error:
            raise as_validation_error("password", error) from None
        user.password_hash = hash_password(new_password)
    # Имя сотрудника — служебное, его «было → стало» в журнале допустимо (011c)
    renamed = (
        [user.name, changes["name"]] if "name" in changes and changes["name"] != user.name else None
    )
    for field, value in changes.items():
        setattr(user, field, value)

    # Новый пароль или отключение — все входы сотрудника закрываются сразу
    revoked = 0
    if new_password is not None or changes.get("is_active") is False:
        revoked = await sessions.revoke_all(session, user.id)

    fields = list(changes.keys()) + (["password"] if new_password is not None else [])
    await audit.record(
        session,
        request,
        admin,
        action="update",
        entity="admin_user",
        entity_id=user_id,
        # В журнал — имя поля «password», но не значение и не хеш
        details={
            "fields": [field for field in fields if field != "name"],
            "sessions_revoked": revoked,
            **({"changes": {"name": renamed}} if renamed else {}),
        },
    )
    await session.commit()
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int, admin: OwnerOnly, session: SessionDep, request: Request
) -> None:
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя удалить собственную учётную запись",
        )

    user = await _get_or_404(session, AdminUser, user_id)
    # Деактивация вместо удаления: журнал действий ссылается на пользователя,
    # и полное удаление стёрло бы связь с историей
    user.is_active = False
    revoked = await sessions.revoke_all(session, user.id)
    await audit.record(
        session,
        request,
        admin,
        action="deactivate",
        entity="admin_user",
        entity_id=user_id,
        details={"sessions_revoked": revoked},
    )
    await session.commit()


# --- Резервные копии: только владелец ---


@router.get("/backups", response_model=list[BackupOut])
async def list_backups(admin: OwnerOnly, session: SessionDep) -> list[BackupOut]:
    """Копии с автором (011f): кто создал — из журнала, автоматические — без автора.
    Отдельной колонки в таблице копий не заводим: журнал и так знает, кто нажал."""
    records = await backups.list_backups(session)
    rows = (
        await session.execute(
            select(AuditLogEntry.entity_id, AdminUser.name, AuditLogEntry.details)
            .outerjoin(AdminUser, AdminUser.id == AuditLogEntry.actor_id)
            .where(
                AuditLogEntry.entity == "backup",
                AuditLogEntry.action == "create",
                AuditLogEntry.entity_id.in_([str(record.id) for record in records]),
            )
        )
    ).all()
    authors = {entity_id: (name, details or {}) for entity_id, name, details in rows}
    result = []
    for record in records:
        name, details = authors.get(str(record.id), (None, {}))
        result.append(
            BackupOut.model_validate(record).model_copy(
                update={
                    "created_by": name,
                    "note": "Перед восстановлением"
                    if details.get("reason") == "pre_restore"
                    else None,
                }
            )
        )
    return result


@router.post("/backups", response_model=BackupOut, status_code=status.HTTP_201_CREATED)
async def create_backup(admin: OwnerOnly, session: SessionDep, request: Request):
    """Ручной запуск копии. Выполняется синхронно: владелица должна увидеть
    результат сразу, а не гадать, сняласьли копия."""
    try:
        record = await backups.create_backup(session, BackupType.MANUAL)
    except backups.BackupError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from None

    await audit.record(
        session, request, admin, action="create", entity="backup", entity_id=record.id
    )
    await session.commit()
    return record


@router.post("/backups/{backup_id}/restore", status_code=status.HTTP_204_NO_CONTENT)
async def restore_backup(
    backup_id: int,
    data: BackupRestoreRequest,
    admin: OwnerOnly,
    session: SessionDep,
    request: Request,
) -> None:
    """Восстановление из копии — необратимая операция.

    Требует явного подтверждения в теле запроса: случайный запрос по этому
    адресу не должен затирать боевые данные. Пишется в журнал до выполнения,
    чтобы след остался даже если восстановление оборвётся.
    """
    if data.confirm != RESTORE_CONFIRMATION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Для подтверждения передайте confirm={RESTORE_CONFIRMATION}",
        )

    # Страховка (011f): перед восстановлением снимаем копию текущего состояния.
    # Ошиблись копией — вернуться можно к тому, что было минуту назад. Не снялась —
    # восстанавливать не начинаем: без страховки затирать базу нельзя
    try:
        safety = await backups.create_backup(session, BackupType.MANUAL)
    except backups.BackupError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Не удалось снять копию текущего состояния, восстановление отменено: {exc}",
        ) from None
    await audit.record(
        session,
        request,
        admin,
        action="create",
        entity="backup",
        entity_id=safety.id,
        details={"reason": "pre_restore", "restore_from": backup_id},
    )
    await audit.record(
        session, request, admin, action="restore", entity="backup", entity_id=backup_id
    )
    await session.commit()

    try:
        await backups.restore_backup(session, backup_id)
    except backups.BackupError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from None


@router.delete("/backups/{backup_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_backup(
    backup_id: int, admin: OwnerOnly, session: SessionDep, request: Request
) -> None:
    await audit.record(
        session, request, admin, action="delete", entity="backup", entity_id=backup_id
    )
    await backups.delete_backup(session, backup_id)


@router.post("/retention/purge")
async def purge_personal_data(admin: OwnerOnly, session: SessionDep, request: Request):
    """Ручной запуск очистки ПДн по сроку хранения.

    Обычно выполняется по расписанию; ручной вызов нужен, чтобы показать
    работу механизма при приёмке и по запросу субъекта данных.
    """
    result = await retention.purge_expired(session)
    await audit.record(session, request, admin, action="purge", entity="personal_data")
    await session.commit()
    return result
