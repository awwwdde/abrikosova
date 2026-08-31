"""Admin API (02-api-contract.md, раздел Admin API). Реализация — Этап 3.

Префикс отдельный от публичного API, чтобы права доступа и rate-limit настраивались
независимо. Проверка роли (owner/manager) выполняется на бэкенде на каждом эндпоинте,
а не только скрытием пунктов меню в UI (05-nonfunctional-and-acceptance.md).
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.models.enums import PageKey
from app.routers._stub import not_implemented

STAGE = "Этап 3"

router = APIRouter(prefix="/admin", tags=["admin"])

# Домены с полным CRUD — пути фиксируются здесь, тела появятся на Этапе 3.
CRUD_DOMAINS = ("categories", "subcategories", "products", "custom-cakes", "fillings", "gallery")


def _register_crud(domain: str) -> None:
    @router.get(f"/{domain}", name=f"admin_list_{domain}")
    async def _list() -> JSONResponse:
        return not_implemented(STAGE)

    @router.post(f"/{domain}", name=f"admin_create_{domain}", status_code=201)
    async def _create() -> JSONResponse:
        return not_implemented(STAGE)

    @router.get(f"/{domain}/{{item_id}}", name=f"admin_get_{domain}")
    async def _get(item_id: int) -> JSONResponse:
        return not_implemented(STAGE)

    @router.put(f"/{domain}/{{item_id}}", name=f"admin_update_{domain}")
    async def _update(item_id: int) -> JSONResponse:
        return not_implemented(STAGE)

    @router.delete(f"/{domain}/{{item_id}}", name=f"admin_delete_{domain}")
    async def _delete(item_id: int) -> JSONResponse:
        return not_implemented(STAGE)


for _domain in CRUD_DOMAINS:
    _register_crud(_domain)


# --- Изображения товара (лимит 6 шт., конвертация в WEBP на бэкенде) ---


@router.post("/products/{product_id}/images", status_code=201)
async def upload_product_image(product_id: int) -> JSONResponse:
    return not_implemented(STAGE)


@router.delete("/products/{product_id}/images/{image_id}")
async def delete_product_image(product_id: int, image_id: int) -> JSONResponse:
    return not_implemented(STAGE)


# --- Отзывы: модерация ---


@router.get("/reviews")
async def admin_list_reviews() -> JSONResponse:
    """Все отзывы, включая неопубликованные."""
    return not_implemented(STAGE)


@router.patch("/reviews/{review_id}")
async def admin_update_review(review_id: int) -> JSONResponse:
    """Публикация/скрытие, правка текста."""
    return not_implemented(STAGE)


@router.delete("/reviews/{review_id}")
async def admin_delete_review(review_id: int) -> JSONResponse:
    return not_implemented(STAGE)


# --- Контент страниц ---


@router.get("/pages/{page_key}")
async def admin_get_page(page_key: PageKey) -> JSONResponse:
    return not_implemented(STAGE)


@router.put("/pages/{page_key}")
async def admin_update_page(page_key: PageKey) -> JSONResponse:
    return not_implemented(STAGE)


# --- Заказы и заявки ---


@router.get("/orders")
async def admin_list_orders() -> JSONResponse:
    return not_implemented(STAGE)


@router.get("/orders/{order_id}")
async def admin_get_order(order_id: int) -> JSONResponse:
    return not_implemented(STAGE)


@router.patch("/orders/{order_id}")
async def admin_update_order(order_id: int) -> JSONResponse:
    """Смена статуса заказа."""
    return not_implemented(STAGE)


@router.get("/consultations")
async def admin_list_consultations() -> JSONResponse:
    """С фильтром по source: custom_cake / contact_page."""
    return not_implemented(STAGE)


@router.patch("/consultations/{request_id}")
async def admin_update_consultation(request_id: int) -> JSONResponse:
    return not_implemented(STAGE)


# --- Пользователи и бэкапы: только роль owner ---


@router.get("/users")
async def admin_list_users() -> JSONResponse:
    return not_implemented(STAGE)


@router.post("/users", status_code=201)
async def admin_create_user() -> JSONResponse:
    return not_implemented(STAGE)


@router.patch("/users/{user_id}")
async def admin_update_user(user_id: int) -> JSONResponse:
    return not_implemented(STAGE)


@router.delete("/users/{user_id}")
async def admin_delete_user(user_id: int) -> JSONResponse:
    return not_implemented(STAGE)


@router.get("/backups")
async def admin_list_backups() -> JSONResponse:
    return not_implemented(STAGE)


@router.post("/backups", status_code=201)
async def admin_create_backup() -> JSONResponse:
    """Ручной запуск pg_dump с выгрузкой файла в S3."""
    return not_implemented(STAGE)


@router.post("/backups/{backup_id}/restore")
async def admin_restore_backup(backup_id: int) -> JSONResponse:
    """Необратимая операция — в UI подтверждается отдельной модалкой."""
    return not_implemented(STAGE)
