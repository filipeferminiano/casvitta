"""A tenant table that exists only in tests, to exercise app.core.tenancy."""

from __future__ import annotations

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.core.models import UUIDPrimaryKey, WorkspaceScoped
from app.core.tenancy import TenantRepository


class TenancyProbe(UUIDPrimaryKey, WorkspaceScoped, Base):
    __tablename__ = "test_tenancy_probe"

    label: Mapped[str] = mapped_column(String(40))


class TenancyProbeRepository(TenantRepository[TenancyProbe]):
    model = TenancyProbe
