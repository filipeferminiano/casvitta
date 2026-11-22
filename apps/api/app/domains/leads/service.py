"""Funil: configurable stages and leads. Moving a lead is a key event (broker activity)."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.time import utcnow
from app.domains.activity.models import EventActor, KeyEventKind
from app.domains.activity.service import emit
from app.domains.contacts.models import Person
from app.domains.leads.models import DEFAULT_STAGES, Lead, PipelineStage, StageKind
from app.domains.properties.models import Property


class StageOut(BaseModel):
    id: uuid.UUID
    key: str | None
    name: str | None
    position: int
    kind: StageKind


class BoardCard(BaseModel):
    lead_id: uuid.UUID
    person_id: uuid.UUID
    name: str
    property_code: str | None
    source: str
    automations_paused: bool
    is_demo: bool


class BoardColumn(BaseModel):
    stage: StageOut
    cards: list[BoardCard]


class StageIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    kind: StageKind = StageKind.OPEN


class StagesUpdate(BaseModel):
    """Full ordered list. Existing ids keep their leads; missing ids are archived (if empty)."""

    stages: list[StageUpdateItem] = Field(min_length=2, max_length=12)


class StageUpdateItem(BaseModel):
    id: uuid.UUID | None = None
    name: str | None = Field(default=None, max_length=60)
    kind: StageKind = StageKind.OPEN


StagesUpdate.model_rebuild()


class LeadNotFound(AppError):
    def __init__(self) -> None:
        super().__init__("lead_not_found", status_code=404)


def _stage_out(s: PipelineStage) -> StageOut:
    return StageOut(id=s.id, key=s.key, name=s.name, position=s.position, kind=s.kind)


async def stages(session: AsyncSession) -> list[PipelineStage]:
    """Active stages in order; the defaults are created the first time a workspace needs them."""
    rows = list(
        (
            await session.scalars(
                select(PipelineStage)
                .where(PipelineStage.archived_at.is_(None))
                .order_by(PipelineStage.position)
            )
        ).all()
    )
    if rows:
        return rows
    created = [
        PipelineStage(key=key, position=i, kind=kind)
        for i, (key, kind) in enumerate(DEFAULT_STAGES)
    ]
    session.add_all(created)
    await session.flush()
    return created


async def stage_by_key(session: AsyncSession, key: str) -> PipelineStage:
    for stage in await stages(session):
        if stage.key == key:
            return stage
    # The broker renamed or removed it: fall back to the first open stage.
    return (await stages(session))[0]


async def latest_open_lead(session: AsyncSession, person_id: uuid.UUID) -> Lead | None:
    """The contact's most recently moved open lead (a visit without a property joins it)."""
    open_kinds = select(PipelineStage.id).where(PipelineStage.kind == StageKind.OPEN)
    return await session.scalar(
        select(Lead)
        .where(Lead.person_id == person_id, Lead.stage_id.in_(open_kinds))
        .order_by(Lead.stage_changed_at.desc())
        .limit(1)
    )


async def open_lead(
    session: AsyncSession,
    person: Person,
    *,
    property_id: uuid.UUID | None,
    source: str,
) -> Lead:
    """The open lead for this contact × property, or a new one in "Novo"."""
    open_kinds = select(PipelineStage.id).where(PipelineStage.kind == StageKind.OPEN)
    existing = await session.scalar(
        select(Lead).where(
            Lead.person_id == person.id,
            Lead.property_id.is_(None) if property_id is None else Lead.property_id == property_id,
            Lead.stage_id.in_(open_kinds),
        )
    )
    if existing is not None:
        return existing
    lead = Lead(
        person_id=person.id,
        property_id=property_id,
        stage_id=(await stage_by_key(session, "new")).id,
        source=source,
        stage_changed_at=utcnow(),
        is_demo=person.is_demo,
    )
    session.add(lead)
    await session.flush()
    return lead


