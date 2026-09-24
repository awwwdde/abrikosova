import logging
import sys

# Сторонние библиотеки, которые в DEBUG пишут десятки строк на каждый запрос
# к S3 (хуки botocore, заголовки, подписи) и на каждую картинку (PIL — чанки PNG
# и импорт всех своих плагинов при первой загрузке). Среди них тонут наши
# собственные сообщения, а полезного для отладки приложения там почти нет.
# Предупреждения и ошибки от них по-прежнему видны.
NOISY_LOGGERS = ("botocore", "boto3", "urllib3", "s3transfer", "PIL")


def setup_logging(debug: bool = False, *, sql_echo: bool = False) -> None:
    """Явное логирование вместо print()-отладки и проглоченных исключений старого проекта
    (ANALYSIS.md, п. 2.1.5)."""
    logging.basicConfig(
        level=logging.DEBUG if debug else logging.INFO,
        format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
        stream=sys.stdout,
    )
    for name in NOISY_LOGGERS:
        logging.getLogger(name).setLevel(logging.WARNING)
    # SQL идёт через корневой обработчик, а не через echo движка: так каждая
    # запись выводится один раз и в общем формате. DEBUG сам по себе SQL не включает.
    logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO if sql_echo else logging.WARNING)
