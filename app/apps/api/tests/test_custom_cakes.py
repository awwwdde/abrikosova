"""Торты на заказ (008a): расчёт «от X ₽», дизайны, заявка с фото-образцами,
письмо, журнал, обезличивание, миграция старого `reference_image_key`."""

import asyncio
import io
import json
import os
import subprocess
import uuid
from datetime import timedelta
from decimal import Decimal

import asyncpg
import pytest
from PIL import Image
from sqlalchemy import delete, select

from app.core.clock import local_today
from app.core.db import SessionLocal
from app.models import (
    AuditLogEntry,
    CakeDecoration,
    CakeImageRole,
    ConsultationImage,
    ConsultationRequest,
    ConsultationSource,
    ConsultationStatus,
    CustomCake,
    CustomCakeImage,
    Filling,
    RequestOccasion,
)
from app.models.enums import GalleryOccasion
from app.routers import custom_cakes as cakes_router
from app.schemas.settings import BakerySettings
from app.services import consultation_email, retention, storage
from app.services import custom_cakes as cakes
from app.services.order_email import NBSP
from app.services.orders import retention_cutoff

CONSULTATIONS = "/api/v1/consultations"
DEFAULTS = BakerySettings()


# --- Расчёт ---


@pytest.mark.parametrize(
    ("guests", "decoration", "weight", "tiers", "price"),
    [
        # Кадры макета: 20 гостей → 3 кг, 1 ярус; 40 гостей → 6 кг, 3 яруса
        (20, CakeDecoration.CLASSIC, "3", 1, 9_600),
        (40, CakeDecoration.MULTI_TIER, "6", 3, 27_000),
        # Граница 2 кг: 13 гостей × 150 г = 1,95 кг → 2 кг; 5 гостей — тоже 2 кг
        (13, CakeDecoration.CREAM_DRAWING, "2", 1, 7_600),
        (5, CakeDecoration.CLASSIC, "2", 1, 6_400),
        # Вверх до 0,5 кг: 14 гостей = 2,1 кг → 2,5 кг
        (14, CakeDecoration.CLASSIC, "2.5", 1, 8_000),
        # Граница ярусов «от 3,5 кг — 2»: 23 гостя = 3,45 → 3,5 кг
        (23, CakeDecoration.CLASSIC, "3.5", 2, 11_200),
        (60, CakeDecoration.MULTI_TIER, "9", 3, 40_500),
    ],
)
def test_estimate(guests, decoration, weight, tiers, price) -> None:
    result = cakes.estimate(DEFAULTS, guests, decoration)
    assert result.weight_kg == Decimal(weight)
    assert result.tiers == tiers
    assert result.price_from == price


def test_tiers_table_must_start_from_zero() -> None:
    with pytest.raises(ValueError, match="от 0 кг"):
        BakerySettings(cake_tiers=[{"from_kg": "1", "tiers": 1}])


async def test_estimate_endpoint(client, clean_settings) -> None:
    response = await client.get("/api/v1/custom-cakes/estimate", params={"guests": 20})
    assert response.json() == {
        "guests": 20,
        "weight_kg": "3.0",
        "tiers": 1,
        "decoration": "classic",
        "price_per_kg": 3200,
        "price_from": 9600,
    }
    missing = await client.get(
        "/api/v1/custom-cakes/estimate", params={"guests": 20, "design": "net-takogo"}
    )
    assert missing.status_code == 404


# --- Дизайны ---


@pytest.fixture
async def designs():
    """Два своих дизайна (свадьба и детский) с уникальными адресами; убираются после теста."""
    tag = uuid.uuid4().hex[:8]
    async with SessionLocal() as session:
        wedding = CustomCake(
            slug=f"t-{tag}-wedding",
            title="Белый с пионами",
            subtitle="Пионы кремом",
            description="",
            occasion=GalleryOccasion.WEDDING,
            tiers=3,
            min_guests=40,
            decoration=CakeDecoration.MULTI_TIER,
            images=[
                CustomCakeImage(storage_key="custom-cakes/a.webp", role=CakeImageRole.WHOLE),
                CustomCakeImage(storage_key="custom-cakes/b.webp", role=CakeImageRole.CUT, order=1),
            ],
            order=-100,
        )
        kids = CustomCake(
            slug=f"t-{tag}-kids",
            title="Лисёнок",
            description="",
            occasion=GalleryOccasion.KIDS,
            tiers=1,
            min_guests=13,
            decoration=CakeDecoration.CREAM_DRAWING,
            order=-99,
        )
        session.add_all([wedding, kids])
        await session.commit()
        ids = (wedding.id, kids.id)
        slugs = (wedding.slug, kids.slug)
    yield {"wedding": (ids[0], slugs[0]), "kids": (ids[1], slugs[1])}
    async with SessionLocal() as session:
        await session.execute(delete(CustomCake).where(CustomCake.id.in_(ids)))
        await session.commit()


