import asyncio
import json
import socket
from uuid import uuid4

import pytest
from sqlalchemy import delete

from app.core.db import SessionLocal
from app.models import SiteSetting
from app.services import notifications, request_mail

ENDPOINT = "/api/v1/admin/consultation-mailboxes"
PAYLOAD = {
    "host": "smtp.example.com",
    "port": 465,
    "username": "test-login",
    "password": "test-smtp-app-password",
    "sender": "sender@example.com",
    "recipient": "first@example.com",
}


@pytest.fixture
async def isolated_mail_settings(monkeypatch):
    key = f"test-mailboxes-{uuid4().hex}"
    monkeypatch.setattr(request_mail, "KEY", key)
    yield key
    async with SessionLocal() as session:
        await session.execute(delete(SiteSetting).where(SiteSetting.key == key))
        await session.commit()


async def test_owner_adds_two_encrypted_mailboxes_and_removes_one(
    client, admin_headers, manager_headers, isolated_mail_settings, monkeypatch
):
    async def verify(_data):
        pass

    delivered = []
    monkeypatch.setattr(request_mail, "verify", verify)
    monkeypatch.setattr(
        request_mail, "send", lambda data, _subject, body: delivered.append((data.recipient, body))
    )

    assert (await client.get(ENDPOINT, headers=manager_headers)).status_code == 403
    assert (await client.post(ENDPOINT, headers=manager_headers, json=PAYLOAD)).status_code == 403
    invalid = await client.post(
        ENDPOINT, headers=admin_headers, json=PAYLOAD | {"password": [PAYLOAD["password"]]}
    )
    assert invalid.status_code == 422
    assert PAYLOAD["password"] not in invalid.text

    responses = await asyncio.gather(
        client.post(ENDPOINT, headers=admin_headers, json=PAYLOAD),
        client.post(
            ENDPOINT, headers=admin_headers, json=PAYLOAD | {"recipient": "second@example.com"}
        ),
    )
    assert all(response.status_code == 201 for response in responses)
    first, second = (response.json() for response in responses)
    listed = await client.get(ENDPOINT, headers=admin_headers)
    assert listed.headers["Cache-Control"] == "no-store"
    assert {mailbox["id"] for mailbox in listed.json()["mailboxes"]} == {first["id"], second["id"]}
    assert set(first) == {"id", "recipient"}
    assert PAYLOAD["password"] not in listed.text
    assert PAYLOAD["username"] not in listed.text
    async with SessionLocal() as session:
        row = await session.get(SiteSetting, isolated_mail_settings)
        stored = json.dumps(row.value)
        for field in ("password", "username", "recipient", "host", "sender"):
            assert PAYLOAD[field] not in stored

    await notifications.notify_new_request(42)
    assert {address for address, _ in delivered} == {"first@example.com", "second@example.com"}
    assert all("/admin/consultations/42" in body for _, body in delivered)
    delivered.clear()

    url = f"{ENDPOINT}/{first['id']}"
    assert (await client.delete(url, headers=manager_headers)).status_code == 403
    assert (await client.delete(url, headers=admin_headers)).status_code == 204
    await notifications.notify_new_request(43)
    assert [address for address, _ in delivered] == ["second@example.com"]


@pytest.mark.parametrize("address", ["127.0.0.1", "10.0.0.1", "169.254.169.254", "::1"])
def test_rejects_hostname_with_private_dns_answer(monkeypatch, address):
    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        lambda *_args, **_kwargs: [(None, None, None, None, (address, 465))],
    )
    with pytest.raises(OSError):
        request_mail._public_address("smtp.example.com", 465)
