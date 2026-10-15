"""Политика паролей сотрудников (задание 011a).

Одна функция на все места, где задаётся пароль: создание сотрудника, сброс
владельцем, смена своего пароля и CLI для владельца. Проверки — локальные, без
внешних сервисов вроде Have I Been Pwned: хостинг в РФ, внешние API ненадёжны,
а отправлять наружу даже префикс хеша пароля лишний раз не хочется.

Правила:
- от 12 до 128 символов. Верхняя граница — чтобы Argon2 не хешировал мегабайты;
- не из списка распространённых (`data/common-passwords.txt`, ~65 тыс. строк).
  Сравнивается и сам пароль, и его «основа» без цифр и знаков по краям:
  «dragonfly2024!» — тот же «dragonfly» с приписанным годом;
- не содержит e-mail сотрудника, его имя до «@», «abrikosova» / «абрикосова»;
- не один повторяющийся символ.
"""

import re
from functools import lru_cache
from pathlib import Path

from fastapi.exceptions import RequestValidationError

MIN_LENGTH = 12
MAX_LENGTH = 128

_COMMON_FILE = Path(__file__).parent / "data" / "common-passwords.txt"
# Слова сайта, которые подбирают в первую очередь
_SITE_WORDS = ("abrikosova", "абрикосова", "abrikosov", "абрикосов")
# Минимальная длина «основы», которую сравниваем со списком: короче — слишком
# много ложных совпадений («admin» есть в любом пароле админа)
_MIN_BASE = 8
_EDGES = re.compile(r"^[\W\d_]+|[\W\d_]+$")


class PasswordPolicyError(ValueError):
    """Пароль не подходит; текст — для человека, показывается в форме как есть."""


@lru_cache
def _common_passwords() -> frozenset[str]:
    lines = _COMMON_FILE.read_text(encoding="utf-8").splitlines()
    return frozenset(line for line in lines if line and not line.startswith("#"))


def validate_password(password: str, *, email: str | None = None) -> None:
    """Бросает PasswordPolicyError, если пароль не подходит."""
    if len(password) < MIN_LENGTH:
        raise PasswordPolicyError(f"Пароль должен быть не короче {MIN_LENGTH} символов")
    if len(password) > MAX_LENGTH:
        raise PasswordPolicyError(f"Пароль должен быть не длиннее {MAX_LENGTH} символов")

    lowered = password.lower()
    if len(set(lowered)) == 1:
        raise PasswordPolicyError("Пароль слишком простой — его легко подобрать")

    if email:
        email = email.lower()
        local = email.split("@", 1)[0]
        if email in lowered or (len(local) >= 3 and local in lowered):
            raise PasswordPolicyError("Пароль не должен содержать e-mail или имя из него")

    if any(word in lowered for word in _SITE_WORDS):
        raise PasswordPolicyError("Пароль не должен содержать название кондитерской")

    common = _common_passwords()
    base = _EDGES.sub("", lowered)
    if lowered in common or (len(base) >= _MIN_BASE and base in common):
        raise PasswordPolicyError("Пароль слишком простой — его легко подобрать")


def as_validation_error(field: str, error: PasswordPolicyError) -> RequestValidationError:
    """Ошибка политики как обычная 422 по полю — форма покажет её у этого поля."""
    return RequestValidationError(
        [{"loc": ("body", field), "msg": str(error), "type": "value_error"}]
    )
