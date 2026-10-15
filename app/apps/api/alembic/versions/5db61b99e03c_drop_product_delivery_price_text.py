"""drop product delivery price text

Цена доставки на странице товара — из настроек (007a), а не текстом в контенте
«Контактов». Поле `product_delivery_price` удалено из схемы `ContactsContent`
(extra=forbid): сохранённый ключ в контенте ломал бы проверку при следующем
сохранении «Контактов» в админке — поэтому убираем его и из данных (007b).

Там же (007b) — новое поле `pickup_place` «на Гжатской, 5к8»: где забирать,
в предложном падеже, для корзины и страницы «Заказ принят». Заполняется, только
если его ещё нет.

Откат возвращает текст из значений настроек по умолчанию (старый код показывал его
на странице товара) и убирает `pickup_place`.

Revision ID: 5db61b99e03c
Revises: e2eb6daa1766
Create Date: 2026-10-13

"""

from collections.abc import Sequence

from alembic import op

revision: str = "5db61b99e03c"
down_revision: str | Sequence[str] | None = "e2eb6daa1766"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "UPDATE page_contents SET content = content - 'product_delivery_price' "
        "WHERE page_key = 'contacts' AND content ? 'product_delivery_price'"
    )
    op.execute(
        "UPDATE page_contents SET content = jsonb_set(content, '{pickup_place}', "
        "'\"на Гжатской, 5к8\"') WHERE page_key = 'contacts' AND NOT content ? 'pickup_place'"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE page_contents SET content = content - 'pickup_place' WHERE page_key = 'contacts'"
    )
    op.execute(
        "UPDATE page_contents SET content = jsonb_set(content, '{product_delivery_price}', "
        "'\"от 500 ₽, бесплатно от 5 000 ₽\"') WHERE page_key = 'contacts'"
    )
