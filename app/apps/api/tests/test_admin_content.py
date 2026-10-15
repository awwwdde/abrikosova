"""Примеры работ, страницы сайта, резервные копии в админке (задание 011f)."""

from types import SimpleNamespace

from sqlalchemy import delete, select

from app.core.db import SessionLocal
from app.models import AuditLogEntry, GalleryItem
from app.routers import admin as admin_router
from app.services import backups, storage


async def _work(caption: str, **fields) -> int:
    async with SessionLocal() as session:
        item = GalleryItem(
            image_key=fields.pop("image_key", "placeholder/gallery/x.webp"),
            caption=caption,
            **fields,
        )
        session.add(item)
        await session.commit()
        return item.id


# --- Примеры работ ---


async def test_gallery_reorder_and_stale_list(client, admin_headers) -> None:
    created = [await _work(f"Порядок {i}") for i in range(2)]
    try:
        async with SessionLocal() as session:
            ids = list(
                (await session.scalars(select(GalleryItem.id).order_by(GalleryItem.id))).all()
            )
        reversed_ids = list(reversed(ids))
        response = await client.put(
            "/api/v1/admin/gallery/order", json={"ids": reversed_ids}, headers=admin_headers
        )
        assert response.status_code == 204, response.text
        async with SessionLocal() as session:
            order = list(
                (await session.scalars(select(GalleryItem.id).order_by(GalleryItem.order))).all()
            )
        assert order == reversed_ids
        stale = await client.put(
            "/api/v1/admin/gallery/order", json={"ids": [*ids, 999999]}, headers=admin_headers
        )
        assert stale.status_code == 409
    finally:
        async with SessionLocal() as session:
            await session.execute(delete(GalleryItem).where(GalleryItem.id.in_(created)))
            await session.commit()


async def test_deleting_work_removes_its_files(client, admin_headers, monkeypatch) -> None:
    removed: list[str] = []

    async def fake_delete(key: str) -> None:
        removed.append(key)

    monkeypatch.setattr(storage, "delete_image", fake_delete)
    work_id = await _work(
        "С фото", image_key="gallery/main-test.webp", detail_image_key="gallery/detail-test.webp"
    )
    placeholder_id = await _work("Заглушка сида")

    response = await client.delete(f"/api/v1/admin/gallery/{work_id}", headers=admin_headers)
    assert response.status_code == 204
    assert removed == ["gallery/main-test.webp", "gallery/detail-test.webp"]

    removed.clear()
    await client.delete(f"/api/v1/admin/gallery/{placeholder_id}", headers=admin_headers)
    assert removed == [], "У заглушек сида файла нет — удалять нечего"


# --- Страницы сайта ---


async def _contacts(client, headers) -> dict:
    page = (await client.get("/api/v1/admin/pages/contacts", headers=headers)).json()
    return {key: value for key, value in page.items() if key != "page_key"}


async def test_page_rejects_unsafe_links(client, admin_headers) -> None:
    page = await _contacts(client, admin_headers)
    content = {**page["content"], "socials": [{"label": "ВКонтакте", "href": "http://vk.com/x"}]}
    response = await client.put(
        "/api/v1/admin/pages/contacts", json={**page, "content": content}, headers=admin_headers
    )
    assert response.status_code == 422
    locs = [error["loc"] for error in response.json()["detail"]]
    assert ["body", "content", "socials", 0, "href"] in locs

    bad_maps = await client.put(
        "/api/v1/admin/pages/contacts",
        json={**page, "yandex_maps_url": "javascript:alert(1)"},
        headers=admin_headers,
    )
    assert bad_maps.status_code == 422


async def test_page_diff_records_rating_and_blocks(client, admin_headers) -> None:
    page = await _contacts(client, admin_headers)
    original = dict(page)
    try:
        changed = {
            **page,
            "yandex_rating": "4.8" if page.get("yandex_rating") != "4.8" else "4.9",
            "content": {**page["content"], "pickup": "Самовывоз: Гжатская, 5к8, с 9:00"},
        }
        response = await client.put(
            "/api/v1/admin/pages/contacts", json=changed, headers=admin_headers
        )
        assert response.status_code == 200, response.text
        async with SessionLocal() as session:
            entry = await session.scalar(
                select(AuditLogEntry)
                .where(AuditLogEntry.entity == "page", AuditLogEntry.entity_id == "contacts")
                .order_by(AuditLogEntry.id.desc())
            )
        assert entry.details["blocks"] == ["pickup"]
        old, new = entry.details["changes"]["yandex_rating"]
        assert new == changed["yandex_rating"]
        assert old == page.get("yandex_rating")
        # Тексты блоков в журнал не попадают — только имя блока
        assert "Гжатская" not in str(entry.details)
    finally:
        await client.put("/api/v1/admin/pages/contacts", json=original, headers=admin_headers)


# --- Резервные копии ---


async def test_restore_takes_safety_backup_first(client, admin_headers, monkeypatch) -> None:
    calls: list[str] = []

    async def fake_create(session, backup_type):
        calls.append("create")
        return SimpleNamespace(id=424242)

    async def fake_restore(session, backup_id):
        calls.append(f"restore {backup_id}")

    monkeypatch.setattr(backups, "create_backup", fake_create)
    monkeypatch.setattr(backups, "restore_backup", fake_restore)

    wrong = await client.post(
        "/api/v1/admin/backups/7/restore", json={"confirm": "да"}, headers=admin_headers
    )
    assert wrong.status_code == 400
    assert calls == []

    response = await client.post(
        "/api/v1/admin/backups/7/restore",
        json={"confirm": admin_router.RESTORE_CONFIRMATION},
        headers=admin_headers,
    )
    assert response.status_code == 204, response.text
    assert calls == ["create", "restore 7"]

    async with SessionLocal() as session:
        entry = await session.scalar(
            select(AuditLogEntry).where(
                AuditLogEntry.entity == "backup", AuditLogEntry.entity_id == "424242"
            )
        )
    assert entry.details == {"reason": "pre_restore", "restore_from": 7}


async def test_restore_aborts_without_safety_backup(client, admin_headers, monkeypatch) -> None:
    calls: list[str] = []

    async def failing_create(session, backup_type):
        raise backups.BackupError("хранилище недоступно")

    async def fake_restore(session, backup_id):
        calls.append("restore")

    monkeypatch.setattr(backups, "create_backup", failing_create)
    monkeypatch.setattr(backups, "restore_backup", fake_restore)
    response = await client.post(
        "/api/v1/admin/backups/7/restore",
        json={"confirm": admin_router.RESTORE_CONFIRMATION},
        headers=admin_headers,
    )
    assert response.status_code == 503
    assert "восстановление отменено" in response.json()["detail"]
    assert calls == []


async def test_manager_cannot_touch_backups(client, manager_headers) -> None:
    assert (await client.get("/api/v1/admin/backups", headers=manager_headers)).status_code == 403
    assert (await client.post("/api/v1/admin/backups", headers=manager_headers)).status_code == 403
    response = await client.post(
        "/api/v1/admin/backups/1/restore",
        json={"confirm": admin_router.RESTORE_CONFIRMATION},
        headers=manager_headers,
    )
    assert response.status_code == 403
