"""E-mail-уведомления администратору.

Основной обязательный канал по договору (раздел 5.3) — в отличие от старого кода,
где был только Telegram через прокси с захардкоженными кредами (ANALYSIS.md, п. 2.1.10).

Отправка вызывается через FastAPI BackgroundTasks: ответ клиенту не ждёт SMTP,
отдельный воркер и очередь не нужны (00-overview.md, примечание про фоновые задачи).

Для заказов и заявок владелец выбирает почтовые ящики в админке. В уведомлении
только номер и ссылка на карточку, для открытия которой нужен вход.
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
from app.services.order_email import BAKERY, _env

logger = logging.getLogger(__name__)


def _send(subject: str, body: str, html: str) -> None:
    settings = get_settings()

    if not (settings.smtp_host and settings.notify_email_to):
        logger.warning("SMTP не настроен — уведомление «%s» не отправлено", subject)
        return

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from or settings.smtp_user or "noreply@localhost"
    message["To"] = settings.notify_email_to
    message.set_content(body)
    message.add_alternative(html, subtype="html")

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


async def notify_new_order(order_id: int, order_number: str) -> None:
    await _notify(
        "Заказ из каталога",
        order_number,
        f"/admin/orders/{order_id}",
        "Открыть заказ",
    )


async def notify_new_request(request_id: int) -> None:
    await _notify(
        "Обращение с сайта",
        str(request_id),
        f"/admin/consultations/{request_id}",
        "Открыть обращение",
    )


async def notify_custom_cake(request_id: int, request_number: str) -> None:
    await _notify(
        "Торт на заказ",
        request_number,
        f"/admin/consultations/{request_id}",
        "Открыть заявку",
    )


async def _notify(title: str, number: str, admin_path: str, action: str) -> None:
    site_url = get_settings().site_url.rstrip("/")
    admin_url = f"{site_url}{admin_path}"
    subject = f"{title} № {number}"
    body = f"{BAKERY}\n\n{subject}\n\n{action} в админке: {admin_url}"
    try:
        async with SessionLocal() as session:
            mailboxes = await request_mail.load_for_delivery(session)
    except SQLAlchemyError:
        logger.error("Не удалось загрузить настройки почтовых уведомлений")
        return
    if mailboxes == []:
        return
    html = _env.get_template("admin_notification.html").render(
        bakery=BAKERY, title=title, number=number, admin_url=admin_url, action=action
    )
    if mailboxes is None:
        await asyncio.to_thread(_send, subject, body, html)
    else:
        await asyncio.gather(
            *(asyncio.to_thread(request_mail.send, data, subject, body, html) for data in mailboxes)
        )
