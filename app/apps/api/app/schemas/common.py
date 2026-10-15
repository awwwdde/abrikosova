"""Общие схемы: пагинация и согласие на обработку ПДн."""

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Телефон: цифры, пробелы, скобки, дефис, плюс. Строгую маску не навязываем —
# по договору обязательны только имя и телефон, и человек может ввести формат
# по-своему; проверяем длину и допустимые символы.
PHONE_PATTERN = r"^\+?[\d\s\-()]{7,20}$"

Phone = Annotated[str, Field(min_length=7, max_length=20, pattern=PHONE_PATTERN)]
PersonName = Annotated[str, Field(min_length=2, max_length=200)]

# Ссылки, которые админка вписывает в контент и которые потом попадают в href
# на сайте. Только https: иначе в поле можно было бы сохранить `javascript:...`
# и получить XSS на каждой странице, где выводится ссылка.
HttpsUrl = Annotated[str, Field(max_length=500, pattern=r"^https://[^\s<>\"']+$")]

# Ссылка кнопки в контенте страницы: внутренний путь сайта («/catalog») или https.
# Путь обязан начинаться с одного слэша: «//evil.example» браузер понял бы
# как адрес другого сайта.
SafeHref = Annotated[
    str,
    Field(max_length=500, pattern=r"^(/([^/\\\s<>\"'][^\s<>\"']*)?|https://[^\s<>\"']+)$"),
]


class Page[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int


class ConsentMixin(BaseModel):
    """Согласие на обработку персональных данных.

    По 152-ФЗ согласие должно быть конкретным и осознанным: галочка обязана быть
    снята по умолчанию на фронте и обязана прийти со значением true на бэкенд.
    Значение false отвергается с 422 — обрабатывать данные без согласия нельзя.
    """

    model_config = ConfigDict(extra="forbid")

    consent_pd: bool

    @field_validator("consent_pd")
    @classmethod
    def _consent_required(cls, value: bool) -> bool:
        if not value:
            raise ValueError("Без согласия на обработку персональных данных заявку принять нельзя")
        return value


class HoneypotMixin(BaseModel):
    """Скрытое поле-приманка против ботов.

    Человек его не видит и не заполняет; бот, заполняющий все поля формы подряд,
    выдаёт себя. Дешёвая первая линия защиты в дополнение к rate limiting.
    """

    website: str | None = Field(default=None, max_length=200)

    @field_validator("website")
    @classmethod
    def _must_be_empty(cls, value: str | None) -> str | None:
        if value:
            raise ValueError("Заявка отклонена")
        return value
