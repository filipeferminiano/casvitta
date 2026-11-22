"""Contatos: create-or-merge, list with views, Contato 360, notes, tasks, consent and SAIR.

Contacts belong to the broker's workspace (tenant-scoped session). Duplicates are merged by phone
or email, never by an Instagram handle alone. Creating a contact counts toward the plan's CRM
contacts limit; at the limit nothing is lost or charged: the broker is asked to change plan.
"""

from __future__ import annotations

import csv
import io
import uuid
from datetime import timedelta

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.catalog import Meter, allows_more
from app.core.errors import AppError
from app.core.tenancy import current_workspace
from app.core.time import utcnow
from app.domains.accounts.models import Workspace
from app.domains.activity.models import EventActor, KeyEvent, KeyEventKind
from app.domains.activity.service import emit
from app.domains.appointments.models import Appointment
from app.domains.contacts import consent as consent_rules
from app.domains.contacts.models import (
    Channel,
    Consent,
    ConsentPurpose,
    ConsentStatus,
    ContactInterest,
    ContactKind,
    ContactNote,
    Person,
    ProofSource,
    Purpose,
)
from app.domains.contacts.schemas import (
    ConsentIn,
    ConsentState,
    ConsentSummary,
    Contact360,
    ContactIn,
    ContactListOut,
    ContactPatch,
    ContactRow,
    ContactView,
    InterestIn,
    InterestOut,
    LeadSummary,
    MatchingProperty,
    NoteIn,
    StageRef,
    TaskIn,
    TaskOut,
    TimelineItem,
)
from app.domains.conversations.models import Conversation, Message
from app.domains.leads import service as leads
from app.domains.leads.models import Lead, PipelineStage, Task
from app.domains.properties.models import Property, PropertyStatus, Transaction

NO_REPLY_DAYS = 14


class ContactNotFound(AppError):
    def __init__(self) -> None:
        super().__init__("contact_not_found", status_code=404)


async def _workspace(session: AsyncSession) -> Workspace:
    workspace = await session.get(Workspace, current_workspace(session))
    if workspace is None:
        raise AppError("unauthorized", status_code=401)
    return workspace


async def _find_duplicate(session: AsyncSession, data: ContactIn) -> Person | None:
    keys = []
    if data.phone:
        keys.append(Person.phone_e164 == data.phone)
    if data.email:
        keys.append(Person.email == data.email)
    if not keys:
        return None  # an Instagram handle alone never merges
    return await session.scalar(select(Person).where(or_(*keys)).limit(1))


def _interest(person: Person, data: InterestIn) -> ContactInterest:
    return ContactInterest(person_id=person.id, **data.model_dump())


def record_consent(
    session: AsyncSession,
    person: Person,
    data: ConsentIn,
    *,
    user_id: uuid.UUID | None = None,
) -> Consent:
    record = Consent(
        person_id=person.id,
        channel=data.channel,
        purpose=data.purpose,
        status=ConsentStatus.GRANTED if data.granted else ConsentStatus.REVOKED,
        occurred_at=utcnow(),
        proof_source=data.proof_source,
        proof_location=data.proof_location,
        proof_text=data.proof_text,
        recorded_by_user_id=user_id,
    )
    session.add(record)
    emit(
        session,
        KeyEventKind.CONSENT_CHANGED,
        EventActor.BROKER if data.proof_source == ProofSource.BROKER else EventActor.CONTACT,
        "person",
        person.id,
        user_id=user_id,
        person_id=person.id,
        channel=data.channel.value,
        purpose=data.purpose.value,
        granted=data.granted,
    )
    return record


