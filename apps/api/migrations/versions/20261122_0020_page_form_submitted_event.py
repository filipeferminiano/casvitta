"""Casvitta Social forms: `form_submitted` page event (finder "Pedir ajuda" and the owner form).

Revision ID: 0020
Revises: 0019
Create Date: 2026-11-22 13:30:00+00:00
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0020"
down_revision: str | None = "0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_NAME = "ck_page_events_page_event_kind"  # full name, used in raw SQL
_OLD = "'page_view', 'property_view', 'whatsapp_click'"
_NEW = f"{_OLD}, 'form_submitted'"


def upgrade() -> None:
    op.execute(f"ALTER TABLE page_events DROP CONSTRAINT {_NAME}")
    op.execute(f"ALTER TABLE page_events ADD CONSTRAINT {_NAME} CHECK (kind IN ({_NEW}))")


def downgrade() -> None:
    op.execute("DELETE FROM page_events WHERE kind = 'form_submitted'")
    op.execute(f"ALTER TABLE page_events DROP CONSTRAINT {_NAME}")
    op.execute(f"ALTER TABLE page_events ADD CONSTRAINT {_NAME} CHECK (kind IN ({_OLD}))")
