"""Reusable column mixins for ORM models."""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, func, sql
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column


class UUIDPrimaryKey:
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)


class Timestamps:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class DemoFlag:
    """Seed/demo records carry is_demo=true; the UI shows the "Demonstrativo" badge on them."""

    is_demo: Mapped[bool] = mapped_column(default=False, server_default=sql.false(), nullable=False)


class WorkspaceScoped:
    """Marks a tenant table. Reads and writes are confined to the session's workspace.

    See app.core.tenancy for the enforcement.
    """

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=False
    )


def str_enum(enum_cls: type[StrEnum], length: int = 32, *, name: str | None = None) -> SAEnum:
    """Store a StrEnum as VARCHAR + CHECK constraint (no native PG enum: simpler migrations).

    `name` names the CHECK constraint; pass one when a table has two columns of the same enum.
    """
    return SAEnum(
        enum_cls,
        name=name or _snake(enum_cls.__name__),
        native_enum=False,
        create_constraint=True,
        length=length,
        values_callable=lambda members: [m.value for m in members],
        validate_strings=True,
    )


def _snake(name: str) -> str:
    return "".join(f"_{c.lower()}" if c.isupper() and i else c.lower() for i, c in enumerate(name))
