"""Suites and floor on properties; staff review of owner authorizations; listings can wait
for that review (`pending_review`). Existing authorizations stay pending until checked.

Revision ID: 0018
Revises: 0017
Create Date: 2026-11-22 00:47:21.600244+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0018"
down_revision: str | None = "0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD_STATUSES = ("draft", "published", "unpublished", "suspended")
NEW_STATUSES = ("draft", "pending_review", "published", "unpublished", "suspended")


def _listing_status_check(values: Sequence[str]) -> None:
    allowed = ", ".join(f"'{v}'" for v in values)
    op.execute('ALTER TABLE listings DROP CONSTRAINT IF EXISTS "ck_listings_listing_status"')
    op.execute(
        f'ALTER TABLE listings ADD CONSTRAINT "ck_listings_listing_status" '
        f"CHECK (status IN ({allowed}))"
    )


def upgrade() -> None:
    _listing_status_check(NEW_STATUSES)
    op.add_column(
        "owner_authorizations",
        sa.Column(
            "review_status",
            sa.Enum(
                "pending",
                "verified",
                "rejected",
                name="authorization_review",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            server_default="pending",
            nullable=False,
        ),
    )
    op.add_column(
        "owner_authorizations", sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "owner_authorizations", sa.Column("reviewed_by_staff_id", sa.Uuid(), nullable=True)
    )
    op.add_column(
        "owner_authorizations", sa.Column("review_reason", sa.String(length=500), nullable=True)
    )
    op.create_foreign_key(
        op.f("fk_owner_authorizations_reviewed_by_staff_id_staff_users"),
        "owner_authorizations",
        "staff_users",
        ["reviewed_by_staff_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column("properties", sa.Column("suites", sa.Integer(), nullable=True))
    op.add_column("properties", sa.Column("floor", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.execute("UPDATE listings SET status = 'draft' WHERE status = 'pending_review'")
    _listing_status_check(OLD_STATUSES)
    op.drop_column("properties", "floor")
    op.drop_column("properties", "suites")
    op.drop_constraint(
        op.f("fk_owner_authorizations_reviewed_by_staff_id_staff_users"),
        "owner_authorizations",
        type_="foreignkey",
    )
    op.drop_column("owner_authorizations", "review_reason")
    op.drop_column("owner_authorizations", "reviewed_by_staff_id")
    op.drop_column("owner_authorizations", "reviewed_at")
    op.drop_column("owner_authorizations", "review_status")
