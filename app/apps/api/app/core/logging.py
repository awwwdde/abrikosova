import logging
import sys


def setup_logging(debug: bool = False) -> None:
    """Явное логирование вместо print()-отладки и проглоченных исключений старого проекта
    (ANALYSIS.md, п. 2.1.5)."""
    logging.basicConfig(
        level=logging.DEBUG if debug else logging.INFO,
        format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
        stream=sys.stdout,
    )
