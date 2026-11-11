"""Редактирование правовых документов через страницу `legal`."""

import pytest
from pydantic import ValidationError
from sqlalchemy import select

from app.core.db import SessionLocal
from app.models import AuditLogEntry, PageKey
from app.schemas.pages import LegalContent
from app.seed import PAGE_CONTENT


def test_legal_seed_and_schema():
    content = LegalContent.model_validate(PAGE_CONTENT[PageKey.LEGAL])
    assert str(content.privacy_revised_at) == "2026-10-01"
    # Не дата — ошибка, а не строка «как ввели» на сайте
    with pytest.raises(ValidationError):
        LegalContent(terms_revised_at="1 октября")
    # Опечатка в ключе не сохраняется молча
    with pytest.raises(ValidationError):
        LegalContent.model_validate({"privacy_revised": "2026-10-01"})


async def test_legal_editor_round_trip(client, admin_headers):
    endpoint = "/api/v1/admin/pages/legal"
    original = (await client.get(endpoint, headers=admin_headers)).json()
    original.pop("page_key")
    sections = [{"title": "Тестовый раздел", "text": "Первый абзац.\n\nВторой абзац."}]
    changed = {
        **original,
        "content": {
            **original["content"],
            "consent_revised_at": "2026-11-15",
            "consent_sections": sections,
        },
    }
    try:
        response = await client.put(endpoint, headers=admin_headers, json=changed)
        assert response.status_code == 200, response.text
        public = (await client.get("/api/v1/pages/legal")).json()["content"]
        assert public["consent_revised_at"] == "2026-11-15"
        assert public["consent_sections"] == sections
        assert public["privacy_revised_at"] == original["content"]["privacy_revised_at"]

        broken = {**original, "content": {**original["content"], "terms_revised_at": "завтра"}}
        response = await client.put(endpoint, headers=admin_headers, json=broken)
        assert response.status_code == 422

        broken = {**changed, "content": {**changed["content"], "consent_sections": []}}
        response = await client.put(endpoint, headers=admin_headers, json=broken)
        assert response.status_code == 422
        public = (await client.get("/api/v1/pages/legal")).json()["content"]
        assert public["consent_sections"] == sections
    finally:
        response = await client.put(endpoint, headers=admin_headers, json=original)
        assert response.status_code == 200, response.text

    # Сохранение — в журнале (011c)
    async with SessionLocal() as session:
        entry = await session.scalar(
            select(AuditLogEntry)
            .where(AuditLogEntry.entity == "page", AuditLogEntry.entity_id == "legal")
            .order_by(AuditLogEntry.id.desc())
        )
    assert entry is not None
