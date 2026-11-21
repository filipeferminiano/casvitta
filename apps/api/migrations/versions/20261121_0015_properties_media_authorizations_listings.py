"""Properties, media, owner authorizations and listings (L-1, shared by Social and Destaques).

Revision ID: 0015
Revises: 0014
Create Date: 2026-11-21 20:10:47.516848+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0015"
down_revision: str | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Platform-wide property code ("CV-204"); starts at 100.
    op.execute(sa.schema.CreateSequence(sa.Sequence("property_code_seq", start=100)))
    op.create_table(
        "properties",
        sa.Column(
            "code_number",
            sa.Integer(),
            server_default=sa.text("nextval('property_code_seq')"),
            nullable=False,
        ),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("responsible_broker_id", sa.Uuid(), nullable=True),
        sa.Column(
            "kind",
            sa.Enum(
                "apartment",
                "house",
                "studio",
                "commercial",
                "land",
                name="property_kind",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column(
            "transaction",
            sa.Enum(
                "sale",
                "rent",
                name="transaction",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "draft",
                "active",
                "paused",
                "sold",
                "rented",
                name="property_status",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            server_default="draft",
            nullable=False,
        ),
        sa.Column(
            "source",
            sa.Enum(
                "casvitta",
                "manual",
                "import",
                name="property_source",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            server_default="casvitta",
            nullable=False,
        ),
        sa.Column("title", sa.String(length=160), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("street", sa.String(length=160), nullable=True),
        sa.Column("show_street", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("street_number", sa.String(length=16), nullable=True),
        sa.Column("complement", sa.String(length=80), nullable=True),
        sa.Column("postal_code", sa.String(length=9), nullable=True),
        sa.Column("neighborhood", sa.String(length=120), nullable=False),
        sa.Column("city", sa.String(length=120), nullable=False),
        sa.Column("state", sa.String(length=2), nullable=False),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("area_m2", sa.Integer(), nullable=True),
        sa.Column("bedrooms", sa.Integer(), nullable=True),
        sa.Column("bathrooms", sa.Integer(), nullable=True),
        sa.Column("parking", sa.Integer(), nullable=True),
        sa.Column(
            "features", postgresql.ARRAY(sa.String(length=80)), server_default="{}", nullable=False
        ),
        sa.Column("price_cents", sa.Integer(), nullable=False),
        sa.Column("condo_fee_cents", sa.Integer(), nullable=True),
        sa.Column("iptu_monthly_cents", sa.Integer(), nullable=True),
        sa.Column(
            "sync_status",
            sa.Enum(
                "ok",
                "failed",
                name="sync_status",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=True,
        ),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sync_error", sa.String(length=300), nullable=True),
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
        sa.Column("is_demo", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.CheckConstraint("price_cents >= 0", name=op.f("ck_properties_price_non_negative")),
        sa.ForeignKeyConstraint(
            ["responsible_broker_id"],
            ["broker_profiles.id"],
            name=op.f("fk_properties_responsible_broker_id_broker_profiles"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_properties_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_properties")),
        sa.UniqueConstraint("code_number", name=op.f("uq_properties_code_number")),
        sa.UniqueConstraint("workspace_id", "slug", name="uq_properties_workspace_slug"),
    )
    op.create_index(
        op.f("ix_properties_responsible_broker_id"),
        "properties",
        ["responsible_broker_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_properties_workspace_id"), "properties", ["workspace_id"], unique=False
    )
    op.create_table(
        "listings",
        sa.Column("property_id", sa.Uuid(), nullable=False),
        sa.Column(
            "channel",
            sa.Enum(
                "marketplace",
                "bio_page",
                "landing",
                "meta",
                "google",
                name="channel",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "draft",
                "published",
                "unpublished",
                "suspended",
                name="listing_status",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            server_default="draft",
            nullable=False,
        ),
        sa.Column("external_id", sa.String(length=120), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("unpublished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "unpublish_reason",
            sa.Enum(
                "broker",
                "authorization_expired",
                "property_unavailable",
                "staff",
                name="unpublish_reason",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=True,
        ),
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
            ["property_id"],
            ["properties.id"],
            name=op.f("fk_listings_property_id_properties"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_listings_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_listings")),
        sa.UniqueConstraint("property_id", "channel", name="uq_listings_property_channel"),
    )
    op.create_index(op.f("ix_listings_property_id"), "listings", ["property_id"], unique=False)
    op.create_index(op.f("ix_listings_workspace_id"), "listings", ["workspace_id"], unique=False)
    op.create_table(
        "owner_authorizations",
        sa.Column("property_id", sa.Uuid(), nullable=False),
        sa.Column(
            "kind",
            sa.Enum(
                "sale",
                "rent",
                name="transaction",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("exclusive", sa.Boolean(), nullable=False),
        sa.Column(
            "evidence",
            sa.Enum(
                "document",
                "attestation",
                name="authorization_evidence",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("owner_name", sa.String(length=160), nullable=False),
        sa.Column("document_key", sa.String(length=300), nullable=True),
        sa.Column("attested_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("signed_at", sa.Date(), nullable=False),
        sa.Column("expires_at", sa.Date(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
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
            ["attested_by_user_id"],
            ["users.id"],
            name=op.f("fk_owner_authorizations_attested_by_user_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["property_id"],
            ["properties.id"],
            name=op.f("fk_owner_authorizations_property_id_properties"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_owner_authorizations_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_owner_authorizations")),
    )
    op.create_index(
        op.f("ix_owner_authorizations_property_id"),
        "owner_authorizations",
        ["property_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_owner_authorizations_workspace_id"),
        "owner_authorizations",
        ["workspace_id"],
        unique=False,
    )
    op.create_table(
        "property_media",
        sa.Column("property_id", sa.Uuid(), nullable=False),
        sa.Column(
            "kind",
            sa.Enum(
                "photo",
                "floorplan",
                "video",
                name="media_kind",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("storage_key", sa.String(length=300), nullable=False),
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("is_cover", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("text_ratio", sa.Float(), nullable=True),
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
            ["property_id"],
            ["properties.id"],
            name=op.f("fk_property_media_property_id_properties"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_property_media_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_property_media")),
    )
    op.create_index(
        op.f("ix_property_media_property_id"), "property_media", ["property_id"], unique=False
    )
    op.create_index(
        op.f("ix_property_media_workspace_id"), "property_media", ["workspace_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_property_media_workspace_id"), table_name="property_media")
    op.drop_index(op.f("ix_property_media_property_id"), table_name="property_media")
    op.drop_table("property_media")
    op.drop_index(op.f("ix_owner_authorizations_workspace_id"), table_name="owner_authorizations")
    op.drop_index(op.f("ix_owner_authorizations_property_id"), table_name="owner_authorizations")
    op.drop_table("owner_authorizations")
    op.drop_index(op.f("ix_listings_workspace_id"), table_name="listings")
    op.drop_index(op.f("ix_listings_property_id"), table_name="listings")
    op.drop_table("listings")
    op.drop_index(op.f("ix_properties_workspace_id"), table_name="properties")
    op.drop_index(op.f("ix_properties_responsible_broker_id"), table_name="properties")
    op.drop_table("properties")
    op.execute(sa.schema.DropSequence(sa.Sequence("property_code_seq")))
