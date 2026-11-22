"""Agenda de visitas: rules, free slots and conflict-safe booking.

Free slots come from the broker's weekly hours, minus visits (plus buffers, more when the
neighborhood changes), busy blocks (manual or Google free/busy), lead time and days ahead, and
the "neighborhoods per day" rule. Booking takes a per-broker advisory lock and re-checks the slot
inside the same transaction before inserting.
"""

from __future__ import annotations

import hashlib
import uuid
from datetime import date, datetime, time, timedelta

from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.tenancy import current_workspace
from app.core.time import TZ, utcnow
from app.domains.activity.models import EventActor, KeyEventKind
from app.domains.activity.service import emit
from app.domains.appointments.models import (
    ACTIVE_APPOINTMENT,
    DEFAULT_WEEKLY_HOURS,
    Appointment,
    AppointmentStatus,
    BlockSource,
    BookedBy,
    CalendarBlock,
    CalendarSettings,
)
from app.domains.contacts.models import Person
from app.domains.leads import service as leads
from app.domains.properties.models import Property

DAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
SLOT_STEP_MINUTES = 15


class SettingsOut(BaseModel):
    visit_minutes: int
    buffer_minutes: int
    other_neighborhood_buffer_minutes: int
    lead_time_minutes: int
    days_ahead: int
    weekly_hours: dict[str, list[list[str]]]
    neighborhoods_by_day: dict[str, list[str]]


class SettingsIn(BaseModel):
    visit_minutes: int = Field(ge=15, le=240)
    buffer_minutes: int = Field(ge=0, le=180)
    other_neighborhood_buffer_minutes: int = Field(ge=0, le=180)
    lead_time_minutes: int = Field(ge=0, le=7 * 24 * 60)
    days_ahead: int = Field(ge=1, le=60)
    weekly_hours: dict[str, list[list[str]]]
    neighborhoods_by_day: dict[str, list[str]] = Field(default_factory=dict)


class Slot(BaseModel):
    starts_at: datetime
    ends_at: datetime


class BookIn(BaseModel):
    person_id: uuid.UUID
    property_id: uuid.UUID | None = None
    starts_at: datetime
    booked_by: BookedBy = BookedBy.BROKER


class VisitOut(BaseModel):
    id: uuid.UUID
    person_id: uuid.UUID
    person_name: str
    property_id: uuid.UUID | None
    property_code: str | None
    starts_at: datetime
    ends_at: datetime
    status: AppointmentStatus
    booked_by: BookedBy
    is_demo: bool


class BlockIn(BaseModel):
    starts_at: datetime
    ends_at: datetime


class BlockOut(BlockIn):
    id: uuid.UUID
    source: BlockSource


class WeekOut(BaseModel):
    visits: list[VisitOut]
    blocks: list[BlockOut]
    free: list[Slot]


class SlotTaken(AppError):
    def __init__(self) -> None:
        super().__init__("slot_taken", status_code=409)


async def get_settings(session: AsyncSession, user_id: uuid.UUID) -> CalendarSettings:
    """The broker's rules; the defaults are created once, safely under concurrent first reads."""
    row = await session.scalar(select(CalendarSettings).where(CalendarSettings.user_id == user_id))
    if row is not None:
        return row
    workspace_id = current_workspace(session)
    await session.execute(
        pg_insert(CalendarSettings)
        .values(
            id=uuid.uuid4(),
            workspace_id=workspace_id,
            user_id=user_id,
            visit_minutes=45,
            buffer_minutes=30,
            other_neighborhood_buffer_minutes=30,
            lead_time_minutes=180,
            days_ahead=14,
            weekly_hours=DEFAULT_WEEKLY_HOURS,
            neighborhoods_by_day={},
        )
        .on_conflict_do_nothing(index_elements=["user_id"])
    )
    row = await session.scalar(select(CalendarSettings).where(CalendarSettings.user_id == user_id))
    if row is None:  # pragma: no cover - the insert or a concurrent one created it
        raise AppError("internal_error", status_code=500)
    return row


def settings_out(s: CalendarSettings) -> SettingsOut:
    return SettingsOut(
        visit_minutes=s.visit_minutes,
        buffer_minutes=s.buffer_minutes,
        other_neighborhood_buffer_minutes=s.other_neighborhood_buffer_minutes,
        lead_time_minutes=s.lead_time_minutes,
        days_ahead=s.days_ahead,
        weekly_hours=s.weekly_hours or DEFAULT_WEEKLY_HOURS,
        neighborhoods_by_day=s.neighborhoods_by_day or {},
    )


def _hhmm(value: str) -> time:
    hours, minutes = value.split(":")
    return time(int(hours), int(minutes))