async def test_list_filter_and_price_from(client, designs, clean_settings) -> None:
    _, wedding_slug = designs["wedding"]
    _, kids_slug = designs["kids"]
    everything = (await client.get("/api/v1/custom-cakes")).json()
    by_slug = {item["slug"]: item for item in everything["items"]}
    assert by_slug[wedding_slug]["price_from"] == 27_000
    assert by_slug[wedding_slug]["image_key"] == "custom-cakes/a.webp"
    assert by_slug[wedding_slug]["occasion_label"] == "Свадьба"
    assert by_slug[kids_slug]["price_from"] == 7_600
    facets = {facet["value"]: facet["count"] for facet in everything["facets"]}
    assert facets["wedding"] >= 1 and facets["kids"] >= 1

    kids = (await client.get("/api/v1/custom-cakes", params={"occasion": "kids"})).json()
    slugs = {item["slug"] for item in kids["items"]}
    assert kids_slug in slugs and wedding_slug not in slugs
    # Счётчики «таблеток» — по всем дизайнам, а не по отфильтрованным
    assert {f["value"]: f["count"] for f in kids["facets"]} == facets


async def test_design_page(client, designs, clean_settings) -> None:
    _, slug = designs["wedding"]
    data = (await client.get(f"/api/v1/custom-cakes/{slug}")).json()
    assert data["specs"] == {
        "decoration_label": "Многоярусный",
        "price_per_kg": 4500,
        "min_weight_kg": "6.0",
        "tiers": 3,
        "filling_note": "любая из списка, у ярусов может быть разная",
    }
    assert [image["role_label"] for image in data["images"]] == ["Целиком", "Срез"]
    assert data["earliest_date"] == (local_today() + timedelta(days=5)).isoformat()
    assert len(data["others"]) <= 4 and slug not in {o["slug"] for o in data["others"]}
    assert (await client.get("/api/v1/custom-cakes/net-takogo")).status_code == 404


async def test_info_uses_settings(client, clean_settings) -> None:
    data = (await client.get("/api/v1/custom-cakes/info")).json()
    assert data["facts"][0] == {"value": "от 2 кг", "label": "минимальный вес"}
    assert data["facts"][2]["value"] == f"от 3{NBSP}200{NBSP}₽"
    assert [p["price_per_kg"] for p in data["prices"]] == [3200, 3800, 4500]
    assert [e["name"] for e in data["extras"]] == ["Свечи", "Топпер с надписью", "Открытка"]
    assert [o["label"] for o in data["occasions"]][-1] == "Другое"
    assert len(data["fillings"]) <= 8


# --- Заявка ---


def _jpeg_with_exif() -> bytes:
    """Фото «с телефона»: модель камеры и геометка в EXIF."""
    image = Image.new("RGB", (64, 48), (200, 120, 90))
    exif = Image.Exif()
    exif[0x010F] = "Apple"  # Make
    exif[0x0110] = "iPhone 15"  # Model
    exif[0x8825] = {1: "N", 2: (55.0, 45.0, 21.0), 3: "E", 4: (37.0, 37.0, 4.0)}  # GPS
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", exif=exif)
    return buffer.getvalue()


def _form(**overrides) -> dict:
    event = (local_today() + timedelta(days=20)).isoformat()
    return {
        "name": "Анна Заявкина",
        "phone": "+79161234567",
        "email": "anna.zayavka@mail.ru",
        "consent_pd": "true",
        "occasion": "wedding",
        "event_date": event,
        "guests_count": "40",
    } | overrides


@pytest.fixture
def stored(monkeypatch):
    """Хранилище в памяти: что ушло в бакет и что из него удалено."""
    saved: dict[str, bytes] = {}
    deleted: list[str] = []

    async def fake_put(webp: bytes, prefix: str) -> str:
        key = f"{prefix}/{uuid.uuid4().hex}.webp"
        saved[key] = webp
        return key

    async def fake_delete(key: str) -> None:
        deleted.append(key)

    monkeypatch.setattr(storage, "put_webp", fake_put)
    monkeypatch.setattr(storage, "delete_image", fake_delete)
    return saved, deleted


@pytest.fixture
def emails(monkeypatch):
    sent: list[consultation_email.ConsultationEmail] = []
    monkeypatch.setattr(consultation_email, "send_copy", sent.append)
    return sent


