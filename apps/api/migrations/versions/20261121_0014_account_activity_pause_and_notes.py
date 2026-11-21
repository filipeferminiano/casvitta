"""last access, publishing pause and internal notes for customer accounts (BO4, BO5)

Revision ID: 0014
Revises: 0013
Create Date: 2026-11-21 23:30:00+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("last_seen_at", sa.DateTime(timezone=True)))
    op.add_column("workspaces", sa.Column("publishing_paused_at", sa.DateTime(timezone=True)))
    op.add_column("workspaces", sa.Column("publishing_paused_reason", sa.String(500)))
    op.add_column(
        "workspaces",
        sa.Column(
            "publishing_paused_by_id",
            sa.Uuid(),
            sa.ForeignKey("staff_users.id", ondelete="SET NULL"),
        ),
    )
    op.create_table(
        "account_notes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "workspace_id",
            sa.Uuid(),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("staff_user_id", sa.Uuid(), sa.ForeignKey("staff_users.id", ondelete="SET NULL")),
        sa.Column("body", sa.String(2000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_account_notes_workspace_id", "account_notes", ["workspace_id"])


def downgrade() -> None:
    op.drop_table("account_notes")
    op.drop_column("workspaces", "publishing_paused_by_id")
    op.drop_column("workspaces", "publishing_paused_reason")
    op.drop_column("workspaces", "publishing_paused_at")
    op.drop_column("users", "last_seen_at")
