"""Início (CRM mockup 40): "Primeiros passos" and the suggested next step, plus what needs the
broker today. Each step is a fact from the database, never a guess.
"""

from __future__ import annotations

import uuid
from datetime import datetime, time, timedelta
from typing import Literal

from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time import TZ, utcnow
from app.domains.accounts.models import BrokerProfile
from app.domains.activity.models import KeyEvent, KeyEventKind
from app.domains.appointments.models import ACTIVE_APPOINTMENT, Appointment
from app.domains.contacts.models import Person
from app.domains.conversations.models import AiMode, Conversation
from app.domains.leads.models import Task
from app.domains.listings.models import Listing, ListingStatus
from app.domains.properties.models import Property

StepKey = Literal[
    "creci",
    "first_property",
    "first_publication",
    "profile",
    "first_contact",
    "first_reply",
]


class Step(BaseModel):
    key: StepKey
    done: bool


class TodayOut(BaseModel):
    handed_off: int
    unread: int
    visits_today: int
    tasks_due: int


class HomeOut(BaseModel):
    steps: list[Step]
    next_step: StepKey | None
    today: TodayOut


async def _count(session: AsyncSession, query) -> int:  # type: ignore[no-untyped-def]
    return int(await session.scalar(query) or 0)


async def home(session: AsyncSession, user_id: uuid.UUID) -> HomeOut:
    profile = await session.scalar(select(BrokerProfile).where(BrokerProfile.user_id == user_id))
    properties = await _count(session, select(func.count()).select_from(Property))
    published = await _count(
        session,
        select(func.count()).select_from(Listing).where(Listing.status == ListingStatus.PUBLISHED),
    )
    contacts = await _count(session, select(func.count()).select_from(Person))
    replied = await _count(
        session,
        select(func.count())
        .select_from(KeyEvent)
        .where(KeyEvent.kind == KeyEventKind.CONTACT_REPLIED),
    )
    steps = [
        Step(key="creci", done=bool(profile and profile.creci_verified_at)),
        Step(key="first_property", done=properties > 0),
        Step(key="first_publication", done=published > 0),
        Step(key="profile", done=bool(profile and profile.whatsapp_e164 and profile.bio)),
        Step(key="first_contact", done=contacts > 0),
        Step(key="first_reply", done=replied > 0),
    ]
    # CRECI is waited on, not done by the broker: suggest the next thing they can do.
    actionable = [s for s in steps if not s.done and s.key != "creci"]
    now = utcnow().astimezone(TZ)
    start = datetime.combine(now.date(), time(0, 0), TZ)
    end = start + timedelta(days=1)
    today = TodayOut(
        handed_off=await _count(
            session,
            select(func.count())
            .select_from(Conversation)
            .where(Conversation.ai_mode == AiMode.HANDED_OFF),
        ),
        unread=await _count(session, select(func.sum(Conversation.unread_count))),
        visits_today=await _count(
            session,
            select(func.count())
            .select_from(Appointment)
            .where(
                Appointment.broker_user_id == user_id,
                Appointment.status.in_(ACTIVE_APPOINTMENT),
                Appointment.starts_at >= start,
                Appointment.starts_at < end,
            ),
        ),
        tasks_due=await _count(
            session,
            select(func.count())
            .select_from(Task)
            .where(Task.done_at.is_(None), Task.due_at.is_not(None), Task.due_at < end),
        ),
    )
    return HomeOut(steps=steps, next_step=actionable[0].key if actionable else None, today=today)
