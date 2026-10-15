"""Контракт диска хостинга и защита секрета Telegram в журнале."""

import logging

import httpx
import pytest

from app.core.config import Settings
from app.core.logging import setup_logging
from app.services import telegram


def test_database_storage_is_default():
    assert Settings().media_storage == "database"


def test_unknown_storage_is_rejected():
    with pytest.raises(ValueError):
        Settings(media_storage="unknown")


def test_telegram_http_logging_does_not_expose_token(monkeypatch, caplog):
    token = "123:TEST_SECRET"
    settings = Settings(telegram_bot_token=token, telegram_chat_id="123")
    monkeypatch.setattr(telegram, "get_settings", lambda: settings)
    original = httpx.Client
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json={"ok": True}))
    monkeypatch.setattr(httpx, "Client", lambda **kwargs: original(transport=transport))
    for name in ("httpx", "httpcore"):
        monkeypatch.setattr(logging.getLogger(name), "level", logging.INFO)
    setup_logging()
    with caplog.at_level(logging.INFO):
        telegram.notify_new_request(1, "test", "+70000000000", "Тест")
    assert "отправлено в Telegram" in caplog.text
    assert token not in caplog.text
    assert "api.telegram.org/bot" not in caplog.text
