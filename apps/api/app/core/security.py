"""Secrets for sign-in: random tokens (stored only as hashes) and short-lived JWT access tokens."""

from __future__ import annotations

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta

import jwt

from app.core.settings import Settings
from app.core.time import utcnow

_ALGORITHM = "HS256"
_AUDIENCE = "casvitta-app"
# Backoffice tokens: a different audience, so neither kind of token is accepted for the other.
_STAFF_AUDIENCE = "casvitta-staff"


def new_token() -> str:
    """URL-safe random secret (256 bits) for email links, refresh tokens and handoff codes."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@dataclass(frozen=True, slots=True)
class AccessClaims:
    user_id: uuid.UUID
    workspace_id: uuid.UUID
    expires_at: datetime
    # Set when a staff member is viewing as this customer ("Ver como o cliente", BO5): the
    # session is read-only and writes are refused (app/core/read_only.py).
    acting_staff_id: uuid.UUID | None = None

    @property
    def read_only(self) -> bool:
        return self.acting_staff_id is not None


def encode_access_token(
    settings: Settings,
    user_id: uuid.UUID,
    workspace_id: uuid.UUID,
    now: datetime | None = None,
    *,
    acting_staff_id: uuid.UUID | None = None,
) -> str:
    issued = now or utcnow()
    payload: dict[str, object] = {
        "sub": str(user_id),
        "ws": str(workspace_id),
        "aud": _AUDIENCE,
        "iat": issued,
        "exp": issued + timedelta(minutes=settings.access_token_ttl_minutes),
    }
    if acting_staff_id is not None:
        payload["act"] = str(acting_staff_id)
    return jwt.encode(payload, settings.jwt_secret.get_secret_value(), algorithm=_ALGORITHM)


class InvalidAccessToken(Exception):
    pass


def decode_access_token(settings: Settings, token: str) -> AccessClaims:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret.get_secret_value(),
            algorithms=[_ALGORITHM],
            audience=_AUDIENCE,
            options={"require": ["sub", "ws", "exp"]},
        )
        return AccessClaims(
            user_id=uuid.UUID(payload["sub"]),
            workspace_id=uuid.UUID(payload["ws"]),
            expires_at=datetime.fromtimestamp(payload["exp"], tz=utcnow().tzinfo),
            acting_staff_id=uuid.UUID(payload["act"]) if payload.get("act") else None,
        )
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise InvalidAccessToken from exc


@dataclass(frozen=True, slots=True)
class StaffClaims:
    staff_id: uuid.UUID
    family_id: uuid.UUID
    authenticated_at: datetime
    expires_at: datetime


def encode_staff_token(
    settings: Settings,
    staff_id: uuid.UUID,
    family_id: uuid.UUID,
    authenticated_at: datetime,
    now: datetime | None = None,
) -> str:
    issued = now or utcnow()
    payload = {
        "sub": str(staff_id),
        "fam": str(family_id),
        "auth": int(authenticated_at.timestamp()),
        "aud": _STAFF_AUDIENCE,
        "iat": issued,
        "exp": issued + timedelta(minutes=settings.staff_access_token_ttl_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret.get_secret_value(), algorithm=_ALGORITHM)


def decode_staff_token(settings: Settings, token: str) -> StaffClaims:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret.get_secret_value(),
            algorithms=[_ALGORITHM],
            audience=_STAFF_AUDIENCE,
            options={"require": ["sub", "fam", "auth", "exp"]},
        )
        tz = utcnow().tzinfo
        return StaffClaims(
            staff_id=uuid.UUID(payload["sub"]),
            family_id=uuid.UUID(payload["fam"]),
            authenticated_at=datetime.fromtimestamp(int(payload["auth"]), tz=tz),
            expires_at=datetime.fromtimestamp(payload["exp"], tz=tz),
        )
    except (jwt.PyJWTError, KeyError, ValueError, TypeError) as exc:
        raise InvalidAccessToken from exc
