"""Хеширование паролей администраторов.

Argon2id — современный дефолт для хранения паролей. Пароль в открытом виде
не хранится и не логируется нигде, включая seed-скрипт.
JWT-часть авторизации добавляется на Этапе 3.
"""

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False
