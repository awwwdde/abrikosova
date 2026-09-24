"""Часовой пояс кондитерской (`BUSINESS_TIMEZONE`).

От него зависит, какой день считается «сегодня» для покупателя. Ошибка
в настройке должна быть видна при деплое, а не на первом заказе.
"""

import os
import subprocess
import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.core import clock
from app.core.config import Settings

API_ROOT = Path(__file__).resolve().parent.parent


def test_unknown_business_timezone_is_rejected() -> None:
    with pytest.raises(ValidationError, match="BUSINESS_TIMEZONE"):
        Settings(business_timezone="Europe/Moskva")


def test_app_does_not_start_with_unknown_business_timezone() -> None:
    """Приложение падает на импорте — то есть при старте uvicorn,
    а не когда покупатель впервые оформит заказ."""
    env = os.environ | {"BUSINESS_TIMEZONE": "Nowhere/Nothing", "SCHEDULER_ENABLED": "false"}

    result = subprocess.run(
        [sys.executable, "-c", "import app.main"],
        cwd=API_ROOT,
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )

    assert result.returncode != 0
    assert "Неизвестный часовой пояс BUSINESS_TIMEZONE" in result.stderr


def test_local_now_follows_business_not_scheduler_timezone(monkeypatch) -> None:
    """Сдвиг времени ночных задач не должен менять «сегодня» для покупателя."""
    settings = Settings(business_timezone="Asia/Vladivostok", scheduler_timezone="UTC")
    monkeypatch.setattr(clock, "get_settings", lambda: settings)

    assert str(clock.local_now().tzinfo) == "Asia/Vladivostok"


def test_unknown_scheduler_timezone_is_rejected() -> None:
    """Тот же валидатор на поясе планировщика — и в тексте именно его переменная."""
    with pytest.raises(ValidationError, match="SCHEDULER_TIMEZONE"):
        Settings(scheduler_timezone="Europe/Moskva")
