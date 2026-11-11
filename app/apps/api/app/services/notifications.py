"""E-mail-уведомления администратору.

Основной обязательный канал по договору (раздел 5.3) — в отличие от старого кода,
где был только Telegram через прокси с захардкоженными кредами (ANALYSIS.md, п. 2.1.10).

Отправка вызывается через FastAPI BackgroundTasks: ответ клиенту не ждёт SMTP,
отдельный воркер и очередь не нужны (00-overview.md, примечание про фоновые задачи).

Для заявок владелец выбирает почтовые ящики в админке. В уведомлении только
номер заявки и ссылка на карточку, для открытия которой нужен вход.
"""

import asyncio
import logging
import smtplib
import ssl
from email.message import EmailMessage

from sqlalchemy.exc import SQLAlchemyError

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.services import request_mail

logger = logging.getLogger(__name__)


def _send(subject: str, body: str) -> None:
    settings = get_settings()

    if not (settings.smtp_host and settings.notify_email_to):
        logger.warning("SMTP не настроен — уведомление «%s» не отправлено", subject)
        return

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from or settings.smtp_user or "noreply@localhost"
    message["To"] = settings.notify_email_to
    message.set_content(body)

    try:
        context = ssl.create_default_context()
        if settings.smtp_port == 465:
            client = smtplib.SMTP_SSL(
                settings.smtp_host, settings.smtp_port, timeout=15, context=context
            )
        else:
            client = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15)
        with client as smtp:
            if settings.smtp_port != 465:
                smtp.starttls(context=context)
            if settings.smtp_user and settings.smtp_password:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(message)
    except (smtplib.SMTPException, OSError, UnicodeError) as exc:
        logger.warning("Не удалось отправить уведомление «%s» (%s)", subject, type(exc).__name__)
        return

    logger.info("Отправлено уведомление «%s»", subject)


def notify_new_order(
    order_number: str, total: str, phone: str, delivery: str, when: str | None = None
) -> None:
    _send(
        subject=f"Новый заказ {order_number}",
        body=(
            f"Поступил новый заказ {order_number}.\n"
            f"Сумма: {total} ₽\n"
            f"Способ получения: {delivery}\n"
            f"Когда: {when or 'не указано'}\n"
            f"Телефон клиента: {phone}\n\n"
            f"Детали — в админ-панели, раздел «Заказы»."
        ),
    )


async def notify_new_request(request_id: int) -> None:
    site_url = get_settings().site_url.rstrip("/")
    subject = f"Новая заявка #{request_id}"
    body = (
        f"Поступила новая заявка #{request_id}.\n\n"
        f"Открыть в админке: {site_url}/admin/consultations/{request_id}"
    )
    try:
        async with SessionLocal() as session:
            mailboxes = await request_mail.load_for_delivery(session)
    except SQLAlchemyError:
        logger.error("Не удалось загрузить настройки почты для заявок")
        return
    if mailboxes is None:
        await asyncio.to_thread(_send, subject, body)
    elif mailboxes:
        await asyncio.gather(
            *(asyncio.to_thread(request_mail.send, data, subject, body) for data in mailboxes)
        )
