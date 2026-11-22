"""Casvitta Social: broker pages ({slug}.casvitta.com.br) and daily-deduplicated page events.

Revision ID: 0019
Revises: 0018
Create Date: 2026-11-22 09:41:07.234162+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0019"
down_revision: str | None = "0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "broker_pages",
        sa.Column("broker_profile_id", sa.Uuid(), nullable=False),
        sa.Column(
            "theme",
            sa.Enum(
                "cambui",
                "planta",
                "terracota",
                name="page_theme",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            server_default="cambui",
            nullable=False,
        ),
        sa.Column(
            "works_as",
            sa.Enum(
                "broker",
                "agency",
                name="works_as",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            server_default="broker",
            nullable=False,
        ),
        sa.Column("agency_name", sa.String(length=120), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "draft",
                "published",
                "unpublished",
                "suspended",
                name="page_status",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            server_default="draft",
            nullable=False,
        ),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("unpublished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("suspended_reason", sa.String(length=500), nullable=True),
        sa.Column("onboarding_step", sa.Integer(), server_default="2", nullable=False),
        sa.Column("onboarding_done_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("onboarding_dismissed_at", sa.DateTime(timezone=True), nullable=True),
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
            ["broker_profile_id"],
            ["broker_profiles.id"],
            name=op.f("fk_broker_pages_broker_profile_id_broker_profiles"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_broker_pages_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_broker_pages")),
        sa.UniqueConstraint("broker_profile_id", name=op.f("uq_broker_pages_broker_profile_id")),
    )
    op.create_index(
        op.f("ix_broker_pages_workspace_id"), "broker_pages", ["workspace_id"], unique=False
    )
    op.create_table(
        "page_events",
        sa.Column("page_id", sa.Uuid(), nullable=False),
        sa.Column(
            "kind",
            sa.Enum(
                "page_view",
                "property_view",
                "whatsapp_click",
                name="page_event_kind",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column(
            "source",
            sa.Enum(
                "link",
                "qr",
                "campaign",
                "direct",
                name="page_source",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("property_code", sa.String(length=16), server_default="", nullable=False),
        sa.Column("visitor_key", sa.String(length=64), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["page_id"],
            ["broker_pages.id"],
            name=op.f("fk_page_events_page_id_broker_pages"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_page_events_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_page_events")),
        sa.UniqueConstraint(
            "page_id", "kind", "property_code", "visitor_key", "day", name="uq_page_events_daily"
        ),
    )
    op.create_index(op.f("ix_page_events_page_id"), "page_events", ["page_id"], unique=False)
    op.create_index(
        op.f("ix_page_events_workspace_id"), "page_events", ["workspace_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_page_events_workspace_id"), table_name="page_events")
    op.drop_index(op.f("ix_page_events_page_id"), table_name="page_events")
    op.drop_table("page_events")
    op.drop_index(op.f("ix_broker_pages_workspace_id"), table_name="broker_pages")
    op.drop_table("broker_pages")