async def _cleanup(request_id: int) -> None:
    async with SessionLocal() as session:
        await session.execute(
            delete(ConsultationRequest).where(ConsultationRequest.id == request_id)
        )
        await session.commit()


async def test_request_with_design(client, designs, stored, emails, clean_settings) -> None:
    design_id, _ = designs["wedding"]
    response = await client.post(
        CONSULTATIONS,
        data=_form(design_id=str(design_id), extras=["Свечи", "Открытка"], wishes="Белые пионы"),
    )
    assert response.status_code == 201, response.text
    body = response.json()
    try:
        assert body["number"].startswith(f"З-{local_today():%Y%m%d}-")
        assert len(body["number"].rsplit("-", 1)[1]) == 4
        event = local_today() + timedelta(days=20)
        assert body["title"].startswith("Белый с пионами, свадьба, ")
        assert body["title"].endswith(f"{event.day} {cakes_router.MONTHS[event.month - 1]}")
        assert body["phone_masked"] == "+7 (916) ***-**-67"
        assert body["email_masked"] == "an***@mail.ru"
        assert body["estimate"]["price_from"] == 27_000

        async with SessionLocal() as session:
            row = await session.get(ConsultationRequest, body["id"])
            assert row.design_id == design_id and row.filling_id is None
            assert row.occasion is RequestOccasion.WEDDING
            assert row.extras == [
                {"name": "Свечи", "price": 200, "from": True},
                {"name": "Открытка", "price": 150, "from": False},
            ]
            assert row.estimate == {
                "weight_kg": "6.0",
                "tiers": 3,
                "price_per_kg": 4500,
                "price_from": 27000,
            }
        # Письмо-копия собрано и ушло бы в фоне
        [mail] = emails
        assert mail.to == "anna.zayavka@mail.ru" and mail.number == body["number"]
        assert mail.extras == ["Свечи", "Открытка"]
        subject, text, html = consultation_email.render(mail)
        assert body["number"] in subject and "Белые пионы" in text and "27" in html
    finally:
        await _cleanup(body["id"])


@pytest.mark.parametrize("count", [0, 5])
async def test_request_with_own_samples(client, stored, emails, clean_settings, count) -> None:
    saved, _ = stored
    files = [("references", (f"p{i}.jpg", _jpeg_with_exif(), "image/jpeg")) for i in range(count)]
    response = await client.post(CONSULTATIONS, data=_form(guests_count="20"), files=files or None)
    assert response.status_code == 201, response.text
    body = response.json()
    try:
        # Свой дизайн — по классической цене: 3 кг × 3 200 ₽
        assert body["title"].startswith("Свой дизайн, свадьба")
        assert body["estimate"]["price_from"] == 9_600
        assert len(saved) == count
        async with SessionLocal() as session:
            images = (
                await session.scalars(
                    select(ConsultationImage).where(ConsultationImage.request_id == body["id"])
                )
            ).all()
        assert sorted(image.storage_key for image in images) == sorted(saved)
        assert all(key.startswith("references/") for key in saved)
        for webp in saved.values():
            # WEBP без EXIF: ни модели камеры, ни геометки
            image = Image.open(io.BytesIO(webp))
            assert image.format == "WEBP"
            assert not image.getexif() and "exif" not in image.info
    finally:
        await _cleanup(body["id"])


async def test_six_files_and_bad_type_are_rejected(client, stored, clean_settings) -> None:
    saved, _ = stored
    six = [("references", (f"p{i}.jpg", _jpeg_with_exif(), "image/jpeg")) for i in range(6)]
    response = await client.post(CONSULTATIONS, data=_form(), files=six)
    assert response.status_code == 422
    assert "5 фото" in response.text

    # Тип — по содержимому: «png» с текстом внутри не картинка. Хорошие файлы
    # рядом с плохим тоже не попадают в хранилище
    files = [
        ("references", ("ok.jpg", _jpeg_with_exif(), "image/jpeg")),
        ("references", ("photo.png", b"<script>alert(1)</script>", "image/png")),
    ]
    response = await client.post(CONSULTATIONS, data=_form(), files=files)
    assert response.status_code == 400
    assert saved == {}


async def test_heic_is_accepted(client, stored, emails, clean_settings) -> None:
    pillow_heif = pytest.importorskip("pillow_heif")
    buffer = io.BytesIO()
    try:
        pillow_heif.from_pillow(Image.new("RGB", (32, 32), (10, 200, 30))).save(buffer, quality=60)
    except Exception:  # noqa: BLE001 — сборка libheif без кодировщика: проверять нечем
        pytest.skip("libheif без кодировщика HEIC")
    response = await client.post(
        CONSULTATIONS,
        data=_form(),
        files=[("references", ("IMG_0001.HEIC", buffer.getvalue(), "image/heic"))],
    )
    assert response.status_code == 201, response.text
    await _cleanup(response.json()["id"])


