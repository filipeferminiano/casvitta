from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.domains.alerts.models import AlertIntent, AlertScope, AlertStatus
from app.domains.interest.schemas import ConsentIn, Strict, Utm, normalize_br_phone


class PropertyAlertIn(Strict):
    """The page says where it is by slugs; the server resolves them (never trusts ids)."""

    scope: AlertScope
    city: str = Field(min_length=2, max_length=60)
    neighborhood: str = Field(min_length=2, max_length=80)
    street: str | None = Field(default=None, max_length=140)
    building: str | None = Field(default=None, max_length=180)
    intent: AlertIntent
    name: str = Field(min_length=2, max_length=120)
    phone: str
    email: str | None = Field(default=None, max_length=254)
    consents: ConsentIn
    utm: Utm = Field(default_factory=Utm)
    source_page: str | None = Field(default=None, max_length=300)
    # Honeypot: real users never see or fill it.
    website: str | None = None

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: str) -> str:
        return normalize_br_phone(value)

    @field_validator("email")
    @classmethod
    def _email(cls, value: str | None) -> str | None:
        if value in (None, ""):
            return None
        if "@" not in value or "." not in value.rsplit("@", 1)[-1]:
            raise ValueError("invalid_email")
        return value.lower()

    @model_validator(mode="after")
    def _scope_slugs(self) -> PropertyAlertIn:
        if self.scope is AlertScope.STREET and not self.street:
            raise ValueError("street slug required for a street alert")
        if self.scope is AlertScope.BUILDING and not self.building:
            raise ValueError("building slug required for a building alert")
        return self


class PropertyAlertAccepted(BaseModel):
    status: Literal["stored"] = "stored"


class PropertyAlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    scope: AlertScope
    scope_name: str
    scope_path: str
    intent: AlertIntent
    name: str
    phone_e164: str
    email: str | None
    status: AlertStatus
    contact_consent: bool
    marketing_consent: bool
    source_page: str | None
    created_at: datetime
