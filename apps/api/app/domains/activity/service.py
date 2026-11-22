from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time import utcnow
from app.domains.activity.models import EventActor, KeyEvent, KeyEventKind, is_activity


def emit(
    session: AsyncSession,
    kind: KeyEventKind,
    actor: EventActor,
    entity: str,
    entity_id: uuid.UUID | str | None = None,
    *,
    user_id: uuid.UUID | None = None,
    person_id: uuid.UUID | None = None,
    **payload: Any,
) -> KeyEvent:
    event = KeyEvent(
        kind=kind,
        actor=actor,
        user_id=user_id,
        person_id=person_id,
        entity=entity,
        entity_id=str(entity_id) if entity_id is not None else None,
        is_activity=is_activity(kind, actor),
        payload=payload,
        occurred_at=utcnow(),
    )
    session.add(event)
    return event
