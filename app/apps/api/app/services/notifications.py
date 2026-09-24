"""E-mail-уведомления администратору.

Основной обязательный канал по договору (раздел 5.3) — в отличие от старого кода,
где был только Telegram через прокси с захардкоженными кредами (ANALYSIS.md, п. 2.1.10).

Отправка вызывается через FastAPI BackgroundTasks: ответ клиенту не ждёт SMTP,
отдельный воркер и очередь не нужны (00-overview.md, примечание про фоновые задачи).

Письмо уходит на служебный адрес оператора и содержит ПДн клиента — это неизбежно
(иначе заказ невозможно обработать), поэтому: получатель только один и задаётся
переменной окружения, SMTP — обязательно через STARTTLS, тело письма нигде не логируется.
"""

import logging
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings

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
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            smtp.starttls()
            if settings.smtp_user and settings.smtp_password:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(message)
    except (smtplib.SMTPException, OSError):
        # Явное логирование с трассировкой вместо «except: pass» старого кода.
        # Тело письма не пишем — в нём персональные данные клиента.
        logger.exception("Не удалось отправить уведомление «%s»", subject)
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


def notify_new_request(
    request_id: int, source: str, phone: str, details: str | None = None
) -> None:
    _send(
        subject=f"Новая заявка #{request_id}",
        body=(
            f"Поступила новая заявка #{request_id} (источник: {source}).\n"
            + (f"Событие: {details}\n" if details else "")
            + f"Телефон клиента: {phone}\n\n"
            f"Детали — в админ-панели, раздел «Заявки»."
        ),
    )
