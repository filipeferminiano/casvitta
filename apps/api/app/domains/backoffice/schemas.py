from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.domains.interest.models import InterestKind


class OverviewTiles(BaseModel):
    """Only numbers that exist in the database today. Tiles without data are absent, not zero."""

    brokers_total: int
    brokers_this_week: int
    creci_pending: int
    creci_pending_over_sla: int
    captures_7d: int
    captures_7d_auction: int


class QueueItem(BaseModel):
    """A line of "Precisa de você": a queue that waits for someone, with a link target."""

    key: Literal["creci", "owner_requests", "institutional_investors"]
    count: int
    over_sla: int = 0  # CRECI: requests older than the promised review time


class CaptureKindRow(BaseModel):
    kind: InterestKind
    last_7d: int
    confirmed_7d: int  # WhatsApp opt-in confirmed
    open: int | None  # waiting for the team; None while the kind has no handling step


class FunnelStep(BaseModel):
    key: Literal["signed_up", "creci_sent", "creci_verified"]
    count: int


class ActivityItem(BaseModel):
    occurred_at: datetime
    actor_name: str
    action: str
    details: dict[str, object]


class OverviewOut(BaseModel):
    tiles: OverviewTiles
    queue: list[QueueItem]
    captures: list[CaptureKindRow]
    funnel: list[FunnelStep]
    # None when the person cannot see the audit log (Leitura).
    activity: list[ActivityItem] | None
    creci_sla_hours: int


class SearchHit(BaseModel):
    kind: Literal["account", "person", "creci"]
    id: uuid.UUID  # workspace (account), interest signup (person) or broker profile (creci)
    title: str
    subtitle: str  # masked contact, CRECI, kind of capture
    is_demo: bool = False


class SearchOut(BaseModel):
    query: str
    hits: list[SearchHit]
