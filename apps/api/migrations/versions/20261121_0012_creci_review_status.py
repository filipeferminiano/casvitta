"""CRECI review status on broker profiles (backoffice BO2)

pending / correction_requested / verified / rejected, with the reason sent to the broker, when and
by whom. Backfilled from the existing columns: verified when creci_verified_at is set, pending when
a number was sent.

Revision ID: 0012
Revises: 0011
Create Date: 2026-11-21 20:00:00+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

STATUSES = ("pending", "correction_requested", "verified", "rejected")


def upgrade() -> None:
    op.add_column("broker_profiles", sa.Column("creci_review_status", sa.String(32)))
    op.create_check_constraint(
        "ck_broker_profiles_creci_review_status",
        "broker_profiles",
        "creci_review_status IN ({})".format(", ".join(f"'{s}'" for s in STATUSES)),
    )
    op.add_column("broker_profiles", sa.Column("creci_review_reason", sa.String(500)))
    op.add_column("broker_profiles", sa.Column("creci_reviewed_at", sa.DateTime(timezone=True)))
    op.add_column(
        "broker_profiles",
        sa.Column(
            "creci_reviewed_by_id",
            sa.Uuid(),
            sa.ForeignKey("staff_users.id", ondelete="SET NULL"),
        ),
    )
    op.execute(
        """
        UPDATE broker_profiles SET creci_review_status = CASE
            WHEN creci_verified_at IS NOT NULL THEN 'verified'
            WHEN creci_number IS NOT NULL THEN 'pending'
        END
        """
    )


def downgrade() -> None:
    op.drop_column("broker_profiles", "creci_reviewed_by_id")
    op.drop_column("broker_profiles", "creci_reviewed_at")
    op.drop_column("broker_profiles", "creci_review_reason")
    op.drop_constraint("ck_broker_profiles_creci_review_status", "broker_profiles", type_="check")
    op.drop_column("broker_profiles", "creci_review_status")