async def test_date_earlier_than_lead_days(client, stored, clean_settings) -> None:
    early = (local_today() + timedelta(days=4)).isoformat()
    response = await client.post(CONSULTATIONS, data=_form(event_date=early))
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["message"] == "Выберите дату не раньше чем через 5 дней"
    assert detail["earliest_date"] == (local_today() + timedelta(days=5)).isoformat()


async def test_design_minimum_guests_is_enforced_on_server(
    client, designs, stored, emails, clean_settings
):
    design_id, _ = designs["wedding"]
    rejected = await client.post(
        CONSULTATIONS, data=_form(design_id=str(design_id), guests_count="1")
    )
    assert rejected.status_code == 422
    assert rejected.json()["detail"]["field"] == "guests_count"
    for guests, extra in [(40, {"design_id": str(design_id)}), (1, {})]:
        accepted = await client.post(CONSULTATIONS, data=_form(guests_count=str(guests), **extra))
        assert accepted.status_code == 201
        await _cleanup(accepted.json()["id"])


@pytest.mark.parametrize("stage", ["second_write", "flush", "commit"])
async def test_failed_request_removes_private_photos(client, clean_settings, monkeypatch, stage):
    from fastapi import HTTPException
    from sqlalchemy.ext.asyncio import AsyncSession

    saved = []
    original_put = storage.put_webp
    original_flush = AsyncSession.flush

    async def put(webp, prefix):
        if stage == "second_write" and saved:
            raise HTTPException(status_code=502, detail="Ошибка записи")
        key = await original_put(webp, prefix)
        saved.append(key)
        return key

    async def flush(db, *args, **kwargs):
        if any(isinstance(item, ConsultationRequest) for item in db.new):
            raise RuntimeError("Тест отказа транзакции")
        return await original_flush(db, *args, **kwargs)

    async def commit(db):
        raise RuntimeError("Тест отказа транзакции")

    with monkeypatch.context() as patch:
        patch.setattr(storage, "put_webp", put)
        if stage == "flush":
            patch.setattr(AsyncSession, "flush", flush)
        elif stage == "commit":
            patch.setattr(AsyncSession, "commit", commit)
        files = [("references", (f"p{i}.jpg", _jpeg_with_exif(), "image/jpeg")) for i in range(2)]
        if stage == "second_write":
            assert (await client.post(CONSULTATIONS, data=_form(), files=files)).status_code == 502
        else:
            with pytest.raises(RuntimeError, match="отказа транзакции"):
                await client.post(CONSULTATIONS, data=_form(), files=files)
    assert len(saved) == (1 if stage == "second_write" else 2)
    assert all([await storage.object_size(key) is None for key in saved])


@pytest.mark.parametrize(
    "overrides",
    [
        {"occasion": ""},  # повод обязателен
        {"guests_count": "0"},  # гостей — от 1
        {"email": "anna@"},
        {"consent_pd": "false"},
        {"is_vip": "true"},
        {"extras": ["Фейерверк"]},
    ],
)
async def test_request_validation(client, stored, clean_settings, overrides) -> None:
    response = await client.post(CONSULTATIONS, data=_form(**overrides))
    assert response.status_code == 422, response.text


async def test_journal_has_no_personal_data(client, stored, emails, clean_settings) -> None:
    response = await client.post(CONSULTATIONS, data=_form())
    body = response.json()
    try:
        async with SessionLocal() as session:
            entry = await session.scalar(
                select(AuditLogEntry).where(
                    AuditLogEntry.entity == "consultation",
                    AuditLogEntry.entity_id == str(body["id"]),
                )
            )
        dumped = json.dumps(entry.details, ensure_ascii=False)
        for secret in ("Анна", "Заявкина", "1234567", "zayavka", "mail.ru"):
            assert secret not in dumped
        assert entry.details["number"] == body["number"]
    finally:
        await _cleanup(body["id"])


