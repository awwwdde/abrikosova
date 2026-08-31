import requests
from django.conf import settings
from requests.exceptions import ProxyError, RequestException


class TelegramService:
    def __init__(self):
        self.bot_token = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')
        self.chat_id = getattr(settings, 'TELEGRAM_CHAT_ID', '')
        self.proxy_url = getattr(settings, 'TELEGRAM_PROXY_URL', '').strip()
        self.proxy_fallback_url = getattr(settings, 'TELEGRAM_PROXY_FALLBACK_URL', '').strip()

    def send_message(self, message):
        """Отправляет сообщение в Telegram"""
        if not self.bot_token or not self.chat_id:
            print("Telegram bot token or chat id not configured")
            return False

        url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"

        payload = {
            'chat_id': self.chat_id,
            'text': message,
            'parse_mode': 'HTML'
        }
        proxy_candidates = [self.proxy_url, self.proxy_fallback_url]
        # Если прокси не задан, пробуем прямое подключение.
        if not any(proxy_candidates):
            proxy_candidates = ['']

        for proxy in proxy_candidates:
            proxies = None
            if proxy:
                proxies = {
                    'http': proxy,
                    'https': proxy,
                }

            try:
                response = requests.post(url, data=payload, timeout=10, proxies=proxies)
                if response.status_code == 200:
                    return True
                print(f"Telegram API error: {response.status_code} - {response.text}")
            except ProxyError as e:
                print(f"Telegram proxy error ({proxy}): {e}")
            except RequestException as e:
                print(f"Error sending Telegram message ({proxy or 'direct'}): {e}")

        return False

    def format_order_message(self, order):
        """Форматирует сообщение о заказе для Telegram"""
        items_text = ""
        for item in order.items.all():
            total_price = item.get_total_price()
            items_text += f"• {item.product.name} x {item.quantity} - {total_price}₽\n"

        # Получаем отображаемое значение способа доставки
        delivery_display = self._get_delivery_method_display(order.delivery_method)

        message = f"""
🆕 <b>НОВЫЙ ЗАКАЗ</b>

📦 <b>Заказ #{order.order_number}</b>
👤 <b>Клиент:</b> {order.customer_name}
📞 <b>Телефон:</b> {order.customer_phone}
🚚 <b>Способ:</b> {delivery_display}
💰 <b>Сумма:</b> {order.total_price}₽

🛒 <b>Состав заказа:</b>
{items_text}

💬 <b>Комментарий:</b>
{order.customer_comment or 'Нет комментария'}

⏰ <b>Время заказа:</b>
{order.created_at.strftime('%d.%m.%Y %H:%M')}
        """

        return message.strip()

    def _get_delivery_method_display(self, delivery_method):
        """Безопасное получение отображаемого значения способа доставки"""
        delivery_methods = {
            'pickup': 'Самовывоз',
            'delivery': 'Доставка'
        }
        return delivery_methods.get(delivery_method, delivery_method)
