"""Схемы авторизации и управления пользователями админки."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints

from app.models.enums import AdminRole

# Новый пароль. Схема ограничивает только длину сверху (защита Argon2 от мегабайтных
# строк), остальное — длина от 12, список распространённых, e-mail внутри — проверяет
# app/core/password_policy.py: у неё понятные тексты ошибок, и она знает e-mail
# сотрудника, которого схема не видит (например, при сбросе пароля владельцем).
Password = Annotated[str, Field(min_length=1, max_length=128)]

# Имя сотрудника в админке: «Елена Абрикосова», «Ольга Тихонова» (011c)
StaffName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


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
    name: str
    role: AdminRole
    is_active: bool
    created_at: datetime


class AdminCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    name: StaffName
    password: Password
    role: AdminRole = AdminRole.MANAGER


class AdminUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: StaffName | None = None
    role: AdminRole | None = None
    is_active: bool | None = None
    # Новый пароль сотруднику от владельца; все сессии сотрудника отзываются
    password: Password | None = None


class ProfileUpdate(BaseModel):
    """Что сотрудник меняет в своём профиле сам. Роль и активность — только владелец."""

    model_config = ConfigDict(extra="forbid")

    name: StaffName


class PasswordChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: Annotated[str, Field(min_length=1, max_length=128)]
    new_password: Password


class SessionOut(BaseModel):
    """Вход в админку для списка «Где выполнен вход»."""

    id: str
    device: str
    ip: str | None
    created_at: datetime
    last_used_at: datetime
    current: bool
