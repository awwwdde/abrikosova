"""Служебные команды для сервера (задание 011a).

    docker compose exec api python -m app.cli reset-password <email>

Для владельца, который забыл пароль: сотрудникам новый пароль задаёт владелец
в «Пользователях», а самому владельцу — некому. Пароль вводится интерактивно
(дважды, без отображения), а не аргументом: иначе он остался бы в истории
shell и в списке процессов. Проверяется той же политикой, что и в админке;
все входы этого сотрудника закрываются.
"""

import argparse
import asyncio
import getpass
import json
import sys

from sqlalchemy import select

from app.core.db import SessionLocal
from app.core.password_policy import PasswordPolicyError, validate_password
from app.core.security import hash_password
from app.models import AdminUser, AuditLogEntry
from app.services import sessions


def _ask_password(email: str) -> str:
    while True:
        password = getpass.getpass("Новый пароль: ")
        try:
            validate_password(password, email=email)
        except PasswordPolicyError as error:
            print(error, file=sys.stderr)
            continue
        if getpass.getpass("Повторите пароль: ") != password:
            print("Пароли не совпадают", file=sys.stderr)
            continue
        return password


async def reset_password(email: str) -> int:
    email = email.strip().lower()
    async with SessionLocal() as db:
        admin = await db.scalar(select(AdminUser).where(AdminUser.email == email))
        if admin is None:
            print(f"Сотрудник {email} не найден", file=sys.stderr)
            return 1

        admin.password_hash = hash_password(_ask_password(email))
        revoked = await sessions.revoke_all(db, admin.id)
        db.add(
            AuditLogEntry(
                actor_id=admin.id,
                actor_email=admin.email,
                action="password_reset_cli",
                entity="auth",
                details={"sessions_revoked": revoked},
                ip="cli",
            )
        )
        await db.commit()
    print(f"Пароль для {email} изменён, закрыто входов: {revoked}")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Служебные команды админ-панели")
    commands = parser.add_subparsers(dest="command", required=True)
    reset = commands.add_parser(
        "reset-password", help="задать новый пароль сотруднику (пароль вводится интерактивно)"
    )
    reset.add_argument("email")
    media = commands.add_parser("migrate-media", help="перенести старые файлы на постоянный диск")
    media.add_argument("--verify-only", action="store_true", help="только сверить SHA-256")
    args = parser.parse_args()
    if args.command == "reset-password":
        sys.exit(asyncio.run(reset_password(args.email)))
    if args.command == "migrate-media":
        from app.services.media_migration import migrate

        print(json.dumps(asyncio.run(migrate(verify_only=args.verify_only)), ensure_ascii=False))


if __name__ == "__main__":
    main()