async def test_retention_deletes_email_and_sample_files(stored) -> None:
    _, deleted = stored
    async with SessionLocal() as session:
        row = ConsultationRequest(
            number=f"З-T-{uuid.uuid4().hex[:6]}",
            name="Мария",
            phone="+79007654321",
            email="maria@mail.ru",
            consent_pd=True,
            source=ConsultationSource.CUSTOM_CAKE,
            status=ConsultationStatus.COMPLETED,
            images=[
                ConsultationImage(storage_key="references/one.webp", order=0),
                ConsultationImage(storage_key="references/two.webp", order=1),
            ],
        )
        session.add(row)
        await session.flush()
        row.created_at = retention_cutoff() - timedelta(days=1)
        row_id = row.id
        await session.commit()

    async with SessionLocal() as session:
        await retention.purge_expired(session)
        assert await session.get(ConsultationRequest, row_id) is None
        assert (
            await session.scalar(
                select(ConsultationImage).where(ConsultationImage.request_id == row_id)
            )
        ) is None
    assert sorted(deleted) == ["references/one.webp", "references/two.webp"]


async def test_filling_has_dietary_and_short_description(client) -> None:
    async with SessionLocal() as session:
        filling = Filling(
            name=f"Тест {uuid.uuid4().hex[:6]}",
            description="Тонкие коржи на сгущёнке и лёгкий сливочный крем",
            short_description="Тонкие коржи на сгущёнке",
            dietary=["low_sugar"],
            image_key="fillings/x.webp",
            price_per_kg=Decimal("2200"),
            order=-100,
        )
        session.add(filling)
        await session.commit()
        filling_id = filling.id
    try:
        items = (await client.get("/api/v1/custom-cakes/fillings")).json()
        item = next(i for i in items if i["id"] == filling_id)
        assert item["short_description"] == "Тонкие коржи на сгущёнке"
        assert item["dietary_labels"] == ["Сниженный сахар"]
    finally:
        async with SessionLocal() as session:
            await session.execute(delete(Filling).where(Filling.id == filling_id))
            await session.commit()


# --- Миграция ---


async def test_migration_moves_reference_and_image() -> None:
    """Старый `reference_image_key` переезжает в `consultation_images`, фото дизайна —
    в `custom_cake_images`, повод «корпоратив» — в «Юбилей и корпоратив»; откат
    возвращает всё обратно. На отдельной временной базе."""
    url = os.environ["DATABASE_URL"]
    name = f"abrikosova_mig_{uuid.uuid4().hex[:6]}"
    plain = url.replace("postgresql+asyncpg://", "postgresql://")
    admin_url = plain.rsplit("/", 1)[0] + "/postgres"
    db_url = plain.rsplit("/", 1)[0] + f"/{name}"
    env = os.environ | {"DATABASE_URL": url.rsplit("/", 1)[0] + f"/{name}"}

    def alembic(*args: str) -> None:
        subprocess.run(["alembic", *args], env=env, check=True, capture_output=True)

    admin = await asyncpg.connect(admin_url)
    await admin.execute(f'CREATE DATABASE "{name}"')
    try:
        await asyncio.to_thread(alembic, "upgrade", "5db61b99e03c")
        db = await asyncpg.connect(db_url)
        try:
            await db.execute(
                "INSERT INTO custom_cakes (title, description, price_from, image_key, is_active,"
                " \"order\") VALUES ('Старый', '', 5000, 'custom-cakes/old.webp', true, 0)"
            )
            await db.execute(
                "INSERT INTO consultation_requests (name, phone, consent_pd, source, status,"
                " occasion, reference_image_key, created_at, updated_at) VALUES ('Аня',"
                " '+79001234567', true, 'custom_cake', 'new', 'corporate', 'references/r.webp',"
                " now(), now())"
            )
        finally:
            await db.close()

        await asyncio.to_thread(alembic, "upgrade", "head")
        db = await asyncpg.connect(db_url)
        try:
            row = await db.fetchrow(
                "SELECT r.occasion::text AS occasion, r.number, i.storage_key"
                " FROM consultation_requests r JOIN consultation_images i ON i.request_id = r.id"
            )
            assert row["storage_key"] == "references/r.webp"
            assert row["occasion"] == "anniversary_corporate"
            assert row["number"].startswith("З-")
            cake = await db.fetchrow(
                "SELECT c.slug, i.storage_key, i.role::text AS role FROM custom_cakes c"
                " JOIN custom_cake_images i ON i.cake_id = c.id"
            )
            assert cake["storage_key"] == "custom-cakes/old.webp" and cake["role"] == "whole"
            assert cake["slug"].startswith("cake-")
        finally:
            await db.close()

        await asyncio.to_thread(alembic, "downgrade", "5db61b99e03c")
        db = await asyncpg.connect(db_url)
        try:
            assert (
                await db.fetchval("SELECT reference_image_key FROM consultation_requests")
                == "references/r.webp"
            )
            assert (
                await db.fetchval("SELECT image_key FROM custom_cakes") == "custom-cakes/old.webp"
            )
        finally:
            await db.close()
    finally:
        await admin.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')
        await admin.close()