async def upsert_contact(
    session: AsyncSession,
    data: ContactIn,
    *,
    actor: EventActor = EventActor.BROKER,
    user_id: uuid.UUID | None = None,
) -> tuple[Person, bool]:
    """Create the contact, or merge into the one with the same phone or email.

    Returns (person, created). Merging only fills what is missing; it never overwrites what the
    contact or the broker already recorded.
    """
    person = await _find_duplicate(session, data)
    created = person is None
    if person is None:
        # The limit stops the broker adding contacts by hand; someone who writes in is never lost
        # or refused (the app shows the plan at its limit instead).
        if actor == EventActor.BROKER:
            workspace = await _workspace(session)
            used = int(await session.scalar(select(func.count()).select_from(Person)) or 0)
            if not allows_more(workspace.plan, Meter.CRM_CONTACTS, used):
                raise AppError("contacts_limit_reached", status_code=409)
        person = Person(
            name=data.name,
            phone_e164=data.phone,
            email=data.email,
            instagram_handle=data.instagram_handle,
            kind=data.kind,
            source=data.source,
            source_detail=data.source_detail,
            utm_source=data.utm_source,
            utm_medium=data.utm_medium,
            utm_campaign=data.utm_campaign,
            responsible_user_id=user_id,
            last_interaction_at=utcnow(),
        )
        session.add(person)
        await session.flush()
        emit(
            session,
            KeyEventKind.CONTACT_CREATED,
            actor,
            "person",
            person.id,
            user_id=user_id,
            person_id=person.id,
            source=data.source.value,
        )
    else:
        for field in ("phone_e164", "email", "instagram_handle"):
            value = {"phone_e164": data.phone}.get(field, getattr(data, field, None))
            if getattr(person, field) is None and value:
                setattr(person, field, value)
        if person.kind == ContactKind.UNKNOWN and data.kind != ContactKind.UNKNOWN:
            person.kind = data.kind
        person.last_interaction_at = utcnow()
    if data.interest is not None:
        session.add(_interest(person, data.interest))
    for item in data.consents:
        record_consent(session, person, item, user_id=user_id)
    await leads.open_lead(session, person, property_id=data.property_id, source=data.source.value)
    await session.flush()
    return person, created


async def _load(session: AsyncSession, person_id: uuid.UUID) -> Person:
    person = await session.get(Person, person_id)
    if person is None:
        raise ContactNotFound
    return person


def _interest_out(i: ContactInterest) -> InterestOut:
    return InterestOut(
        id=i.id,
        purpose=i.purpose,
        neighborhoods=list(i.neighborhoods),
        city=i.city,
        property_kinds=list(i.property_kinds),
        min_price_cents=i.min_price_cents,
        max_price_cents=i.max_price_cents,
        min_bedrooms=i.min_bedrooms,
        min_parking=i.min_parking,
        source=i.source,
    )


def _summary(records: list[Consent]) -> ConsentSummary:
    return ConsentSummary(
        whatsapp=consent_rules.summary(records, Channel.WHATSAPP),
        instagram=consent_rules.summary(records, Channel.INSTAGRAM),
        email=consent_rules.summary(records, Channel.EMAIL),
    )


def _view_filter(view: ContactView):  # type: ignore[no-untyped-def]
    if view == "buyers":
        return Person.kind == ContactKind.BUYER
    if view == "tenants":
        return Person.kind == ContactKind.TENANT
    if view == "owners":
        return Person.kind == ContactKind.OWNER
    if view == "no_reply_14d":
        return Person.last_interaction_at < utcnow() - timedelta(days=NO_REPLY_DAYS)
    return None


async def list_contacts(
    session: AsyncSession, view: ContactView = "all", q: str | None = None
) -> ContactListOut:
    query = select(Person).order_by(Person.last_interaction_at.desc().nulls_last())
    condition = _view_filter(view)
    if condition is not None:
        query = query.where(condition)
    if q:
        like = f"%{q.strip()}%"
        query = query.where(
            or_(Person.name.ilike(like), Person.email.ilike(like), Person.phone_e164.like(like))
        )
    people = list((await session.scalars(query.limit(500))).all())
    ids = [p.id for p in people]
    consents: dict[uuid.UUID, list[Consent]] = {}
    interests: dict[uuid.UUID, ContactInterest] = {}
    stage_of: dict[uuid.UUID, PipelineStage] = {}
    if ids:
        for c in await session.scalars(select(Consent).where(Consent.person_id.in_(ids))):
            consents.setdefault(c.person_id, []).append(c)
        for i in await session.scalars(
            select(ContactInterest)
            .where(ContactInterest.person_id.in_(ids))
            .order_by(ContactInterest.created_at)
        ):
            interests[i.person_id] = i  # newest wins
        stage_rows = await session.execute(
            select(Lead.person_id, PipelineStage)
            .join(PipelineStage, PipelineStage.id == Lead.stage_id)
            .where(Lead.person_id.in_(ids))
            .order_by(Lead.stage_changed_at)
        )
        for person_id, stage in stage_rows:
            stage_of[person_id] = stage
    counts = {}
    for name in ("all", "buyers", "tenants", "owners", "no_reply_14d"):
        cond = _view_filter(name)
        count_query = select(func.count()).select_from(Person)
        counts[name] = int(
            await session.scalar(count_query.where(cond) if cond is not None else count_query) or 0
        )
    return ContactListOut(
        items=[
            ContactRow(
                id=p.id,
                name=p.name,
                kind=p.kind,
                source=p.source,
                source_detail=p.source_detail,
                interest=_interest_out(interests[p.id]) if p.id in interests else None,
                stage=(
                    StageRef(id=stage_of[p.id].id, key=stage_of[p.id].key, name=stage_of[p.id].name)
                    if p.id in stage_of
                    else None
                ),
                consent=_summary(consents.get(p.id, [])),
                last_interaction_at=p.last_interaction_at,
                is_demo=p.is_demo,
            )
            for p in people
        ],
        counts=counts,
    )


