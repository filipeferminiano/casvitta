from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.domains.accounts.models import CreciKind, CreciReviewStatus, Plan
from app.domains.interest.schemas import normalize_br_phone

# Deliberately loose: the email link itself proves the address works.
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_CRECI_NUMBER = re.compile(r"^\d{3}\.?\d{3}$")
UFS = frozenset(
    [
        "AC",
        "AL",
        "AM",
        "AP",
        "BA",
        "CE",
        "DF",
        "ES",
        "GO",
        "MA",
        "MG",
        "MS",
        "MT",
        "PA",
        "PB",
        "PE",
        "PI",
        "PR",
        "RJ",
        "RN",
        "RO",
        "RR",
        "RS",
        "SC",
        "SE",
        "SP",
        "TO",
    ]
)


def _email(value: str) -> str:
    cleaned = value.strip().lower()
    if not _EMAIL.match(cleaned) or len(cleaned) > 320:
        raise ValueError("invalid_email")
    return cleaned


class EmailLinkIn(BaseModel):
    email: str
    intent: Literal["sign_in", "sign_up"]
    # Sign-up only: shown on the account and kept until the email is confirmed.
    name: str | None = Field(default=None, min_length=2, max_length=160)
    plan: Plan | None = None

    @field_validator("email")
    @classmethod
    def _check_email(cls, value: str) -> str:
        return _email(value)

    @field_validator("name")
    @classmethod
    def _name(cls, value: str | None) -> str | None:
        return " ".join(value.split()) if value else value


class EmailLinkSent(BaseModel):
    """Same body whether or not the address has an account (no account enumeration)."""

    status: Literal["sent"] = "sent"


class TokenIn(BaseModel):
    token: str = Field(min_length=20, max_length=200)


class SignedIn(BaseModel):
    # sign_up: a new account was created and the signup steps continue.
    intent: Literal["sign_in", "sign_up"]


class HandoffOut(BaseModel):
    code: str


class UserOut(BaseModel):
    id: uuid.UUID
    name: str
    email: str


class WorkspaceOut(BaseModel):
    id: uuid.UUID
    name: str
    plan: Plan
    is_demo: bool


CreciStatus = Literal["missing", "pending", "verified"]


class BrokerProfileOut(BaseModel):
    id: uuid.UUID
    display_name: str
    slug: str
    creci_name: str | None
    creci_number: str | None
    creci_state: str | None
    creci_kind: CreciKind | None
    creci_status: CreciStatus
    creci_verified_at: datetime | None
    whatsapp_e164: str | None
    regions: list[str]
    is_demo: bool
    creci_review_status: CreciReviewStatus | None = None
    creci_review_reason: str | None = None


class MeOut(BaseModel):
    user: UserOut
    workspace: WorkspaceOut
    broker: BrokerProfileOut | None
    # Name of the staff member viewing as this customer (read-only session), if any.
    viewing_as: str | None = None


class BrokerProfileUpdate(BaseModel):
    """Signup steps and Configurações. Changing the CRECI sends it back to staff review."""

    display_name: str | None = Field(default=None, min_length=2, max_length=160)
    creci_name: str | None = Field(default=None, min_length=2, max_length=160)
    creci_number: str | None = None
    creci_state: str | None = None
    creci_kind: CreciKind | None = None
    whatsapp: str | None = None

    @field_validator("creci_number")
    @classmethod
    def _creci_number(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not _CRECI_NUMBER.match(value.strip()):
            raise ValueError("invalid_creci")
        digits = re.sub(r"\D", "", value)
        return f"{digits[:3]}.{digits[3:]}"

    @field_validator("creci_state")
    @classmethod
    def _creci_state(cls, value: str | None) -> str | None:
        if value is None:
            return None
        upper = value.strip().upper()
        if upper not in UFS:
            raise ValueError("invalid_uf")
        return upper

    @field_validator("whatsapp")
    @classmethod
    def _whatsapp(cls, value: str | None) -> str | None:
        return normalize_br_phone(value) if value is not None else None


class WorkspaceUpdate(BaseModel):
    plan: Plan


class AdminBrokerOut(BrokerProfileOut):
    workspace_id: uuid.UUID
    email: str
    creci_submitted_at: datetime | None
