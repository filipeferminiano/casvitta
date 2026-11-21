"""Who is acting (a staff member, a script with the admin token, or the system) and the audit log.

Every staff write, every reveal of personal data and every export goes through `record`
(CLAUDE.md rule 8). The log is append-only.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time import utcnow
from app.domains.accounts.models import AuditLog
from app.domains.staff.permissions import Permission

ADMIN_TOKEN_ACTOR = "system:admin-token"  # noqa: S105 - an actor label, not a secret
SYSTEM_ACTOR = "system"


@dataclass(frozen=True, slots=True)
class Actor:
    kind: Literal["staff", "admin_token", "system"]
    label: str  # value of audit_log.actor
    name: str  # shown in the backoffice
    staff_id: uuid.UUID | None = None
    permissions: frozenset[Permission] = field(default_factory=frozenset)
    authenticated_at: datetime | None = None

    def can(self, permission: Permission) -> bool:
        return permission in self.permissions

    @classmethod
    def staff(
        cls,
        staff_id: uuid.UUID,
        name: str,
        permissions: frozenset[Permission],
        authenticated_at: datetime | None,
    ) -> Actor:
        return cls("staff", f"staff:{staff_id}", name, staff_id, permissions, authenticated_at)

    @classmethod
    def admin_token(cls) -> Actor:
        # Scripts and CI. Only accepted while ADMIN_TOKEN_ENABLED is on.
        return cls("admin_token", ADMIN_TOKEN_ACTOR, "Script", None, frozenset(Permission))

    @classmethod
    def system(cls) -> Actor:
        return cls("system", SYSTEM_ACTOR, "Sistema", None, frozenset(Permission))


def record(
    session: AsyncSession,
    actor: Actor,
    action: str,
    entity: str,
    entity_id: str | uuid.UUID | None = None,
    *,
    reason: str | None = None,
    **details: Any,
) -> None:
    session.add(
        AuditLog(
            actor=actor.label,
            actor_staff_id=actor.staff_id,
            action=action,
            entity=entity,
            entity_id=str(entity_id) if entity_id is not None else None,
            reason=reason,
            details=details,
            occurred_at=utcnow(),
        )
    )
