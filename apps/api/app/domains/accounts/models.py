from __future__ import annotations

from enum import StrEnum

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.core.models import DemoFlag, Timestamps, UUIDPrimaryKey, str_enum


class WorkspaceKind(StrEnum):
    BROKER = "broker"
    AGENCY = "agency"


class Workspace(UUIDPrimaryKey, Timestamps, DemoFlag, Base):
    """A tenant: an independent broker or an agency."""

    __tablename__ = "workspaces"

    name: Mapped[str] = mapped_column(String(160))
    kind: Mapped[WorkspaceKind] = mapped_column(
        str_enum(WorkspaceKind), default=WorkspaceKind.BROKER
    )
