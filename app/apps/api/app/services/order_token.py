"""Токен адреса страницы «Заказ принят» (007a): `/order/<номер>?t=<токен>`.

Почему токен, а не просто номер. Номер — дата и 6 шестнадцатеричных знаков: в день
16,7 млн вариантов, и при десятках заказов в день перебор находит чужой заказ за
разумное число запросов. Страница открывается без входа и показывает адрес доставки
и состав — поэтому без токена она отвечает 404, как будто заказа нет.

Токен — `<срок>.<подпись>`: срок в Unix-секундах (7 дней с оформления) и HMAC-SHA256
от номера и срока на `jwt_secret`. Хранить ничего не нужно, подделать без секрета
нельзя, номер из одного заказа к другому не подходит. «Одноразовость» — в смысле
ссылки, выданной один раз после оформления: ссылку можно открыть повторно в течение
7 дней (обновить страницу, вернуться из письма), потом она перестаёт работать.
"""

import base64
import hashlib
import hmac
from datetime import timedelta

from app.core import clock
from app.core.config import get_settings

LIFETIME = timedelta(days=7)


def _signature(order_number: str, expires: int) -> str:
    key = get_settings().jwt_secret.encode()
    digest = hmac.new(key, f"order:{order_number}:{expires}".encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode()


def make(order_number: str) -> str:
    expires = int((clock.utc_now() + LIFETIME).timestamp())
    return f"{expires}.{_signature(order_number, expires)}"


def is_valid(order_number: str, token: str | None) -> bool:
    if not token or "." not in token:
        return False
    raw_expires, signature = token.split(".", 1)
    if not raw_expires.isdigit():
        return False
    expires = int(raw_expires)
    if expires < clock.utc_now().timestamp():
        return False
    return hmac.compare_digest(signature, _signature(order_number, expires))
