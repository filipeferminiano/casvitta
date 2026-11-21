"""capture handling, broker assignments and demo flag (backoffice BO3)

interest_signups: when an owner request was pointed to a broker and until when the broker can
accept, when another capture was handled and by whom, and is_demo for local seeds.
interest_assignments: history of every referral and its outcome (accepted, expired, withdrawn).

Revision ID: 0013
Revises: 0012
Create Date: 2026-11-21 22:00:00+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OUTCOMES = ("open", "accepted", "expired", "withdrawn")


def upgrade() -> None:
    for name in ("assigned_at", "assignment_expires_at", "assignment_accepted_at", "handled_at"):
        op.add_column("interest_signups", sa.Column(name, sa.DateTime(timezone=True)))
    op.add_column(
        "interest_signups",
        sa.Column("handled_by_id", sa.Uuid(), sa.ForeignKey("staff_users.id", ondelete="SET NULL")),
    )
    op.add_column(
        "interest_signups",
        sa.Column("is_demo", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_table(
        "interest_assignments",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "signup_id",
            sa.Uuid(),
            sa.ForeignKey("interest_signups.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "broker_profile_id",
            sa.Uuid(),
            sa.ForeignKey("broker_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "assigned_by_id", sa.Uuid(), sa.ForeignKey("staff_users.id", ondelete="SET NULL")
        ),
        sa.Column("accept_token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("outcome", sa.String(32), nullable=False),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint(
            "outcome IN ({})".format(", ".join(f"'{o}'" for o in OUTCOMES)),
            name="ck_interest_assignments_assignment_outcome",
        ),
    )
    op.create_index("ix_interest_assignments_signup_id", "interest_assignments", ["signup_id"])
    op.create_index(
        "ix_interest_assignments_broker_profile_id", "interest_assignments", ["broker_profile_id"]
    )


def downgrade() -> None:
    op.drop_table("interest_assignments")
    for name in (
        "is_demo",
        "handled_by_id",
        "handled_at",
        "assignment_accepted_at",
        "assignment_expires_at",
        "assigned_at",
    ):
        op.drop_column("interest_signups", name)
