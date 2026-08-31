from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Конфигурация приложения. Значения — только из окружения/.env, никогда не из литералов в коде
    (см. new/spec/00-overview.md, принцип 2, и ANALYSIS.md, п. 2.1.1-2.1.2)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"
    debug: bool = False

    database_url: str = "postgresql+asyncpg://abrikosova:abrikosova@localhost:5432/abrikosova"
    redis_url: str = "redis://localhost:6379/0"

    # CORS: адреса фронтенда, которым разрешено ходить в API
    cors_origins: list[str] = ["http://localhost:3000"]

    # JWT (Этап 3) — секрет обязателен на проде, дефолт только для локальной разработки
    jwt_secret: str = "dev-only-not-for-production"
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 30

    # Учётная запись owner для первого входа в админку. Пароль живёт только в окружении
    # и меняется из самой админки после первого входа (04-admin-panel.md, «Вход и защита»).
    admin_seed_email: str | None = None
    admin_seed_password: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
