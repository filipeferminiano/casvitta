"""Plan usage and plan/add-on change requests (CRM-0).

Without a payment provider (settings.billing_enabled false) nobody changes plan alone except
going back to Grátis: upgrades and add-ons become requests that staff approve in the
backoffice, audited. Nothing is ever charged automatically.
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.catalog import (
    ADD_ONS,
    SELLABLE,
    Meter,
    add_on_available,
    limit,
    limit_state,
    spec,
)
from app.core.errors import AppError
from app.core.tenancy import cross_tenant, current_workspace
from app.core.time import utcnow
from app.domains.accounts.models import Plan, Workspace
from app.domains.billing import payments
from app.domains.billing.models import (
    OPEN,
    ChangeKind,
    ChangeStatus,
    PlanChangeRequest,
)
from app.domains.billing.schemas import (
    AddOnUsageOut,
    ChangeRequestIn,
    ChangeRequestOut,
    MeterOut,
    PlanUsageOut,
    StaffChangeRequestOut,
)
from app.domains.properties.models import Property, PropertyStatus
from app.domains.staff.audit import Actor, record

# Active property = published or draft (catalog definition).
ACTIVE_STATUSES = (PropertyStatus.ACTIVE, PropertyStatus.DRAFT)  # same as properties.service


class ChangeRequestNotFound(AppError):
    def __init__(self) -> None:
        super().__init__("plan_request_not_found", status_code=404)


def _out(r: PlanChangeRequest) -> ChangeRequestOut:
    return ChangeRequestOut(
        id=r.id,
        kind=r.kind,
        current_plan=r.current_plan,
        requested_plan=r.requested_plan,
        add_on_key=r.add_on_key,
        billing_period=r.billing_period,
        source=r.source,
        status=r.status,
        created_at=r.created_at,
        handled_at=r.handled_at,
        reason=r.reason,
    )


async def _workspace(session: AsyncSession) -> Workspace:
    workspace = await session.get(Workspace, current_workspace(session))
    if workspace is None:
        raise AppError("unauthorized", status_code=401)
    return workspace


async def active_properties(session: AsyncSession) -> int:
    return int(
        await session.scalar(
            select(func.count()).select_from(Property).where(Property.status.in_(ACTIVE_STATUSES))
        )
        or 0
    )


async def usage(session: AsyncSession, *, billing_enabled: bool) -> PlanUsageOut:
    workspace = await _workspace(session)
    measured: dict[Meter, int] = {Meter.ACTIVE_PROPERTIES: await active_properties(session)}
    sub = await payments.live_subscription(session)
    extra = payments.extras(sub)
    meters = []
    for meter in Meter:
        used = measured.get(meter)
        bought = extra.get(meter, 0)
        state = limit_state(workspace.plan, meter, used or 0, bought)
        cap = limit(workspace.plan, meter)
        meters.append(
            MeterOut(
                meter=meter,
                used=used,
                limit=None if cap is None else cap + bought,
                state=state,
                extra=bought,
            )
        )
    open_request = await session.scalar(
        select(PlanChangeRequest)
        .where(PlanChangeRequest.status.in_(OPEN))
        .order_by(PlanChangeRequest.created_at.desc())
        .limit(1)
    )
    return PlanUsageOut(
        plan=workspace.plan,
        legacy=not spec(workspace.plan).sellable,
        billing_enabled=billing_enabled,
        meters=meters,
        open_request=_out(open_request) if open_request else None,
        subscription=payments.subscription_out(sub),
        add_ons=[
            AddOnUsageOut(
                key=a.key,
                meter=a.meter,
                amount=a.amount,
                price_cents=a.price_cents,
                quantity=(sub.add_ons.get(a.key, 0) if sub else 0),
                available=add_on_available(workspace.plan, a),
            )
            for a in ADD_ONS
        ],
    )


async def request_change(
    session: AsyncSession, user_id: uuid.UUID | None, data: ChangeRequestIn
) -> ChangeRequestOut:
    workspace = await _workspace(session)
    if data.kind == ChangeKind.PLAN:
        if data.requested_plan not in SELLABLE:
            raise AppError("plan_not_sellable", status_code=422)
        if data.requested_plan == workspace.plan:
            raise AppError("plan_already_active", status_code=409)
    else:
        add_on = next((a for a in ADD_ONS if a.key == data.add_on_key), None)
        if add_on is None or (add_on.plans and workspace.plan not in add_on.plans):
            raise AppError("add_on_not_available", status_code=422)
    # One open plan request at a time: a new one replaces the previous.
    previous = (
        await session.scalars(
            select(PlanChangeRequest).where(
                PlanChangeRequest.status.in_(OPEN), PlanChangeRequest.kind == data.kind
            )
        )
    ).all()
    for old in previous:
        if data.kind == ChangeKind.PLAN or old.add_on_key == data.add_on_key:
            old.status = ChangeStatus.CANCELLED
    request = PlanChangeRequest(
        kind=data.kind,
        current_plan=workspace.plan,
        requested_plan=data.requested_plan if data.kind == ChangeKind.PLAN else None,
        add_on_key=data.add_on_key if data.kind == ChangeKind.ADD_ON else None,
        billing_period=data.billing_period,
        source=data.source,
        requested_by_user_id=user_id,
    )
    session.add(request)
    await session.flush()
    await session.refresh(request)
    return _out(request)


async def downgrade_to_free(session: AsyncSession) -> Plan:
    """Going back to Grátis needs no payment. Records stay (downgrade never deletes)."""
    workspace = await _workspace(session)
    workspace.plan = Plan.FREE
    await session.flush()
    return workspace.plan


async def cancel_request(session: AsyncSession, request_id: uuid.UUID) -> None:
    request = await session.get(PlanChangeRequest, request_id)
    if request is None:
        raise ChangeRequestNotFound
    if request.status in OPEN:
        request.status = ChangeStatus.CANCELLED
    await session.flush()


# ------------------------------------------------------------------ staff


async def staff_open_requests(session: AsyncSession) -> list[StaffChangeRequestOut]:
    with cross_tenant(session):
        rows = (
            await session.execute(
                select(PlanChangeRequest, Workspace.name)
                .join(Workspace, Workspace.id == PlanChangeRequest.workspace_id)
                .where(PlanChangeRequest.status.in_(OPEN))
                .order_by(PlanChangeRequest.created_at)
            )
        ).all()
    return [
        StaffChangeRequestOut(**_out(r).model_dump(), workspace_id=r.workspace_id, workspace_name=n)
        for r, n in rows
    ]


async def _staff_load(session: AsyncSession, request_id: uuid.UUID) -> PlanChangeRequest:
    with cross_tenant(session):
        request = await session.get(PlanChangeRequest, request_id)
    if request is None or request.status not in OPEN:
        raise ChangeRequestNotFound
    return request


async def approve(session: AsyncSession, actor: Actor, request_id: uuid.UUID) -> None:
    with cross_tenant(session):
        request = await _staff_load(session, request_id)
        workspace = await session.get(Workspace, request.workspace_id)
        if workspace is None:
            raise ChangeRequestNotFound
        if request.kind == ChangeKind.PLAN and request.requested_plan is not None:
            workspace.plan = request.requested_plan
        request.status = ChangeStatus.APPROVED
        request.handled_by_staff_id = actor.staff_id
        request.handled_at = utcnow()
        record(
            session,
            actor,
            "plan_request.approved",
            "workspace",
            workspace.id,
            request_id=str(request.id),
            kind=request.kind.value,
            plan=request.requested_plan.value if request.requested_plan else None,
            add_on=request.add_on_key,
        )
        await session.flush()


async def decline(session: AsyncSession, actor: Actor, request_id: uuid.UUID, reason: str) -> None:
    with cross_tenant(session):
        request = await _staff_load(session, request_id)
        request.status = ChangeStatus.DECLINED
        request.reason = reason
        request.handled_by_staff_id = actor.staff_id
        request.handled_at = utcnow()
        record(
            session,
            actor,
            "plan_request.declined",
            "workspace",
            request.workspace_id,
            reason=reason,
            request_id=str(request.id),
        )
        await session.flush()
