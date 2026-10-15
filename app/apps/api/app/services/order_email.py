"""Копия заказа покупателю на почту (007a).

Отправляется в BackgroundTasks после оформления: покупатель не ждёт SMTP. Не настроен
SMTP или почтовый сервер не ответил — заказ всё равно создан, в логе предупреждение.
Почту покупателя в лог пишем только в маске («an***@mail.ru»): логи хранятся
и пересылаются иначе, чем база, и не должны копить адреса.

Письмо — HTML и текст (шаблоны Jinja2 в app/templates/email/): простая разметка,
бордовый заголовок, никаких внешних картинок, кроме логотипа по абсолютному адресу
сайта. Данные для письма собираются заранее в `OrderEmail`: фоновая задача не ходит
в базу — сессия запроса к тому времени уже закрыта.
"""

import logging
import smtplib
from dataclasses import dataclass
from decimal import Decimal
from email.message import EmailMessage
from email.utils import formataddr
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.core.config import get_settings
from app.models import DeliveryMethod, Order
from app.services.orders import mask_email

logger = logging.getLogger(__name__)

TEMPLATES = Path(__file__).resolve().parent.parent / "templates" / "email"
_env = Environment(
    loader=FileSystemLoader(TEMPLATES),
    autoescape=select_autoescape(["html"]),
    trim_blocks=True,
    lstrip_blocks=True,
)

BAKERY = "Кондитерская Елены Абрикосовой"
NBSP = " "
MONTHS = "января февраля марта апреля мая июня июля августа сентября октября ноября декабря".split()


def money(value: Decimal | int) -> str:
    """7280 → «7 280 ₽» с неразрывными пробелами; копейки — только если есть."""
    number = Decimal(value)
    text = f"{number:,.2f}" if number != number.to_integral() else f"{number:,.0f}"
    return text.replace(",", NBSP).replace(".", ",") + f"{NBSP}₽"


@dataclass
class EmailLine:
    name: str
    details: str
    quantity: int
    total: str


@dataclass
class OrderEmail:
    to: str
    order_number: str
    lines: list[EmailLine]
    subtotal: str
    delivery: str
    total: str
    method: str
    when: str | None
    address: str | None
    phone: str | None
    telegram_url: str | None
    work_hours: str | None
    after_hours: bool
    work_start: int
    order_url: str
    logo_url: str


def build(
    order: Order,
    *,
    token: str,
    after_hours: bool,
    work_start: int,
    pickup_address: str | None,
    phone: str | None,
    telegram_url: str | None,
    work_hours: str | None,
) -> OrderEmail:
    """Письмо из снапшотов заказа и контактов кондитерской на момент оформления."""
    site = get_settings().site_url.rstrip("/")
    lines = []
    for item in sorted(order.items, key=lambda i: i.id):
        details = [item.variant_label]
        if item.inscription_text:
            details.append(f"надпись «{item.inscription_text}»")
        lines.append(
            EmailLine(
                name=item.product_name,
                details=" · ".join(details),
                quantity=item.quantity,
                total=money(item.line_total),
            )
        )
    when = None
    if order.desired_date:
        when = f"{order.desired_date.day} {MONTHS[order.desired_date.month - 1]}"
        if order.delivery_interval:
            start, end = order.delivery_interval.value.split("-")
            when += f", {start}:00–{end}:00"
    is_delivery = order.delivery_method is DeliveryMethod.DELIVERY
    if is_delivery:
        parts = [order.delivery_address or ""]
        if order.address_apartment:
            parts.append(f"кв./офис {order.address_apartment}")
        if order.address_entrance:
            parts.append(f"подъезд {order.address_entrance}")
        if order.address_floor:
            parts.append(f"этаж {order.address_floor}")
        address = ", ".join(part for part in parts if part)
    else:
        address = pickup_address
    return OrderEmail(
        to=order.customer_email or "",
        order_number=order.order_number,
        lines=lines,
        subtotal=money(order.subtotal),
        delivery=money(order.delivery_price) if order.delivery_price else "бесплатно",
        total=money(order.total_price),
        method="Доставка" if is_delivery else "Самовывоз",
        when=when,
        address=address,
        phone=phone,
        telegram_url=telegram_url,
        work_hours=work_hours,
        after_hours=after_hours,
        work_start=work_start,
        order_url=f"{site}/order/{order.order_number}?t={token}",
        logo_url=f"{site}/brand/logo.png",
    )


def render(data: OrderEmail) -> tuple[str, str, str]:
    """Тема, текст и HTML письма."""
    subject = f"Заказ №{NBSP}{data.order_number} принят — {BAKERY}"
    context = {"d": data, "bakery": BAKERY}
    text = _env.get_template("order_confirmation.txt").render(context)
    html = _env.get_template("order_confirmation.html").render(context)
    return subject, text, html


def send_order_copy(data: OrderEmail) -> None:
    """Фоновая отправка копии заказа. Ошибки только логируются: заказ уже создан."""
    subject, text, html = render(data)
    deliver(data.to, subject, text, html, label=f"Копия заказа {data.order_number}")


def deliver(to: str, subject: str, text: str, html: str, *, label: str) -> None:
    """Отправка письма покупателю — общая для копии заказа и копии заявки (008a).

    `label` — «Копия заказа 20261007-867DB2»: с ним пишутся строки лога, адрес — в маске.
    """
    settings = get_settings()
    masked = mask_email(to)
    if not to:
        return
    if not settings.smtp_host:
        logger.warning(
            "SMTP не настроен — %s для %s не отправлена", label[:1].lower() + label[1:], masked
        )
        return

    sender = settings.smtp_from or settings.smtp_user or "noreply@localhost"
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = formataddr((BAKERY, sender))
    message["To"] = to
    message.set_content(text)
    message.add_alternative(html, subtype="html")

    try:
        # 465 — SSL с первого байта (Яндекс 360), иначе STARTTLS
        if settings.smtp_port == 465:
            client: smtplib.SMTP = smtplib.SMTP_SSL(
                settings.smtp_host, settings.smtp_port, timeout=15
            )
        else:
            client = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15)
            client.starttls()
        with client as smtp:
            if settings.smtp_user and settings.smtp_password:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(message)
    except (smtplib.SMTPException, OSError):
        logger.exception("%s для %s не отправлена", label, masked)
        return
    logger.info("%s отправлена на %s", label, masked)
