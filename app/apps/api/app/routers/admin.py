"""Admin API (02-api-contract.md, раздел Admin API).

Префикс отдельный от публичного API, чтобы права доступа и rate-limit
настраивались независимо. Роль проверяется на бэкенде на каждом эндпоинте,
а не только скрытием пунктов меню в UI.
"""

import logging
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any

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
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db import get_session
from app.core.deps import CurrentAdmin, OwnerOnly
from app.core.security import hash_password
from app.models import (
    AdminUser,
    BackupType,
    Category,
    ConsultationRequest,
    ConsultationSource,
    ConsultationStatus,
    CustomCake,
    Filling,
    GalleryItem,
    Order,
    OrderStatus,
    PageContent,
    PageKey,
    Product,
    ProductImage,
    Review,
    SubCategory,
)
from app.schemas.admin import (
    MAX_PRODUCT_IMAGES,
    RESTORE_CONFIRMATION,
    BackupOut,
    BackupRestoreRequest,
    CategoryAdminOut,
    CategoryIn,
    ConsultationAdminOut,
    ConsultationStatusUpdate,
    CustomCakeAdminOut,
    CustomCakeIn,
    DashboardStats,
    FillingAdminOut,
    FillingIn,
    GalleryItemAdminOut,
    GalleryItemIn,
    OrderAdminListItem,
    OrderStatusUpdate,
    PageContentIn,
    ProductAdminOut,
    ProductImageOut,
    ProductIn,
    ReviewAdminOut,
    ReviewIn,
    ReviewUpdate,
    SubCategoryAdminOut,
    SubCategoryIn,
)
from app.schemas.auth import AdminCreate, AdminOut, AdminUpdate
from app.schemas.common import Page
from app.schemas.shop import OrderOut, PageContentOut
from app.services import audit, backups, retention, revalidate, storage
from app.services import catalog as catalog_service
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


