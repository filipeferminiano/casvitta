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


def encode_access_token(
    settings: Settings, user_id: uuid.UUID, workspace_id: uuid.UUID, now: datetime | None = None
) -> str:
    issued = now or utcnow()
    payload = {
        "sub": str(user_id),
        "ws": str(workspace_id),
        "aud": _AUDIENCE,
        "iat": issued,
        "exp": issued + timedelta(minutes=settings.access_token_ttl_minutes),
    }
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
        )
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise InvalidAccessToken from exc
