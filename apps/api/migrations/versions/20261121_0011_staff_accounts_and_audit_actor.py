"""staff accounts (backoffice) and the real actor on audit_log

Staff users (the allowlist), their email-link/re-auth tokens and sessions. audit_log gains the
staff member who acted and a reason; existing rows keep actor "staff:admin-token".

Revision ID: 0011
Revises: 0010
Create Date: 2026-11-21 18:00:00+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ROLES = ("admin", "operations", "commercial", "finance", "read_only")
PURPOSES = ("sign_in", "reauth")


def _in(values: Sequence[str]) -> str:
    return ", ".join(f"'{v}'" for v in values)


def upgrade() -> None:
    op.create_table(
        "staff_users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False, unique=True),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("role", sa.String(32), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "invited_by_id",
            sa.Uuid(),
            sa.ForeignKey("staff_users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(f"role IN ({_in(ROLES)})", name="ck_staff_users_staff_role"),
    )
    op.create_table(
        "staff_login_tokens",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "staff_user_id",
            sa.Uuid(),
            sa.ForeignKey("staff_users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("purpose", sa.String(32), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            f"purpose IN ({_in(PURPOSES)})", name="ck_staff_login_tokens_staff_token_purpose"
        ),
    )
    op.create_index("ix_staff_login_tokens_staff_user_id", "staff_login_tokens", ["staff_user_id"])
    op.create_table(
        "staff_sessions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "staff_user_id",
            sa.Uuid(),
            sa.ForeignKey("staff_users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("refresh_token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("family_started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("authenticated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("rotated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("user_agent", sa.String(300), nullable=True),
    )
    op.create_index("ix_staff_sessions_staff_user_id", "staff_sessions", ["staff_user_id"])
    op.create_index("ix_staff_sessions_family_id", "staff_sessions", ["family_id"])

    op.add_column(
        "audit_log",
        sa.Column(
            "actor_staff_id",
            sa.Uuid(),
            sa.ForeignKey("staff_users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column("audit_log", sa.Column("reason", sa.String(500), nullable=True))
    op.create_index("ix_audit_log_actor_staff_id", "audit_log", ["actor_staff_id"])
    op.create_index("ix_audit_log_actor", "audit_log", ["actor"])
    op.create_index("ix_audit_log_action", "audit_log", ["action"])


def downgrade() -> None:
    op.drop_index("ix_audit_log_action", table_name="audit_log")
    op.drop_index("ix_audit_log_actor", table_name="audit_log")
    op.drop_index("ix_audit_log_actor_staff_id", table_name="audit_log")
    op.drop_column("audit_log", "reason")
    op.drop_column("audit_log", "actor_staff_id")
    op.drop_table("staff_sessions")
    op.drop_table("staff_login_tokens")
    op.drop_table("staff_users")