async def _get_or_404(session: AsyncSession, model: Any, item_id: int) -> Any:
    obj = await session.get(model, item_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Запись не найдена")
    return obj


# --- Дашборд ---


@router.get("", response_model=DashboardStats)
async def dashboard(admin: CurrentAdmin, session: SessionDep) -> DashboardStats:
    now = datetime.now(UTC)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week = now - timedelta(days=7)

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
    for field, value in data.model_dump().items():
        setattr(category, field, value)
    await audit.record(
        session,
        request,
        admin,
        action="update",
        entity="category",
        entity_id=item_id,
        details={"fields": list(data.model_dump().keys())},
    )
    await session.commit()
    await session.refresh(category, ["subcategories"])
    return category


@router.delete("/categories/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    item_id: int, admin: CurrentAdmin, session: SessionDep, request: Request
) -> None:
    category = await _get_or_404(session, Category, item_id)
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
    for field, value in data.model_dump().items():
        setattr(subcategory, field, value)
    await audit.record(
        session, request, admin, action="update", entity="subcategory", entity_id=item_id
    )
    await session.commit()
    return subcategory


@router.delete("/subcategories/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subcategory(
    item_id: int, admin: CurrentAdmin, session: SessionDep, request: Request
) -> None:
    subcategory = await _get_or_404(session, SubCategory, item_id)
    await session.delete(subcategory)
    await audit.record(
        session, request, admin, action="delete", entity="subcategory", entity_id=item_id
    )
    await session.commit()


# --- Товары ---


@router.get("/products", response_model=Page[ProductAdminOut])
async def list_products_admin(
    admin: CurrentAdmin,
    session: SessionDep,
    search: Annotated[str | None, Query(max_length=100)] = None,
    category_id: int | None = None,
    is_active: bool | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> Page[ProductAdminOut]:
    query = select(Product)
    if search:
        escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        query = query.where(Product.name.ilike(f"%{escaped}%"))
    if category_id is not None:
        query = query.where(Product.category_id == category_id)
    if is_active is not None:
        query = query.where(Product.is_active.is_(is_active))

    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = (
        await session.scalars(
            query.order_by(Product.order, Product.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    return Page(
        items=[ProductAdminOut.model_validate(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/products/{item_id}", response_model=ProductAdminOut)
async def get_product_admin(item_id: int, admin: CurrentAdmin, session: SessionDep):
    return await _get_or_404(session, Product, item_id)


@router.post("/products", response_model=ProductAdminOut, status_code=status.HTTP_201_CREATED)
async def create_product(
    data: ProductIn,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
    background: BackgroundTasks,
):
    await _check_product_refs(session, data)
    product = Product(**data.model_dump())
    session.add(product)
    await session.flush()
    await audit.record(
        session, request, admin, action="create", entity="product", entity_id=product.id
    )
    await session.commit()
    _drop_cache(background, product.slug)
    return product


@router.put("/products/{item_id}", response_model=ProductAdminOut)
async def update_product(
    item_id: int,
    data: ProductIn,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
    background: BackgroundTasks,
):
    product = await _get_or_404(session, Product, item_id)
    await _check_product_refs(session, data)
    old_slug = product.slug
    for field, value in data.model_dump().items():
        setattr(product, field, value)
    await audit.record(
        session,
        request,
        admin,
        action="update",
        entity="product",
        entity_id=item_id,
        details={"fields": list(data.model_dump().keys())},
    )
    await session.commit()
    # updated_at проставляет БД (onupdate=now()), после коммита значение в объекте
    # помечено устаревшим — без refresh сериализация ответа полезет в базу
    # синхронно и упадёт в async-сессии
    await session.refresh(product)
    _drop_cache(background, product.slug)
    if old_slug != product.slug:
        # Старый адрес тоже закэширован — без сброса он продолжит отдавать товар
        _drop_cache(background, old_slug)
    return product


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
    prefix: Annotated[str, Query(pattern="^(gallery|fillings|custom-cakes|reviews)$")] = "gallery",
) -> dict[str, str]:
    """Одиночная загрузка для разделов, где фото хранится полем в самой записи.

    Префикс ограничен списком: иначе клиент смог бы задать произвольный путь
    внутри бакета.
    """
    key = await storage.upload_image(file, prefix=prefix)
    logger.info("Загружен файл %s пользователем %s", key, admin.email)
    return {"storage_key": key}


# --- Торты на заказ, начинки, галерея ---


@router.get("/custom-cakes", response_model=list[CustomCakeAdminOut])
async def list_custom_cakes(admin: CurrentAdmin, session: SessionDep):
    return list((await session.scalars(select(CustomCake).order_by(CustomCake.order))).all())


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
    cake = CustomCake(**data.model_dump())
    session.add(cake)
    await session.flush()
    await audit.record(
        session, request, admin, action="create", entity="custom_cake", entity_id=cake.id
    )
    await session.commit()
    _drop_paths(background, "/", "/custom-cakes")
    return cake


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
    for field, value in data.model_dump().items():
        setattr(cake, field, value)
    await audit.record(
        session, request, admin, action="update", entity="custom_cake", entity_id=item_id
    )
    await session.commit()
    _drop_paths(background, "/", "/custom-cakes")
    return cake


@router.delete("/custom-cakes/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_custom_cake(
    item_id: int,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
    background: BackgroundTasks,
) -> None:
    cake = await _get_or_404(session, CustomCake, item_id)
    await session.delete(cake)
    await audit.record(
        session, request, admin, action="delete", entity="custom_cake", entity_id=item_id
    )
    await session.commit()
    _drop_paths(background, "/", "/custom-cakes")


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
    for field, value in data.model_dump().items():
        setattr(filling, field, value)
    await audit.record(
        session, request, admin, action="update", entity="filling", entity_id=item_id
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
    await session.delete(filling)
    await audit.record(
        session, request, admin, action="delete", entity="filling", entity_id=item_id
    )
    await session.commit()
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
    for field, value in data.model_dump().items():
        setattr(item, field, value)
    await audit.record(
        session, request, admin, action="update", entity="gallery_item", entity_id=item_id
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
    await session.delete(item)
    await audit.record(
        session, request, admin, action="delete", entity="gallery_item", entity_id=item_id
    )
    await session.commit()
    _drop_paths(background, "/", "/gallery")


# --- Отзывы: модерация ---


def _review_paths(*product_slugs: str | None) -> list[str]:
    """Отзывы показываются на главной и в карточках своих товаров."""
    return ["/", *(f"/product/{slug}" for slug in product_slugs if slug)]


@router.get("/reviews", response_model=list[ReviewAdminOut])
async def list_reviews_admin(
    admin: CurrentAdmin, session: SessionDep, product_id: int | None = None
):
    """Все отзывы, включая неопубликованные. Можно сузить до одного товара."""
    query = select(Review).order_by(Review.created_at.desc())
    if product_id is not None:
        query = query.where(Review.product_id == product_id)
    return list((await session.scalars(query)).all())


@router.post("/reviews", response_model=ReviewAdminOut, status_code=status.HTTP_201_CREATED)
async def create_review(
    data: ReviewIn,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
    background: BackgroundTasks,
):
    slug = await _product_slug(session, data.product_id)
    review = Review(**data.model_dump())
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

    # Отзыв могли перенести с одного товара на другой — сбрасываем обе карточки
    old_slug = await _product_slug(session, review.product_id)
    new_slug = (
        await _product_slug(session, changes["product_id"]) if "product_id" in changes else None
    )

    for field, value in changes.items():
        setattr(review, field, value)
    await audit.record(
        session,
        request,
        admin,
        action="update",
        entity="review",
        entity_id=review_id,
        details={"fields": list(changes.keys())},
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

    for field, value in data.model_dump().items():
        setattr(page, field, value)

    await audit.record(
        session, request, admin, action="update", entity="page", entity_id=page_key.value
    )
    await session.commit()
    await session.refresh(page)
    background.add_task(revalidate.revalidate_paths, ["/", "/about", "/contacts", "/custom-cakes"])
    return page


# --- Заказы ---


@router.get("/orders", response_model=Page[OrderAdminListItem])
async def list_orders(
    admin: CurrentAdmin,
    session: SessionDep,
    order_status: Annotated[OrderStatus | None, Query(alias="status")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> Page[OrderAdminListItem]:
    query = select(Order)
    if order_status is not None:
        query = query.where(Order.status == order_status)

    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = (
        await session.scalars(
            query.order_by(Order.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        )
    ).all()
    return Page(
        items=[OrderAdminListItem.model_validate(o) for o in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/orders/{order_id}", response_model=OrderOut)
async def get_order_admin(order_id: int, admin: CurrentAdmin, session: SessionDep) -> OrderOut:
    order = await session.get(Order, order_id, options=[selectinload(Order.items)])
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Заказ не найден")
    return await order_service.build_order_view(session, order)


@router.patch("/orders/{order_id}", response_model=OrderAdminListItem)
async def update_order_status(
    order_id: int,
    data: OrderStatusUpdate,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
):
    order = await _get_or_404(session, Order, order_id)
    order.status = data.status
    await audit.record(
        session,
        request,
        admin,
        action="update_status",
        entity="order",
        entity_id=order_id,
        details={"status": data.status.value},
    )
    await session.commit()
    return order


# --- Заявки ---


@router.get("/consultations", response_model=Page[ConsultationAdminOut])
async def list_consultations(
    admin: CurrentAdmin,
    session: SessionDep,
    source: ConsultationSource | None = None,
    request_status: Annotated[ConsultationStatus | None, Query(alias="status")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> Page[ConsultationAdminOut]:
    query = select(ConsultationRequest)
    if source is not None:
        query = query.where(ConsultationRequest.source == source)
    if request_status is not None:
        query = query.where(ConsultationRequest.status == request_status)

    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = (
        await session.scalars(
            query.order_by(ConsultationRequest.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    return Page(
        items=[ConsultationAdminOut.model_validate(c) for c in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.patch("/consultations/{request_id}", response_model=ConsultationAdminOut)
async def update_consultation(
    request_id: int,
    data: ConsultationStatusUpdate,
    admin: CurrentAdmin,
    session: SessionDep,
    request: Request,
):
    row = await _get_or_404(session, ConsultationRequest, request_id)
    row.status = data.status
    await audit.record(
        session, request, admin, action="update_status", entity="consultation", entity_id=request_id
    )
    await session.commit()
    return row


@router.get(
    "/consultations/{request_id}/reference",
    response_class=Response,
    responses={200: {"content": {"image/webp": {}}}},
)
async def get_consultation_reference(
    request_id: int, admin: CurrentAdmin, session: SessionDep, request: Request
) -> Response:
    """Фото-референс из заявки. Отдаётся только через админку, не по публичной ссылке.

    Просмотр пишется в журнал: это персональные данные клиента, и по 152-ФЗ
    оператор должен понимать, кто и когда к ним обращался.
    """
    row = await _get_or_404(session, ConsultationRequest, request_id)
    if row.reference_image_key is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Референса нет")

    content = await storage.read_object(row.reference_image_key)
    if content is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл не найден")

    await audit.record(
        session,
        request,
        admin,
        action="view_reference",
        entity="consultation",
        entity_id=request_id,
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

    user = AdminUser(
        email=data.email.lower(),
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
    for field, value in changes.items():
        setattr(user, field, value)

    await audit.record(
        session,
        request,
        admin,
        action="update",
        entity="admin_user",
        entity_id=user_id,
        details={"fields": list(changes.keys())},
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
    await audit.record(
        session, request, admin, action="deactivate", entity="admin_user", entity_id=user_id
    )
    await session.commit()


# --- Резервные копии: только владелец ---


@router.get("/backups", response_model=list[BackupOut])
async def list_backups(admin: OwnerOnly, session: SessionDep):
    return await backups.list_backups(session)


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