async def update_settings(
    session: AsyncSession, user_id: uuid.UUID, data: SettingsIn
) -> SettingsOut:
    for day, windows in data.weekly_hours.items():
        if day not in DAYS:
            raise AppError("calendar_invalid_day", status_code=422)
        for window in windows:
            try:
                start, end = _hhmm(window[0]), _hhmm(window[1])
            except (ValueError, IndexError) as exc:
                raise AppError("calendar_invalid_hours", status_code=422) from exc
            if start >= end:
                raise AppError("calendar_invalid_hours", status_code=422)
    row = await get_settings(session, user_id)
    for field, value in data.model_dump().items():
        setattr(row, field, value)
    await session.flush()
    return settings_out(row)


# ------------------------------------------------------------------ free slots (pure core)


def free_slots(
    rules: SettingsOut,
    *,
    busy: list[tuple[datetime, datetime, str | None]],
    now: datetime,
    neighborhood: str | None = None,
    until: datetime | None = None,
) -> list[Slot]:
    """Slots of `visit_minutes` that fit the rules. `busy` = (start, end, neighborhood or None)."""
    first = now + timedelta(minutes=rules.lead_time_minutes)
    last_day = (now.astimezone(TZ) + timedelta(days=rules.days_ahead)).date()
    horizon = until or datetime.combine(last_day, time(23, 59), TZ)
    visit = timedelta(minutes=rules.visit_minutes)
    out: list[Slot] = []
    day = now.astimezone(TZ).date()
    while day <= last_day:
        key = DAYS[day.weekday()]
        allowed = rules.neighborhoods_by_day.get(key)
        if allowed and neighborhood and neighborhood not in allowed:
            day += timedelta(days=1)
            continue
        for window in rules.weekly_hours.get(key, []):
            start = datetime.combine(day, _hhmm(window[0]), TZ)
            end = datetime.combine(day, _hhmm(window[1]), TZ)
            cursor = start
            while cursor + visit <= end:
                slot_end = cursor + visit
                if (
                    cursor >= first
                    and slot_end <= horizon
                    and _fits(cursor, slot_end, busy, rules, neighborhood)
                ):
                    out.append(Slot(starts_at=cursor, ends_at=slot_end))
                cursor += timedelta(minutes=SLOT_STEP_MINUTES)
        day += timedelta(days=1)
    return out


def _fits(
    start: datetime,
    end: datetime,
    busy: list[tuple[datetime, datetime, str | None]],
    rules: SettingsOut,
    neighborhood: str | None,
) -> bool:
    for b_start, b_end, b_hood in busy:
        if b_hood is None:  # a block (or a visit without place): no travel buffer
            gap = timedelta(0)
        else:
            gap = timedelta(minutes=rules.buffer_minutes)
            if neighborhood and b_hood != neighborhood:
                gap += timedelta(minutes=rules.other_neighborhood_buffer_minutes)
        if start < b_end + gap and end + gap > b_start:
            return False
    return True


async def _busy(
    session: AsyncSession, user_id: uuid.UUID, start: datetime, end: datetime
) -> list[tuple[datetime, datetime, str | None]]:
    visits = await session.scalars(
        select(Appointment).where(
            Appointment.broker_user_id == user_id,
            Appointment.status.in_(ACTIVE_APPOINTMENT),
            Appointment.ends_at > start - timedelta(hours=6),
            Appointment.starts_at < end + timedelta(hours=6),
        )
    )
    blocks = await session.scalars(
        select(CalendarBlock).where(
            CalendarBlock.user_id == user_id,
            CalendarBlock.ends_at > start,
            CalendarBlock.starts_at < end,
        )
    )
    busy: list[tuple[datetime, datetime, str | None]] = [
        (v.starts_at, v.ends_at, v.neighborhood or "") for v in visits
    ]
    busy += [(b.starts_at, b.ends_at, None) for b in blocks]
    return busy


async def slots_for(
    session: AsyncSession,
    user_id: uuid.UUID,
    *,
    property_id: uuid.UUID | None = None,
    now: datetime | None = None,
) -> list[Slot]:
    now = now or utcnow()
    rules = settings_out(await get_settings(session, user_id))
    neighborhood = None
    if property_id is not None:
        prop = await session.get(Property, property_id)
        neighborhood = prop.neighborhood if prop else None
    end = now + timedelta(days=rules.days_ahead + 1)
    return free_slots(
        rules, busy=await _busy(session, user_id, now, end), now=now, neighborhood=neighborhood
    )


def _lock_key(user_id: uuid.UUID) -> int:
    return int.from_bytes(hashlib.sha256(user_id.bytes).digest()[:8], "big", signed=True)


