"""Конфигурация приложения.

Значения — только из окружения/.env, никогда не из литералов в коде
(00-overview.md, принцип 2, и ANALYSIS.md, п. 2.1.1-2.1.2: в старом проекте
SECRET_KEY и рабочие креды прокси лежали в репозитории открытым текстом).
"""

import logging
from functools import lru_cache
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import ValidationInfo, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

DEV_JWT_SECRET = "dev-only-not-for-production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"
    debug: bool = False
    # Поток SQL-запросов в лог. Отдельно от DEBUG: подробные логи приложения нужны
    # часто, а SQL на каждый запрос — только когда разбираешься с конкретным запросом.
    sql_echo: bool = False

    database_url: str = "postgresql+asyncpg://abrikosova:abrikosova@localhost:5432/abrikosova"
    redis_url: str = "redis://localhost:6379/0"

    # CORS: закрытый список адресов фронтенда. Wildcard недопустим — запросы к API
    # ходят с credentials (cookie корзины и refresh-токен).
    cors_origins: list[str] = ["http://localhost:3000"]

    # --- JWT ---
    jwt_secret: str = DEV_JWT_SECRET
    jwt_issuer: str = "abrikosova-api"
    jwt_audience: str = "abrikosova-admin"
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 30

    # --- Cookies ---
    # secure=False только для http://localhost; на проде обязателен HTTPS.
    cookie_secure: bool = False
    # Lax, а не Strict: при Strict cookie не приезжает при переходе на сайт
    # по внешней ссылке, и корзина у вернувшегося пользователя выглядит пустой.
    cookie_samesite: str = "lax"
    cookie_domain: str | None = None
    cart_cookie_name: str = "cart_id"
    refresh_cookie_name: str = "refresh_token"
    cart_ttl_days: int = 30

    # --- Учётная запись owner для первого входа ---
    # Пароль живёт только в окружении и меняется из админки после первого входа.
    admin_seed_email: str | None = None
    admin_seed_password: str | None = None

    # --- Уведомления ---
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None
    notify_email_to: str | None = None

    # --- Планировщик: ночной бэкап и очистка ПДн ---
    # Выключается в тестах и там, где несколько экземпляров приложения
    scheduler_enabled: bool = True
    scheduler_timezone: str = "Europe/Moscow"

    # --- Часовой пояс кондитерской ---
    # «Какой сейчас день у кондитерской»: от него считаются дата в номере заказа,
    # проверка желаемой даты, срок изготовления и дата события в заявке.
    # Не путать со scheduler_timezone — тот отвечает только за то, когда запускать
    # ночные задачи. Совпадают они сейчас случайно: перенос бэкапа на другой пояс
    # не должен молча сдвигать «сегодня» для покупателя.
    business_timezone: str = "Europe/Moscow"

    # --- Telegram: опциональный дополнительный канал уведомлений ---
    # Пустой токен полностью выключает канал.
    telegram_bot_token: str | None = None
    telegram_chat_id: str | None = None
    # Обязателен на практике: api.telegram.org из российских сетей, включая
    # Timeweb Cloud, напрямую недоступен. Формат: http://user:pass@host:port
    # или socks5://user:pass@host:port
    telegram_proxy_url: str | None = None

    # --- Сброс кэша фронтенда после правок в админке ---
    web_revalidate_url: str | None = None
    revalidate_secret: str | None = None

    # --- Объектное хранилище (S3-совместимое) ---
    s3_endpoint_url: str | None = None
    s3_bucket: str = "abrikosova"
    s3_access_key: str | None = None
    s3_secret_key: str | None = None
    s3_region: str = "ru-1"
    # Базовый адрес, по которому изображения отдаются браузеру. Отличается от
    # endpoint: наружу может смотреть CDN или публичный домен бакета.
    s3_public_url: str | None = None

    # --- 152-ФЗ: обработка персональных данных ---
    # Оператор ПДн — реквизиты идут в уведомления и в текст согласия.
    pd_operator_name: str = "ИП Мельниченко Е.А."
    # Срок хранения заявок и заказов с ПДн. Хранение «бессрочно, на всякий случай»
    # противоречит принципу минимизации: данные удаляются, когда цель обработки
    # (обработка заказа) достигнута. Значение согласуется с заказчиком/юристом.
    pd_retention_days: int = 365

    @field_validator("jwt_secret", mode="before")
    @classmethod
    def _default_jwt_secret(cls, value: str | None) -> str:
        """Пустая переменная в .env — это «не задано», а не «пустой секрет».

        Иначе приложение молча подписывало бы токены пустым ключом.
        Для прода пустое значение всё равно не пройдёт проверку ниже.
        """
        return value or DEV_JWT_SECRET

    @field_validator("business_timezone", "scheduler_timezone")
    @classmethod
    def _known_timezone(cls, value: str, info: ValidationInfo) -> str:
        """Опечатка в имени пояса должна ронять приложение при старте.

        Иначе ZoneInfoNotFoundError всплыл бы только на первом заказе или
        заявке — то есть у покупателя, а не у того, кто деплоил, — или
        невнятной ошибкой APScheduler при запуске планировщика.
        """
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            env_name = (info.field_name or "").upper()
            raise ValueError(f"Неизвестный часовой пояс {env_name}: {value!r}") from exc
        return value

    @model_validator(mode="after")
    def _validate_production_secrets(self) -> "Settings":
        """На проде не даём стартовать с dev-секретом или без HTTPS-кук.

        Это ровно та ошибка, которая была в старом проекте: DEBUG=True и
        захардкоженный SECRET_KEY уехали в боевой репозиторий.
        """
        if self.environment != "production":
            return self

        problems: list[str] = []
        if self.jwt_secret == DEV_JWT_SECRET or len(self.jwt_secret) < 32:
            problems.append("JWT_SECRET должен быть задан и содержать не менее 32 символов")
        if not self.cookie_secure:
            problems.append("COOKIE_SECURE должен быть true на проде (cookie только по HTTPS)")
        if self.debug:
            problems.append("DEBUG должен быть false на проде")
        if any(origin.startswith("http://") for origin in self.cors_origins):
            problems.append("CORS_ORIGINS на проде не должен содержать http://")

        if problems:
            raise ValueError("Небезопасная конфигурация прода: " + "; ".join(problems))

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
