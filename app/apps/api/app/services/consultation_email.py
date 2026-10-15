"""Копия заявки на торт на почту (008a) — тот же механизм, что копия заказа (007a):
фоновая задача, Jinja2-шаблоны, SMTP из настроек; данные собраны заранее."""

from dataclasses import dataclass

from app.core.config import get_settings
from app.services.order_email import BAKERY, NBSP, _env, deliver


@dataclass
class ConsultationEmail:
    to: str
    number: str
    # «Белый с пионами, свадьба, 24 октября»
    title: str
    guests: int
    weight: str
    estimate: str
    filling: str
    extras: list[str]
    method: str
    wishes: str | None
    references: int
    phone: str | None
    telegram_url: str | None
    work_hours: str | None
    logo_url: str


def logo_url() -> str:
    return f"{get_settings().site_url.rstrip('/')}/brand/logo.png"


def render(data: ConsultationEmail) -> tuple[str, str, str]:
    subject = f"Заявка №{NBSP}{data.number} принята — {BAKERY}"
    context = {"d": data, "bakery": BAKERY}
    text = _env.get_template("consultation_confirmation.txt").render(context)
    html = _env.get_template("consultation_confirmation.html").render(context)
    return subject, text, html


def send_copy(data: ConsultationEmail) -> None:
    subject, text, html = render(data)
    deliver(data.to, subject, text, html, label=f"Копия заявки {data.number}")
