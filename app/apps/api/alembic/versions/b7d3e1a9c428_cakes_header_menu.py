"""cakes header menu

Мега-меню «Торты на заказ» в шапке (014) читает блок `header_menu` контента
страницы «Торты на заказ». Сид создаёт его на пустой базе вместе с фото; здесь —
для баз, где страница уже есть: строка фактов и четыре карточки без фото
(на сайте бежевые плашки, фото добавляются в «Страницах сайта»). Уже заполненный
блок не трогаем.

Revision ID: b7d3e1a9c428
Revises: 9c4f2a7e5b13
Create Date: 2026-10-09 18:00:00

"""

import json
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "b7d3e1a9c428"
down_revision: str | Sequence[str] | None = "9c4f2a7e5b13"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

MENU = {
    "facts": "от 2 кг · от 5 дней · от 3 200 ₽ за кг",
    "cards": [
        {"occasion": "wedding", "label": "Свадьба"},
        {"occasion": "birthday", "label": "День рождения"},
        {"occasion": "kids", "label": "Детский"},
        {"occasion": "corporate", "label": "Юбилей и корпоратив"},
    ],
}


def upgrade() -> None:
    op.get_bind().execute(
        sa.text(
            "UPDATE page_contents SET content = content || jsonb_build_object("
            "'header_menu', cast(:menu as jsonb)) "
            "WHERE page_key = 'custom_cakes' AND NOT content ? 'header_menu'"
        ),
        {"menu": json.dumps(MENU, ensure_ascii=False)},
    )


def downgrade() -> None:
    op.execute(
        "UPDATE page_contents SET content = content - 'header_menu' WHERE page_key = 'custom_cakes'"
    )
