from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.core.catalog import LimitState, Meter
from app.domains.accounts.models import Plan
from app.domains.billing.models import ChangeKind, ChangeSource, ChangeStatus


class ChangeRequestIn(BaseModel):
    kind: ChangeKind = ChangeKind.PLAN
    requested_plan: Plan | None = None
    add_on_key: str | None = Field(default=None, max_length=60)
    billing_period: Literal["monthly", "annual"] = "monthly"
    source: ChangeSource = ChangeSource.PLANS_PAGE

    @model_validator(mode="after")
    def _check(self) -> ChangeRequestIn:
        if self.kind == ChangeKind.PLAN and self.requested_plan is None:
            raise ValueError("requested_plan is required")
        if self.kind == ChangeKind.ADD_ON and not self.add_on_key:
            raise ValueError("add_on_key is required")
        return self


class ChangeRequestOut(BaseModel):
    id: uuid.UUID
    kind: ChangeKind
    current_plan: Plan
    requested_plan: Plan | None
    add_on_key: str | None
    billing_period: str
    source: ChangeSource
    status: ChangeStatus
    created_at: datetime
    handled_at: datetime | None
    reason: str | None


class StaffChangeRequestOut(ChangeRequestOut):
    workspace_id: uuid.UUID
    workspace_name: str


class MeterOut(BaseModel):
    meter: Meter
    used: int | None  # None = not measured yet (the module does not exist yet)
    limit: int | None  # None = unlimited
    state: LimitState


class PlanUsageOut(BaseModel):
    plan: Plan
    legacy: bool
    billing_enabled: bool
    meters: list[MeterOut]
    open_request: ChangeRequestOut | None


class DeclineIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)
