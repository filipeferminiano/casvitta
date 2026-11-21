"""Plan catalog (CRM-0) and plan change requests.

New ladder free / essential / automation / pro / agency (app.core.catalog). Workspaces on the
R$ 99 `corretor` plan move to `essential`; `corretor`, `essencial` and `profissional` stay valid
as legacy values. New workspaces start on `free`.

Revision ID: 0016
Revises: 0015
Create Date: 2026-11-21 21:32:03.102509+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0016"
down_revision: str | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD_PLANS = ("corretor", "essencial", "profissional")
NEW_PLANS = ("free", "essential", "automation", "pro", "agency", *OLD_PLANS)


def _plan_check(values: Sequence[str]) -> None:
    allowed = ", ".join(f"'{v}'" for v in values)
    op.execute('ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS "ck_workspaces_plan"')
    op.execute(
        f'ALTER TABLE workspaces ADD CONSTRAINT "ck_workspaces_plan" CHECK (plan IN ({allowed}))'
    )


def upgrade() -> None:
    _plan_check(NEW_PLANS)
    op.execute("UPDATE workspaces SET plan = 'essential' WHERE plan = 'corretor'")
    op.alter_column("workspaces", "plan", server_default="free")
    op.create_table(
        "plan_change_requests",
        sa.Column(
            "kind",
            sa.Enum(
                "plan",
                "add_on",
                name="change_kind",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column(
            "current_plan",
            sa.Enum(
                "free",
                "essential",
                "automation",
                "pro",
                "agency",
                "corretor",
                "essencial",
                "profissional",
                name="current_plan",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column(
            "requested_plan",
            sa.Enum(
                "free",
                "essential",
                "automation",
                "pro",
                "agency",
                "corretor",
                "essencial",
                "profissional",
                name="requested_plan",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=True,
        ),
        sa.Column("add_on_key", sa.String(length=60), nullable=True),
        sa.Column("billing_period", sa.String(length=8), nullable=False),
        sa.Column(
            "source",
            sa.Enum(
                "signup",
                "plans_page",
                "limit_reached",
                "feature_gate",
                "support",
                name="change_source",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "pending",
                "awaiting_payment",
                "approved",
                "declined",
                "cancelled",
                name="change_status",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            server_default="pending",
            nullable=False,
        ),
        sa.Column("requested_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("handled_by_staff_id", sa.Uuid(), nullable=True),
        sa.Column("handled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reason", sa.String(length=500), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["handled_by_staff_id"],
            ["staff_users.id"],
            name=op.f("fk_plan_change_requests_handled_by_staff_id_staff_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["requested_by_user_id"],
            ["users.id"],
            name=op.f("fk_plan_change_requests_requested_by_user_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_plan_change_requests_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_plan_change_requests")),
    )
    op.create_index(
        op.f("ix_plan_change_requests_workspace_id"),
        "plan_change_requests",
        ["workspace_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_plan_change_requests_workspace_id"), table_name="plan_change_requests")
    op.drop_table("plan_change_requests")
    op.execute(
        "UPDATE workspaces SET plan = 'corretor' "
        "WHERE plan IN ('free', 'essential', 'automation', 'pro', 'agency')"
    )
    op.alter_column("workspaces", "plan", server_default="corretor")
    _plan_check(OLD_PLANS)