def _matches(interest: ContactInterest | None, prop: Property) -> tuple[bool, bool]:
    """(matches, within_budget). Purpose and neighborhood must match; price decides the budget."""
    if interest is None:
        return False, False
    wanted = {Purpose.BUY: Transaction.SALE, Purpose.RENT: Transaction.RENT}.get(interest.purpose)
    if wanted is None or prop.transaction != wanted:
        return False, False
    if interest.neighborhoods and prop.neighborhood not in interest.neighborhoods:
        return False, False
    if interest.min_bedrooms and (prop.bedrooms or 0) < interest.min_bedrooms:
        return False, False
    within = (
        interest.max_price_cents is None or prop.price_cents <= interest.max_price_cents
    ) and (interest.min_price_cents is None or prop.price_cents >= interest.min_price_cents)
    return True, within


async def contact_360(session: AsyncSession, person_id: uuid.UUID) -> Contact360:
    person = await _load(session, person_id)
    interests = list(
        (
            await session.scalars(
                select(ContactInterest)
                .where(ContactInterest.person_id == person.id)
                .order_by(ContactInterest.created_at.desc())
            )
        ).all()
    )
    records = list(
        (await session.scalars(select(Consent).where(Consent.person_id == person.id))).all()
    )
    consents = []
    for channel in Channel:
        for purpose in ConsentPurpose:
            cur = consent_rules.current(records, channel, purpose)
            consents.append(
                ConsentState(
                    channel=channel,
                    purpose=purpose,
                    status=cur.status,
                    occurred_at=cur.record.occurred_at if cur.record else None,
                    proof_source=cur.record.proof_source if cur.record else None,
                    proof_location=cur.record.proof_location if cur.record else None,
                )
            )
    lead_rows = (
        await session.execute(
            select(Lead, PipelineStage, Property.code_number)
            .join(PipelineStage, PipelineStage.id == Lead.stage_id)
            .outerjoin(Property, Property.id == Lead.property_id)
            .where(Lead.person_id == person.id)
            .order_by(Lead.stage_changed_at.desc())
        )
    ).all()
    tasks = (
        await session.scalars(
            select(Task).where(Task.person_id == person.id).order_by(Task.due_at.nulls_last())
        )
    ).all()

    timeline: list[TimelineItem] = []
    messages = await session.execute(
        select(Message, Conversation.channel)
        .join(Conversation, Conversation.id == Message.conversation_id)
        .where(Conversation.person_id == person.id)
        .order_by(Message.sent_at.desc())
        .limit(50)
    )
    for m, conv_channel in messages:
        timeline.append(
            TimelineItem(
                at=m.sent_at,
                kind="message",
                channel=conv_channel.value,
                author=m.author.value,
                text=m.body,
            )
        )
    for n in await session.scalars(select(ContactNote).where(ContactNote.person_id == person.id)):
        timeline.append(
            TimelineItem(at=n.created_at, kind="note", channel=None, author="broker", text=n.body)
        )
    for e in await session.scalars(
        select(KeyEvent)
        .where(KeyEvent.person_id == person.id)
        .order_by(KeyEvent.occurred_at.desc())
        .limit(50)
    ):
        timeline.append(
            TimelineItem(
                at=e.occurred_at,
                kind="event",
                channel=None,
                author=e.actor.value,
                text=e.kind.value,
                ref=e.entity_id,
            )
        )
    for a in await session.scalars(select(Appointment).where(Appointment.person_id == person.id)):
        timeline.append(
            TimelineItem(
                at=a.starts_at,
                kind="visit",
                channel=None,
                author=a.booked_by.value,
                text=a.status.value,
                ref=str(a.id),
            )
        )
    timeline.sort(key=lambda item: item.at, reverse=True)

    newest = interests[0] if interests else None
    props = (
        await session.scalars(
            select(Property).where(Property.status == PropertyStatus.ACTIVE).limit(200)
        )
    ).all()
    matching = []
    for prop in props:
        ok, within = _matches(newest, prop)
        if ok:
            matching.append(
                MatchingProperty(
                    id=prop.id,
                    code=prop.code,
                    title=prop.title or f"{prop.kind.value} · {prop.neighborhood}",
                    price_cents=prop.price_cents,
                    within_budget=within,
                )
            )
    return Contact360(
        id=person.id,
        name=person.name,
        phone_e164=person.phone_e164,
        email=person.email,
        instagram_handle=person.instagram_handle,
        kind=person.kind,
        source=person.source,
        source_detail=person.source_detail,
        responsible_user_id=person.responsible_user_id,
        is_demo=person.is_demo,
        interests=[_interest_out(i) for i in interests],
        consents=consents,
        leads=[
            LeadSummary(
                id=lead.id,
                stage=StageRef(id=stage.id, key=stage.key, name=stage.name),
                property_code=f"CV-{code}" if code is not None else None,
                automations_paused=lead.automations_paused,
            )
            for lead, stage, code in lead_rows
        ],
        tasks=[TaskOut(id=t.id, title=t.title, due_at=t.due_at, done_at=t.done_at) for t in tasks],
        timeline=timeline[:80],
        matching_properties=sorted(matching, key=lambda m: not m.within_budget)[:10],
    )


