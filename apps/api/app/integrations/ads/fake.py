from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import date

from app.integrations.ads.port import (
    AdPlatform,
    CampaignSpec,
    DailySpend,
    ExternalCampaign,
    ExternalCampaignStatus,
)
from app.integrations.base import IntegrationError


@dataclass
class _FakeCampaign:
    spec: CampaignSpec
    state: ExternalCampaign
    spend: dict[date, DailySpend]


class FakeAdPlatform:
    """In-memory ad platform. Campaigns go live immediately unless told to reject."""

    def __init__(self, platform: AdPlatform) -> None:
        self.platform = platform
        self.campaigns: dict[str, _FakeCampaign] = {}
        self.reject_next_with: str | None = None

    def _get(self, external_id: str) -> _FakeCampaign:
        try:
            return self.campaigns[external_id]
        except KeyError as exc:
            raise IntegrationError(self.platform.value, f"unknown campaign {external_id}") from exc

    async def create_campaign(self, spec: CampaignSpec) -> ExternalCampaign:
        external_id = f"{self.platform.value}-fake-{spec.reference}"
        if external_id in self.campaigns:  # idempotent on our reference
            return self.campaigns[external_id].state
        if self.reject_next_with:
            state = ExternalCampaign(
                external_id, ExternalCampaignStatus.REJECTED, self.reject_next_with
            )
            self.reject_next_with = None
        else:
            state = ExternalCampaign(external_id, ExternalCampaignStatus.ACTIVE)
        self.campaigns[external_id] = _FakeCampaign(spec, state, {})
        return state

    async def get_campaign(self, external_id: str) -> ExternalCampaign:
        return self._get(external_id).state

    async def pause_campaign(self, external_id: str) -> ExternalCampaign:
        campaign = self._get(external_id)
        campaign.state = replace(campaign.state, status=ExternalCampaignStatus.PAUSED)
        return campaign.state

    async def resume_campaign(self, external_id: str) -> ExternalCampaign:
        campaign = self._get(external_id)
        campaign.state = replace(campaign.state, status=ExternalCampaignStatus.ACTIVE)
        return campaign.state

    def record_spend(self, external_id: str, spend: DailySpend) -> None:
        """Test helper: simulate what the platform reports for a day."""
        self._get(external_id).spend[spend.day] = spend

    async def get_daily_spend(self, external_id: str, day: date) -> DailySpend:
        return self._get(external_id).spend.get(day, DailySpend(day, 0, 0, 0))
