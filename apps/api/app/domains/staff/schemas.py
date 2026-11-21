from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from app.domains.accounts.schemas import _email
from app.domains.staff.models import StaffRole
from app.domains.staff.permissions import Permission


class StaffEmailLinkIn(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def _check_email(cls, value: str) -> str:
        return _email(value)


class StaffTokenIn(BaseModel):
    token: str = Field(min_length=20, max_length=200)


class ReauthCodeIn(BaseModel):
    code: str = Field(pattern=r"^\d{6}$")


class StaffMeOut(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    role: StaffRole
    permissions: list[Permission]
    # Sensitive actions work without a new code until this moment.
    reauth_valid_until: datetime | None
    environment: Literal["production", "staging", "development"]
    modules: list[str]


class StaffMemberOut(BaseModel):
    id: uuid.UUID
    name: str
    email: str  # masked: "filipe@…"
    role: StaffRole
    active: bool
    last_seen_at: datetime | None


class StaffInviteIn(BaseModel):
    email: str
    name: str = Field(min_length=2, max_length=160)
    role: StaffRole

    @field_validator("email")
    @classmethod
    def _check_email(cls, value: str) -> str:
        return _email(value)

    @field_validator("name")
    @classmethod
    def _name(cls, value: str) -> str:
        return " ".join(value.split())


class StaffUpdateIn(BaseModel):
    role: StaffRole | None = None
    active: bool | None = None


class StaffBootstrapIn(BaseModel):
    email: str
    name: str = Field(min_length=2, max_length=160)

    @field_validator("email")
    @classmethod
    def _check_email(cls, value: str) -> str:
        return _email(value)


class AuditEntryOut(BaseModel):
    id: uuid.UUID
    occurred_at: datetime
    actor: str
    actor_name: str  # staff name, "Sistema" or "Script"
    actor_staff_id: uuid.UUID | None
    action: str
    entity: str
    entity_id: str | None
    reason: str | None
    details: dict[str, Any]


class AuditPage(BaseModel):
    items: list[AuditEntryOut]
    # Pass as `before` to get the next (older) page; null on the last page.
    next_before: datetime | None
    actions: list[str]  # every action in the log, for the filter
