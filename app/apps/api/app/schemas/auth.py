"""Схемы авторизации и управления пользователями админки."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import AdminRole

# Минимальная длина пароля — 12 символов: короткие пароли перебираются даже
# при argon2, а лимит на попытки входа лишь замедляет, но не исключает подбор.
Password = Annotated[str, Field(min_length=12, max_length=128)]


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    # На входе длину не ограничиваем снизу: требование к длине относится к смене
    # пароля, а здесь оно лишь подсказало бы атакующему формат
    password: Annotated[str, Field(min_length=1, max_length=128)]


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class AdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    role: AdminRole
    is_active: bool
    created_at: datetime


class AdminCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: Password
    role: AdminRole = AdminRole.MANAGER


class AdminUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: AdminRole | None = None
    is_active: bool | None = None


class PasswordChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: Annotated[str, Field(min_length=1, max_length=128)]
    new_password: Password
