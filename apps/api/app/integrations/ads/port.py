"""Ad platform port, shared by Meta (Instagram/Facebook) and Google Ads adapters.

Budgets are integer cents. The platform cap is a second line of defense: our own spend cap is
enforced in the ads domain service (CLAUDE.md §4.10).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from enum import StrEnum
from typing import Protocol


class AdPlatform(StrEnum):
    META = "meta"
    GOOGLE = "google"


class ExternalCampaignStatus(StrEnum):
    IN_REVIEW = "in_review"
    ACTIVE = "active"
    PAUSED = "paused"
    REJECTED = "rejected"


@dataclass(frozen=True, slots=True)
class CampaignSpec:
    reference: str  # our campaign id, for idempotency
    name: str
    daily_budget_cents: int
    max_spend_cents: int
    starts_on: date
    ends_on: date | None
    landing_url: str
    title: str
    body: str
    image_urls: tuple[str, ...] = ()
    region: dict[str, object] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class ExternalCampaign:
    external_id: str
    status: ExternalCampaignStatus
    rejection_reason: str | None = None


@dataclass(frozen=True, slots=True)
class DailySpend:
    day: date
    spend_cents: int
    impressions: int
    clicks: int


class AdPlatformPort(Protocol):
    platform: AdPlatform

    async def create_campaign(self, spec: CampaignSpec) -> ExternalCampaign: ...

    async def get_campaign(self, external_id: str) -> ExternalCampaign: ...

    async def pause_campaign(self, external_id: str) -> ExternalCampaign: ...

    async def resume_campaign(self, external_id: str) -> ExternalCampaign: ...

    async def get_daily_spend(self, external_id: str, day: date) -> DailySpend: ...
