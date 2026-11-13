"""Настройки почты заявок и отправка через SMTP, заданный владельцем."""

import asyncio
import base64
import hmac
import ipaddress
import json
import logging
import smtplib
import socket
import ssl
from email.message import EmailMessage
from uuid import UUID, uuid4

from cryptography.fernet import Fernet, InvalidToken
from pydantic import ValidationError
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import SiteSetting
from app.schemas.request_mail import RequestMailboxIn, RequestMailboxOut, RequestMailSettings

logger = logging.getLogger(__name__)
KEY = "request_mailboxes"
MAX_MAILBOXES = 10


def _cipher() -> Fernet:
    # Отдельный ключ для SMTP, выведенный из серверного секрета. Дампа БД для
    # расшифровки недостаточно. Секрет должен оставаться одинаковым при деплоях.
    secret = get_settings().jwt_secret.encode()
    key = hmac.digest(secret, b"abrikosova/request-mailboxes/v1", "sha256")
    return Fernet(base64.urlsafe_b64encode(key))


def _decrypt(token: str) -> RequestMailboxIn | None:
    try:
        return RequestMailboxIn.model_validate_json(_cipher().decrypt(token.encode()))
    except (InvalidToken, ValidationError):
        logger.error("Не удалось прочитать сохранённые настройки SMTP для заявок")
        return None


async def _settings(session: AsyncSession, *, lock: bool = False) -> SiteSetting | None:
    if lock:
        await session.execute(
            insert(SiteSetting).values(key=KEY, value={}).on_conflict_do_nothing()
        )
    return await session.get(SiteSetting, KEY, with_for_update=lock)


async def read(session: AsyncSession) -> RequestMailSettings:
    row = await _settings(session)
    settings = get_settings()
    mailboxes = []
    for mailbox_id, token in (row.value if row else {}).items():
        data = _decrypt(token)
        mailboxes.append(
            RequestMailboxOut(id=UUID(mailbox_id), recipient=data.recipient if data else None)
        )
    return RequestMailSettings(
        mailboxes=mailboxes,
        server_mail_enabled=bool(row is None and settings.smtp_host and settings.notify_email_to),
    )


async def add(session: AsyncSession, data: RequestMailboxIn) -> RequestMailboxOut:
    row = await _settings(session, lock=True)
    assert row is not None
    if len(row.value) >= MAX_MAILBOXES:
        raise ValueError("Можно добавить до 10 адресов")
    for token in row.value.values():
        saved = _decrypt(token)
        if saved and saved.recipient.casefold() == data.recipient.casefold():
            raise ValueError("Этот адрес уже добавлен")
    mailbox_id = uuid4()
    payload = data.model_dump(exclude={"password"})
    payload["password"] = data.password.get_secret_value()
    token = _cipher().encrypt(json.dumps(payload).encode()).decode()
    row.value = {**row.value, str(mailbox_id): token}
    return RequestMailboxOut(id=mailbox_id, recipient=data.recipient)


async def remove(session: AsyncSession, mailbox_id: UUID) -> bool:
    row = await session.get(SiteSetting, KEY, with_for_update=True)
    key = str(mailbox_id)
    if row is None or key not in row.value:
        return False
    row.value = {key_: value for key_, value in row.value.items() if key_ != key}
    return True


async def load_for_delivery(session: AsyncSession) -> list[RequestMailboxIn] | None:
    row = await _settings(session)
    if row is None:
        return None
    return [data for token in row.value.values() if (data := _decrypt(token)) is not None]


def _public_address(host: str, port: int) -> str:
    addresses = {
        record[4][0] for record in socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    }
    for address in addresses:
        ip = ipaddress.ip_address(address)
        if not ip.is_global or ip.is_multicast or ip.is_reserved or "%" in address:
            raise OSError("SMTP host must resolve to public addresses")
        if isinstance(ip, ipaddress.IPv6Address) and (ip.sixtofour or ip.teredo):
            raise OSError("SMTP host must not use an IPv6 transition address")
    if not addresses:
        raise OSError("SMTP host has no addresses")
    # IPv4 предпочтителен на хостингах без маршрута IPv6.
    return min(addresses, key=lambda address: (":" in address, address))


class _PublicSMTP(smtplib.SMTP):
    def __init__(self, host: str, port: int):
        self._address = _public_address(host, port)
        self._tls_context = ssl.create_default_context()
        super().__init__(host, port, timeout=10)

    def _get_socket(self, host: str, port: int, timeout: float) -> socket.socket:
        # Подключаемся к проверенному IP без повторного DNS-запроса, а сертификат
        # сверяем с введённым именем сервера и для TLS, и для STARTTLS.
        connection = socket.create_connection((self._address, port), timeout)
        if port == 465:
            try:
                return self._tls_context.wrap_socket(connection, server_hostname=host)
            except OSError:
                connection.close()
                raise
        return connection

    def authenticate(self, data: RequestMailboxIn) -> None:
        if data.port == 587:
            self.starttls(context=self._tls_context)
        self.login(data.username, data.password.get_secret_value())


async def verify(data: RequestMailboxIn) -> None:
    def connect() -> None:
        with _PublicSMTP(data.host, data.port) as smtp:
            smtp.authenticate(data)
            code, reply = smtp.mail(data.sender)
            if code != 250:
                raise smtplib.SMTPSenderRefused(code, reply, data.sender)
            smtp.rset()

    await asyncio.to_thread(connect)


def send(data: RequestMailboxIn, subject: str, body: str, html: str) -> None:
    message = EmailMessage()
    message["From"] = data.sender
    message["To"] = data.recipient
    message["Subject"] = subject
    message.set_content(body)
    message.add_alternative(html, subtype="html")
    try:
        with _PublicSMTP(data.host, data.port) as smtp:
            smtp.authenticate(data)
            smtp.send_message(message)
    except (smtplib.SMTPException, OSError, UnicodeError) as exc:
        # SMTP-сервер может отразить логин, адрес или пароль в тексте ошибки.
        logger.warning("SMTP-уведомление о заявке не отправлено (%s)", type(exc).__name__)
