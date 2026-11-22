"""CRM core (CRM-1): contacts, interests, consents with proof, notes, pipeline stages, leads,
tasks, conversations, messages, calendar settings, blocks, appointments and key events.

Revision ID: 0017
Revises: 0016
Create Date: 2026-11-22 00:12:35.776821+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0017"
down_revision: str | None = "0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "calendar_blocks",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "source",
            sa.Enum(
                "manual",
                "google",
                name="block_source",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
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
            ["user_id"],
            ["users.id"],
            name=op.f("fk_calendar_blocks_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_calendar_blocks_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_calendar_blocks")),
    )
    op.create_index(
        op.f("ix_calendar_blocks_user_id"), "calendar_blocks", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_calendar_blocks_workspace_id"), "calendar_blocks", ["workspace_id"], unique=False
    )
    op.create_table(
        "calendar_settings",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("visit_minutes", sa.Integer(), nullable=False),
        sa.Column("buffer_minutes", sa.Integer(), nullable=False),
        sa.Column("other_neighborhood_buffer_minutes", sa.Integer(), nullable=False),
        sa.Column("lead_time_minutes", sa.Integer(), nullable=False),
        sa.Column("days_ahead", sa.Integer(), nullable=False),
        sa.Column("weekly_hours", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("neighborhoods_by_day", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
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
            ["user_id"],
            ["users.id"],
            name=op.f("fk_calendar_settings_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_calendar_settings_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_calendar_settings")),
        sa.UniqueConstraint("user_id", name="uq_calendar_settings_user"),
    )
    op.create_index(
        op.f("ix_calendar_settings_workspace_id"),
        "calendar_settings",
        ["workspace_id"],
        unique=False,
    )
    op.create_table(
        "people",
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("phone_e164", sa.String(length=20), nullable=True),
        sa.Column("email", sa.String(length=254), nullable=True),
        sa.Column("instagram_handle", sa.String(length=60), nullable=True),
        sa.Column(
            "kind",
            sa.Enum(
                "buyer",
                "tenant",
                "owner",
                "unknown",
                name="contact_kind",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            server_default="unknown",
            nullable=False,
        ),
        sa.Column(
            "source",
            sa.Enum(
                "broker_page",
                "listing_page",
                "finder",
                "owner_form",
                "instagram",
                "whatsapp",
                "qr_sign",
                "import",
                "manual",
                name="contact_source",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("source_detail", sa.String(length=160), nullable=True),
        sa.Column("utm_source", sa.String(length=120), nullable=True),
        sa.Column("utm_medium", sa.String(length=120), nullable=True),
        sa.Column("utm_campaign", sa.String(length=120), nullable=True),
        sa.Column("responsible_user_id", sa.Uuid(), nullable=True),
        sa.Column("last_interaction_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["responsible_user_id"],
            ["users.id"],
            name=op.f("fk_people_responsible_user_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_people_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_people")),
    )
    op.create_index(op.f("ix_people_workspace_id"), "people", ["workspace_id"], unique=False)
    op.create_index(
        "uq_people_workspace_email",
        "people",
        ["workspace_id", "email"],
        unique=True,
        postgresql_where=sa.text("email IS NOT NULL"),
    )
    op.create_index(
        "uq_people_workspace_phone",
        "people",
        ["workspace_id", "phone_e164"],
        unique=True,
        postgresql_where=sa.text("phone_e164 IS NOT NULL"),
    )
    op.create_table(
        "pipeline_stages",
        sa.Column("key", sa.String(length=40), nullable=True),
        sa.Column("name", sa.String(length=60), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column(
            "kind",
            sa.Enum(
                "open",
                "won",
                "lost",
                name="stage_kind",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
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
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_pipeline_stages_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_pipeline_stages")),
    )
    op.create_index(
        op.f("ix_pipeline_stages_workspace_id"), "pipeline_stages", ["workspace_id"], unique=False
    )
    op.create_table(
        "consents",
        sa.Column("person_id", sa.Uuid(), nullable=False),
        sa.Column(
            "channel",
            sa.Enum(
                "whatsapp",
                "instagram",
                "email",
                name="channel",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column(
            "purpose",
            sa.Enum(
                "contact_about_properties",
                "marketing",
                name="consent_purpose",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "granted",
                "revoked",
                name="consent_status",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "proof_source",
            sa.Enum(
                "form",
                "conversation",
                "broker",
                "opt_out",
                name="proof_source",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("proof_location", sa.String(length=300), nullable=True),
        sa.Column("proof_text", sa.Text(), nullable=True),
        sa.Column("recorded_by_user_id", sa.Uuid(), nullable=True),
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
            ["person_id"],
            ["people.id"],
            name=op.f("fk_consents_person_id_people"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["recorded_by_user_id"],
            ["users.id"],
            name=op.f("fk_consents_recorded_by_user_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_consents_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_consents")),
    )
    op.create_index(
        "ix_consents_person_channel_purpose",
        "consents",
        ["person_id", "channel", "purpose"],
        unique=False,
    )
    op.create_index(op.f("ix_consents_person_id"), "consents", ["person_id"], unique=False)
    op.create_index(op.f("ix_consents_workspace_id"), "consents", ["workspace_id"], unique=False)
    op.create_table(
        "contact_interests",
        sa.Column("person_id", sa.Uuid(), nullable=False),
        sa.Column(
            "purpose",
            sa.Enum(
                "buy",
                "rent",
                "sell",
                "let",
                name="purpose",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column(
            "neighborhoods",
            postgresql.ARRAY(sa.String(length=120)),
            server_default="{}",
            nullable=False,
        ),
        sa.Column("city", sa.String(length=120), nullable=True),
        sa.Column(
            "property_kinds",
            postgresql.ARRAY(sa.String(length=32)),
            server_default="{}",
            nullable=False,
        ),
        sa.Column("min_price_cents", sa.Integer(), nullable=True),
        sa.Column("max_price_cents", sa.Integer(), nullable=True),
        sa.Column("min_bedrooms", sa.Integer(), nullable=True),
        sa.Column("min_parking", sa.Integer(), nullable=True),
        sa.Column(
            "source",
            sa.Enum(
                "form",
                "conversation",
                "broker",
                name="interest_source",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
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
            ["person_id"],
            ["people.id"],
            name=op.f("fk_contact_interests_person_id_people"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_contact_interests_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_contact_interests")),
    )
    op.create_index(
        op.f("ix_contact_interests_person_id"), "contact_interests", ["person_id"], unique=False
    )
    op.create_index(
        op.f("ix_contact_interests_workspace_id"),
        "contact_interests",
        ["workspace_id"],
        unique=False,
    )
    op.create_table(
        "contact_notes",
        sa.Column("person_id", sa.Uuid(), nullable=False),
        sa.Column("author_user_id", sa.Uuid(), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
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
            ["author_user_id"],
            ["users.id"],
            name=op.f("fk_contact_notes_author_user_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["person_id"],
            ["people.id"],
            name=op.f("fk_contact_notes_person_id_people"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_contact_notes_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_contact_notes")),
    )
    op.create_index(
        op.f("ix_contact_notes_person_id"), "contact_notes", ["person_id"], unique=False
    )
    op.create_index(
        op.f("ix_contact_notes_workspace_id"), "contact_notes", ["workspace_id"], unique=False
    )
    op.create_table(
        "key_events",
        sa.Column(
            "kind",
            sa.Enum(
                "contact_created",
                "contact_replied",
                "pipeline_moved",
                "property_created",
                "property_edited",
                "property_published",
                "visit_booked",
                "automation_changed",
                "agent_changed",
                "consent_changed",
                name="key_event_kind",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column(
            "actor",
            sa.Enum(
                "broker",
                "contact",
                "agent",
                "automation",
                "system",
                name="event_actor",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("person_id", sa.Uuid(), nullable=True),
        sa.Column("entity", sa.String(length=40), nullable=False),
        sa.Column("entity_id", sa.String(length=64), nullable=True),
        sa.Column("is_activity", sa.Boolean(), nullable=False),
        sa.Column(
            "payload", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False
        ),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["person_id"],
            ["people.id"],
            name=op.f("fk_key_events_person_id_people"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_key_events_user_id_users"), ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_key_events_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_key_events")),
    )
    op.create_index(op.f("ix_key_events_person_id"), "key_events", ["person_id"], unique=False)
    op.create_index(
        op.f("ix_key_events_workspace_id"), "key_events", ["workspace_id"], unique=False
    )
    op.create_index(
        "ix_key_events_workspace_occurred",
        "key_events",
        ["workspace_id", "occurred_at"],
        unique=False,
    )
    op.create_table(
        "leads",
        sa.Column("person_id", sa.Uuid(), nullable=False),
        sa.Column("property_id", sa.Uuid(), nullable=True),
        sa.Column("stage_id", sa.Uuid(), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("campaign_id", sa.Uuid(), nullable=True),
        sa.Column("acquisition_cost_cents", sa.Integer(), nullable=True),
        sa.Column(
            "qualification",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column("responsible_user_id", sa.Uuid(), nullable=True),
        sa.Column("stage_changed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("lost_reason", sa.String(length=300), nullable=True),
        sa.Column("automations_paused", sa.Boolean(), server_default="false", nullable=False),
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
        sa.ForeignKeyConstraint(
            ["person_id"], ["people.id"], name=op.f("fk_leads_person_id_people"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["property_id"],
            ["properties.id"],
            name=op.f("fk_leads_property_id_properties"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["responsible_user_id"],
            ["users.id"],
            name=op.f("fk_leads_responsible_user_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["stage_id"],
            ["pipeline_stages.id"],
            name=op.f("fk_leads_stage_id_pipeline_stages"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_leads_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_leads")),
    )
    op.create_index(op.f("ix_leads_person_id"), "leads", ["person_id"], unique=False)
    op.create_index(op.f("ix_leads_property_id"), "leads", ["property_id"], unique=False)
    op.create_index(op.f("ix_leads_stage_id"), "leads", ["stage_id"], unique=False)
    op.create_index(op.f("ix_leads_workspace_id"), "leads", ["workspace_id"], unique=False)
    op.create_table(
        "appointments",
        sa.Column("broker_user_id", sa.Uuid(), nullable=False),
        sa.Column("person_id", sa.Uuid(), nullable=False),
        sa.Column("lead_id", sa.Uuid(), nullable=True),
        sa.Column("property_id", sa.Uuid(), nullable=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("neighborhood", sa.String(length=120), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "proposed",
                "confirmed",
                "done",
                "cancelled",
                "no_show",
                name="appointment_status",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column(
            "booked_by",
            sa.Enum(
                "broker",
                "contact",
                "agent",
                name="booked_by",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column(
            "reminders",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column("cancelled_reason", sa.String(length=300), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["broker_user_id"],
            ["users.id"],
            name=op.f("fk_appointments_broker_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["lead_id"],
            ["leads.id"],
            name=op.f("fk_appointments_lead_id_leads"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["person_id"],
            ["people.id"],
            name=op.f("fk_appointments_person_id_people"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["property_id"],
            ["properties.id"],
            name=op.f("fk_appointments_property_id_properties"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_appointments_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_appointments")),
    )
    op.create_index(
        op.f("ix_appointments_broker_user_id"), "appointments", ["broker_user_id"], unique=False
    )
    op.create_index(op.f("ix_appointments_person_id"), "appointments", ["person_id"], unique=False)
    op.create_index(op.f("ix_appointments_starts_at"), "appointments", ["starts_at"], unique=False)
    op.create_index(
        op.f("ix_appointments_workspace_id"), "appointments", ["workspace_id"], unique=False
    )
    op.create_table(
        "conversations",
        sa.Column("person_id", sa.Uuid(), nullable=False),
        sa.Column("lead_id", sa.Uuid(), nullable=True),
        sa.Column(
            "channel",
            sa.Enum(
                "whatsapp",
                "instagram",
                "facebook",
                "page",
                name="conversation_channel",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column(
            "ai_mode",
            sa.Enum(
                "active",
                "paused",
                "handed_off",
                name="ai_mode",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            server_default="paused",
            nullable=False,
        ),
        sa.Column("handoff_reason", sa.String(length=300), nullable=True),
        sa.Column("assigned_user_id", sa.Uuid(), nullable=True),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_inbound_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("unread_count", sa.Integer(), server_default="0", nullable=False),
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
        sa.ForeignKeyConstraint(
            ["assigned_user_id"],
            ["users.id"],
            name=op.f("fk_conversations_assigned_user_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["lead_id"],
            ["leads.id"],
            name=op.f("fk_conversations_lead_id_leads"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["person_id"],
            ["people.id"],
            name=op.f("fk_conversations_person_id_people"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_conversations_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_conversations")),
    )
    op.create_index(
        op.f("ix_conversations_last_message_at"), "conversations", ["last_message_at"], unique=False
    )
    op.create_index(
        op.f("ix_conversations_person_id"), "conversations", ["person_id"], unique=False
    )
    op.create_index(
        op.f("ix_conversations_workspace_id"), "conversations", ["workspace_id"], unique=False
    )
    op.create_table(
        "tasks",
        sa.Column("person_id", sa.Uuid(), nullable=False),
        sa.Column("lead_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("done_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("assigned_user_id", sa.Uuid(), nullable=True),
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
            ["assigned_user_id"],
            ["users.id"],
            name=op.f("fk_tasks_assigned_user_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["lead_id"], ["leads.id"], name=op.f("fk_tasks_lead_id_leads"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["person_id"], ["people.id"], name=op.f("fk_tasks_person_id_people"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_tasks_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tasks")),
    )
    op.create_index(op.f("ix_tasks_person_id"), "tasks", ["person_id"], unique=False)
    op.create_index(op.f("ix_tasks_workspace_id"), "tasks", ["workspace_id"], unique=False)
    op.create_table(
        "messages",
        sa.Column("conversation_id", sa.Uuid(), nullable=False),
        sa.Column(
            "direction",
            sa.Enum(
                "inbound",
                "outbound",
                name="direction",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column(
            "author",
            sa.Enum(
                "contact",
                "broker",
                "automation",
                "agent",
                "system",
                name="author",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("author_user_id", sa.Uuid(), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "received",
                "queued",
                "sent",
                "delivered",
                "read",
                "failed",
                name="message_status",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("external_id", sa.String(length=120), nullable=True),
        sa.Column("idempotency_key", sa.String(length=120), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("failure_reason", sa.String(length=300), nullable=True),
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
            ["author_user_id"],
            ["users.id"],
            name=op.f("fk_messages_author_user_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["conversations.id"],
            name=op.f("fk_messages_conversation_id_conversations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_messages_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_messages")),
        sa.UniqueConstraint("workspace_id", "idempotency_key", name="uq_messages_idempotency"),
    )
    op.create_index(
        op.f("ix_messages_conversation_id"), "messages", ["conversation_id"], unique=False
    )
    op.create_index(op.f("ix_messages_workspace_id"), "messages", ["workspace_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_messages_workspace_id"), table_name="messages")
    op.drop_index(op.f("ix_messages_conversation_id"), table_name="messages")
    op.drop_table("messages")
    op.drop_index(op.f("ix_tasks_workspace_id"), table_name="tasks")
    op.drop_index(op.f("ix_tasks_person_id"), table_name="tasks")
    op.drop_table("tasks")
    op.drop_index(op.f("ix_conversations_workspace_id"), table_name="conversations")
    op.drop_index(op.f("ix_conversations_person_id"), table_name="conversations")
    op.drop_index(op.f("ix_conversations_last_message_at"), table_name="conversations")
    op.drop_table("conversations")
    op.drop_index(op.f("ix_appointments_workspace_id"), table_name="appointments")
    op.drop_index(op.f("ix_appointments_starts_at"), table_name="appointments")
    op.drop_index(op.f("ix_appointments_person_id"), table_name="appointments")
    op.drop_index(op.f("ix_appointments_broker_user_id"), table_name="appointments")
    op.drop_table("appointments")
    op.drop_index(op.f("ix_leads_workspace_id"), table_name="leads")
    op.drop_index(op.f("ix_leads_stage_id"), table_name="leads")
    op.drop_index(op.f("ix_leads_property_id"), table_name="leads")
    op.drop_index(op.f("ix_leads_person_id"), table_name="leads")
    op.drop_table("leads")
    op.drop_index("ix_key_events_workspace_occurred", table_name="key_events")
    op.drop_index(op.f("ix_key_events_workspace_id"), table_name="key_events")
    op.drop_index(op.f("ix_key_events_person_id"), table_name="key_events")
    op.drop_table("key_events")
    op.drop_index(op.f("ix_contact_notes_workspace_id"), table_name="contact_notes")
    op.drop_index(op.f("ix_contact_notes_person_id"), table_name="contact_notes")
    op.drop_table("contact_notes")
    op.drop_index(op.f("ix_contact_interests_workspace_id"), table_name="contact_interests")
    op.drop_index(op.f("ix_contact_interests_person_id"), table_name="contact_interests")
    op.drop_table("contact_interests")
    op.drop_index(op.f("ix_consents_workspace_id"), table_name="consents")
    op.drop_index(op.f("ix_consents_person_id"), table_name="consents")
    op.drop_index("ix_consents_person_channel_purpose", table_name="consents")
    op.drop_table("consents")
    op.drop_index(op.f("ix_pipeline_stages_workspace_id"), table_name="pipeline_stages")
    op.drop_table("pipeline_stages")
    op.drop_index(
        "uq_people_workspace_phone",
        table_name="people",
        postgresql_where=sa.text("phone_e164 IS NOT NULL"),
    )
    op.drop_index(
        "uq_people_workspace_email",
        table_name="people",
        postgresql_where=sa.text("email IS NOT NULL"),
    )
    op.drop_index(op.f("ix_people_workspace_id"), table_name="people")
    op.drop_table("people")
    op.drop_index(op.f("ix_calendar_settings_workspace_id"), table_name="calendar_settings")
    op.drop_table("calendar_settings")
    op.drop_index(op.f("ix_calendar_blocks_workspace_id"), table_name="calendar_blocks")
    op.drop_index(op.f("ix_calendar_blocks_user_id"), table_name="calendar_blocks")
    op.drop_table("calendar_blocks")