async def board(session: AsyncSession) -> list[BoardColumn]:
    columns = await stages(session)
    rows = (
        await session.execute(
            select(Lead, Person.name, Person.is_demo, Property.code_number)
            .join(Person, Person.id == Lead.person_id)
            .outerjoin(Property, Property.id == Lead.property_id)
            .order_by(Lead.stage_changed_at.desc())
        )
    ).all()
    cards: dict[uuid.UUID, list[BoardCard]] = {s.id: [] for s in columns}
    for lead, name, is_demo, code in rows:
        if lead.stage_id in cards:
            cards[lead.stage_id].append(
                BoardCard(
                    lead_id=lead.id,
                    person_id=lead.person_id,
                    name=name,
                    property_code=f"CV-{code}" if code is not None else None,
                    source=lead.source,
                    automations_paused=lead.automations_paused,
                    is_demo=is_demo,
                )
            )
    return [BoardColumn(stage=_stage_out(s), cards=cards[s.id]) for s in columns]


async def move(
    session: AsyncSession,
    lead_id: uuid.UUID,
    stage_id: uuid.UUID,
    *,
    actor: EventActor = EventActor.BROKER,
    user_id: uuid.UUID | None = None,
    lost_reason: str | None = None,
) -> Lead:
    lead = await session.get(Lead, lead_id)
    if lead is None:
        raise LeadNotFound
    target = await session.get(PipelineStage, stage_id)
    if target is None or target.archived_at is not None:
        raise AppError("stage_not_found", status_code=404)
    if lead.stage_id == target.id:
        return lead
    previous = lead.stage_id
    lead.stage_id = target.id
    lead.stage_changed_at = utcnow()
    lead.closed_at = utcnow() if target.kind != StageKind.OPEN else None
    lead.lost_reason = lost_reason if target.kind == StageKind.LOST else None
    emit(
        session,
        KeyEventKind.PIPELINE_MOVED,
        actor,
        "lead",
        lead.id,
        user_id=user_id,
        person_id=lead.person_id,
        from_stage=str(previous),
        to_stage=str(target.id),
        to_key=target.key,
    )
    await session.flush()
    return lead


async def move_to_key(
    session: AsyncSession, lead: Lead, key: str, *, actor: EventActor, user_id: uuid.UUID | None
) -> Lead:
    return await move(
        session, lead.id, (await stage_by_key(session, key)).id, actor=actor, user_id=user_id
    )


async def update_stages(session: AsyncSession, data: StagesUpdate) -> list[StageOut]:
    current = {s.id: s for s in await stages(session)}
    keep: set[uuid.UUID] = set()
    for position, item in enumerate(data.stages):
        if item.id is not None:
            stage = current.get(item.id)
            if stage is None:
                raise AppError("stage_not_found", status_code=404)
            if item.name is not None:
                stage.name = item.name or None
            stage.position = position
            stage.kind = item.kind
            keep.add(stage.id)
        else:
            if not item.name:
                raise AppError("stage_name_required", status_code=422)
            session.add(PipelineStage(name=item.name, position=position, kind=item.kind))
    for stage_id, stage in current.items():
        if stage_id in keep:
            continue
        in_use = await session.scalar(
            select(func.count()).select_from(Lead).where(Lead.stage_id == stage_id)
        )
        if in_use:
            raise AppError("stage_has_leads", status_code=409)
        stage.archived_at = utcnow()
    if not any(i.kind == StageKind.OPEN for i in data.stages):
        raise AppError("stage_open_required", status_code=422)
    await session.flush()
    return [_stage_out(s) for s in await stages(session)]


async def set_automations_paused(session: AsyncSession, lead_id: uuid.UUID, paused: bool) -> None:
    lead = await session.get(Lead, lead_id)
    if lead is None:
        raise LeadNotFound
    lead.automations_paused = paused
    await session.flush()


def stage_refs(rows: Sequence[PipelineStage]) -> dict[uuid.UUID, PipelineStage]:
    return {s.id: s for s in rows}
