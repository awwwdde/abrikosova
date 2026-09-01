"""Уведомления в Telegram — опциональный дополнительный канал.

По договору (раздел 5.3) обязательный канал — e-mail; Telegram включается
по согласованию. Поэтому здесь всё построено так, чтобы канал можно было
выключить одной пустой переменной окружения и ничего больше не сломать.

**Прокси обязателен.** `api.telegram.org` из российских сетей, включая
Timeweb Cloud, напрямую недоступен: TLS-соединение обрывается на рукопожатии.
Адрес прокси берётся из окружения — в старом проекте логин и пароль от него
лежали в репозитории открытым текстом и утекли вместе с кодом.

Отправка никогда не влияет на оформление заказа: заказ уже сохранён в базе,
и недоступность бота не повод возвращать клиенту ошибку. Неудача пишется
в лог с уровнем warning — в отличие от старого кода, где исключение
проглатывалось в `print` и потерянное уведомление выглядело как успех.
"""

import html
import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

TIMEOUT_SECONDS = 10


def is_enabled() -> bool:
    settings = get_settings()
    return bool(settings.telegram_bot_token and settings.telegram_chat_id)


def _send(text: str, context: str) -> None:
    settings = get_settings()

    if not is_enabled():
        logger.debug("Telegram выключен — уведомление «%s» не отправлено", context)
        return

    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    payload = {"chat_id": settings.telegram_chat_id, "text": text, "parse_mode": "HTML"}

    # Пустая переменная = прямое подключение. Оставлено осознанно: если
    # ограничения снимут или приложение переедет в сеть без фильтрации,
    # прокси убирается правкой окружения, а не кода.
    proxy = settings.telegram_proxy_url or None

    try:
        with httpx.Client(proxy=proxy, timeout=TIMEOUT_SECONDS) as client:
            response = client.post(url, data=payload)
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        # Тело ответа Telegram содержит причину отказа, но в нём же может быть
        # эхо нашего сообщения с телефоном клиента — поэтому только код
        logger.warning(
            "Telegram отклонил уведомление «%s»: HTTP %s", context, exc.response.status_code
        )
    except httpx.HTTPError as exc:
        # Сюда попадает и обрыв TLS при отсутствии прокси
        logger.warning(
            "Не удалось отправить уведомление «%s» в Telegram: %s. "
            "Проверьте TELEGRAM_PROXY_URL — прямое подключение к api.telegram.org "
            "из российских сетей не работает",
            context,
            type(exc).__name__,
        )
    else:
        logger.info("Уведомление «%s» отправлено в Telegram", context)


def notify_new_order(
    order_number: str,
    total: str,
    phone: str,
    delivery: str,
    customer_name: str,
    items: list[tuple[str, int, str]],
) -> None:
    """Сообщение о заказе. Формат унаследован от старого сайта — заказчица
    к нему привыкла, менять без нужды не стоит."""
    # Экранируем всё, что пришло от клиента: имя вида "<b>" иначе поломает
    # разметку сообщения, а в худшем случае подделает его содержимое
    lines = "\n".join(
        f"• {html.escape(name)} x {quantity} — {html.escape(price)} ₽"
        for name, quantity, price in items
    )

    _send(
        "🆕 <b>НОВЫЙ ЗАКАЗ</b>\n\n"
        f"📦 <b>Заказ №{html.escape(order_number)}</b>\n"
        f"👤 <b>Клиент:</b> {html.escape(customer_name)}\n"
        f"📞 <b>Телефон:</b> {html.escape(phone)}\n"
        f"🚚 <b>Способ:</b> {html.escape(delivery)}\n"
        f"💰 <b>Сумма:</b> {html.escape(total)} ₽\n\n"
        f"🛒 <b>Состав:</b>\n{lines}",
        context=f"заказ {order_number}",
    )


def notify_new_request(request_id: int, source: str, phone: str, name: str) -> None:
    _send(
        "📝 <b>НОВАЯ ЗАЯВКА</b>\n\n"
        f"№ {request_id}\n"
        f"👤 <b>Имя:</b> {html.escape(name)}\n"
        f"📞 <b>Телефон:</b> {html.escape(phone)}\n"
        f"📍 <b>Источник:</b> {html.escape(source)}",
        context=f"заявка #{request_id}",
    )
