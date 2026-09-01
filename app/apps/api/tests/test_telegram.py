"""Поведение Telegram-канала.

Проверяем не доставку сообщения (для этого нужен живой бот и прокси), а то,
что канал не ломает основной сценарий: выключён по умолчанию, переживает
недоступность сети и не даёт подделать разметку через данные клиента.
"""

import logging

import httpx
import pytest

from app.core.config import Settings, get_settings
from app.services import telegram


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _configure(monkeypatch, **overrides) -> None:
    base = {"telegram_bot_token": "123:ABC", "telegram_chat_id": "-100500"}
    base.update(overrides)
    settings = Settings(**base)
    monkeypatch.setattr(telegram, "get_settings", lambda: settings)


def test_disabled_without_token(monkeypatch) -> None:
    """Без токена канал молчит и никуда не ходит."""
    settings = Settings(telegram_bot_token=None, telegram_chat_id=None)
    monkeypatch.setattr(telegram, "get_settings", lambda: settings)

    def fail(*args, **kwargs):
        raise AssertionError("Запрос не должен выполняться при выключенном канале")

    monkeypatch.setattr(httpx.Client, "post", fail)

    telegram.notify_new_request(1, "contact_page", "+79001234567", "Иван")


def test_network_failure_does_not_raise(monkeypatch, caplog) -> None:
    """Обрыв соединения (в том числе TLS без прокси) не должен ронять заказ."""
    _configure(monkeypatch)

    def raise_connect_error(*args, **kwargs):
        raise httpx.ConnectError("SSL: UNEXPECTED_EOF_WHILE_READING")

    monkeypatch.setattr(httpx.Client, "post", raise_connect_error)

    with caplog.at_level(logging.WARNING):
        telegram.notify_new_order("20260901-AAA", "2400", "+79001234567", "Самовывоз", "Иван", [])

    assert "TELEGRAM_PROXY_URL" in caplog.text


def test_proxy_is_passed_to_client(monkeypatch) -> None:
    """Адрес прокси попадает в клиент, а не игнорируется."""
    _configure(monkeypatch, telegram_proxy_url="socks5://user:pass@proxy.example:1080")
    captured: dict[str, object] = {}

    original_init = httpx.Client.__init__

    def spy_init(self, *args, **kwargs):
        captured["proxy"] = kwargs.get("proxy")
        original_init(self, *args, **kwargs)

    monkeypatch.setattr(httpx.Client, "__init__", spy_init)
    monkeypatch.setattr(
        httpx.Client,
        "post",
        lambda *a, **kw: httpx.Response(200, request=httpx.Request("POST", "/")),
    )

    telegram.notify_new_request(1, "custom_cake", "+79001234567", "Иван")

    assert captured["proxy"] == "socks5://user:pass@proxy.example:1080"


def test_client_data_is_escaped(monkeypatch) -> None:
    """Имя вида <b>… не должно подделывать разметку сообщения."""
    _configure(monkeypatch)
    sent: dict[str, object] = {}

    def capture(self, url, **kwargs):
        sent.update(kwargs.get("data") or {})
        return httpx.Response(200, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx.Client, "post", capture)

    telegram.notify_new_request(7, "contact_page", "+79001234567", "<b>Админ</b>")

    text = str(sent["text"])
    assert "&lt;b&gt;Админ&lt;/b&gt;" in text
    # Разметка осталась только наша
    assert text.count("<b>") == text.count("</b>") == 4
