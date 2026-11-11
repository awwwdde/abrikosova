from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr, StringConstraints


class RequestMailboxIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    recipient: EmailStr
    sender: EmailStr
    host: Annotated[
        str,
        StringConstraints(
            strip_whitespace=True,
            to_lower=True,
            max_length=253,
            pattern=r"^(?:[a-zA-Z0-9][a-zA-Z0-9-]{0,62}\.)+[a-zA-Z][a-zA-Z0-9-]{0,62}$",
        ),
    ]
    port: Literal[465, 587]
    username: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=254)]
    password: Annotated[SecretStr, Field(min_length=1, max_length=1024)]


class RequestMailboxOut(BaseModel):
    id: UUID
    recipient: EmailStr | None


class RequestMailSettings(BaseModel):
    mailboxes: list[RequestMailboxOut]
    server_mail_enabled: bool