async def update_contact(
    session: AsyncSession, person_id: uuid.UUID, patch: ContactPatch
) -> Person:
    person = await _load(session, person_id)
    changes = patch.model_dump(exclude_unset=True)
    if "phone" in changes:
        changes["phone_e164"] = changes.pop("phone")
    for field, value in changes.items():
        setattr(person, field, value)
    await session.flush()
    return person


async def add_interest(session: AsyncSession, person_id: uuid.UUID, data: InterestIn) -> None:
    person = await _load(session, person_id)
    session.add(_interest(person, data))
    await session.flush()


async def add_note(
    session: AsyncSession, person_id: uuid.UUID, data: NoteIn, user_id: uuid.UUID
) -> None:
    person = await _load(session, person_id)
    session.add(ContactNote(person_id=person.id, author_user_id=user_id, body=data.body))
    await session.flush()


async def add_task(
    session: AsyncSession, person_id: uuid.UUID, data: TaskIn, user_id: uuid.UUID
) -> None:
    person = await _load(session, person_id)
    session.add(
        Task(person_id=person.id, title=data.title, due_at=data.due_at, assigned_user_id=user_id)
    )
    await session.flush()


async def complete_task(session: AsyncSession, task_id: uuid.UUID) -> None:
    task = await session.get(Task, task_id)
    if task is None:
        raise AppError("task_not_found", status_code=404)
    task.done_at = task.done_at or utcnow()
    await session.flush()


async def set_consent(
    session: AsyncSession, person_id: uuid.UUID, data: ConsentIn, user_id: uuid.UUID
) -> None:
    person = await _load(session, person_id)
    record_consent(session, person, data, user_id=user_id)
    await session.flush()


async def opt_out(
    session: AsyncSession, person: Person, channel: Channel, location: str | None
) -> None:
    """SAIR: every purpose on that channel stops now."""
    for purpose in ConsentPurpose:
        record_consent(
            session,
            person,
            ConsentIn(
                channel=channel,
                purpose=purpose,
                granted=False,
                proof_source=ProofSource.OPT_OUT,
                proof_location=location,
            ),
        )
    await session.flush()


async def export_csv(session: AsyncSession) -> str:
    """The broker's own contacts (their data: LGPD portability), with consent per channel."""
    people = (await session.scalars(select(Person).order_by(Person.name))).all()
    records: dict[uuid.UUID, list[Consent]] = {}
    for c in await session.scalars(select(Consent)):
        records.setdefault(c.person_id, []).append(c)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "nome", "telefone", "email", "instagram", "tipo", "origem",
            "consentimento_whatsapp", "consentimento_instagram", "consentimento_email",
            "ultima_interacao",
        ]
    )  # fmt: skip
    for p in people:
        mine = records.get(p.id, [])
        writer.writerow(
            [
                p.name,
                p.phone_e164 or "",
                p.email or "",
                p.instagram_handle or "",
                p.kind.value,
                p.source.value,
                consent_rules.summary(mine, Channel.WHATSAPP),
                consent_rules.summary(mine, Channel.INSTAGRAM),
                consent_rules.summary(mine, Channel.EMAIL),
                p.last_interaction_at.isoformat() if p.last_interaction_at else "",
            ]
        )
    return buffer.getvalue()