async def book(
    session: AsyncSession,
    user_id: uuid.UUID,
    data: BookIn,
    *,
    actor: EventActor = EventActor.BROKER,
    now: datetime | None = None,
) -> Appointment:
    """Create a visit if the slot is still free. Two concurrent bookings: one wins, one gets 409."""
    now = now or utcnow()
    person = await session.get(Person, data.person_id)
    if person is None:
        raise AppError("contact_not_found", status_code=404)
    prop = await session.get(Property, data.property_id) if data.property_id else None
    if data.property_id and prop is None:
        raise AppError("property_not_found", status_code=404)
    # Serialize bookings for this broker until the transaction ends.
    await session.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": _lock_key(user_id)})
    rules = settings_out(await get_settings(session, user_id))
    start = data.starts_at.astimezone(TZ)
    end = start + timedelta(minutes=rules.visit_minutes)
    candidates = free_slots(
        rules,
        busy=await _busy(session, user_id, start - timedelta(days=1), end + timedelta(days=1)),
        now=now,
        neighborhood=prop.neighborhood if prop else None,
        until=end + timedelta(minutes=1),
    )
    if not any(s.starts_at == start for s in candidates):
        raise SlotTaken
    lead = (
        await leads.latest_open_lead(session, person.id) if data.property_id is None else None
    ) or await leads.open_lead(
        session, person, property_id=data.property_id, source=person.source.value
    )
    visit = Appointment(
        broker_user_id=user_id,
        person_id=person.id,
        lead_id=lead.id,
        property_id=data.property_id,
        starts_at=start,
        ends_at=end,
        neighborhood=prop.neighborhood if prop else None,
        status=AppointmentStatus.CONFIRMED,
        booked_by=data.booked_by,
        reminders={},
        is_demo=person.is_demo,
    )
    session.add(visit)
    await session.flush()
    emit(
        session,
        KeyEventKind.VISIT_BOOKED,
        actor,
        "appointment",
        visit.id,
        user_id=user_id if actor == EventActor.BROKER else None,
        person_id=person.id,
        starts_at=start.isoformat(),
    )
    await leads.move_to_key(session, lead, "visit_booked", actor=actor, user_id=user_id)
    return visit


async def cancel(session: AsyncSession, visit_id: uuid.UUID, reason: str | None) -> None:
    visit = await session.get(Appointment, visit_id)
    if visit is None:
        raise AppError("visit_not_found", status_code=404)
    visit.status = AppointmentStatus.CANCELLED
    visit.cancelled_reason = reason
    await session.flush()


async def set_status(session: AsyncSession, visit_id: uuid.UUID, status: AppointmentStatus) -> None:
    visit = await session.get(Appointment, visit_id)
    if visit is None:
        raise AppError("visit_not_found", status_code=404)
    visit.status = status
    await session.flush()


async def add_block(session: AsyncSession, user_id: uuid.UUID, data: BlockIn) -> None:
    if data.ends_at <= data.starts_at:
        raise AppError("calendar_invalid_hours", status_code=422)
    session.add(
        CalendarBlock(
            user_id=user_id,
            starts_at=data.starts_at,
            ends_at=data.ends_at,
            source=BlockSource.MANUAL,
        )
    )
    await session.flush()


async def week(session: AsyncSession, user_id: uuid.UUID, start: date) -> WeekOut:
    begin = datetime.combine(start, time(0, 0), TZ)
    end = begin + timedelta(days=7)
    rows = await session.execute(
        select(Appointment, Person.name, Property.code_number)
        .join(Person, Person.id == Appointment.person_id)
        .outerjoin(Property, Property.id == Appointment.property_id)
        .where(
            Appointment.broker_user_id == user_id,
            Appointment.starts_at >= begin,
            Appointment.starts_at < end,
        )
        .order_by(Appointment.starts_at)
    )
    blocks = await session.scalars(
        select(CalendarBlock).where(
            CalendarBlock.user_id == user_id,
            CalendarBlock.ends_at > begin,
            CalendarBlock.starts_at < end,
        )
    )
    free = [s for s in await slots_for(session, user_id) if begin <= s.starts_at < end]
    return WeekOut(
        visits=[
            VisitOut(
                id=a.id,
                person_id=a.person_id,
                person_name=name,
                property_id=a.property_id,
                property_code=f"CV-{code}" if code is not None else None,
                starts_at=a.starts_at,
                ends_at=a.ends_at,
                status=a.status,
                booked_by=a.booked_by,
                is_demo=a.is_demo,
            )
            for a, name, code in rows
        ],
        blocks=[
            BlockOut(id=b.id, starts_at=b.starts_at, ends_at=b.ends_at, source=b.source)
            for b in blocks
        ],
        free=free,
    )
