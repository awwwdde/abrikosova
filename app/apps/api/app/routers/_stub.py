"""Общая заглушка для эндпоинтов, чьи пути зафиксированы на Этапе 1,
а реализация приходит на Этапах 2-3.
"""

from fastapi import status
from fastapi.responses import JSONResponse


def not_implemented(stage: str) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        content={"detail": f"Не реализовано: {stage}"},
    )
