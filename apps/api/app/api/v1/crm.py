"""CRM (broker app): Início, Contatos, Funil, Caixa de entrada, Agenda. Thin: logic in services.

Gates: Funil and Agenda need the "pipeline_and_calendar" feature (from Essencial); contacts and
their history are in every plan.
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import (
    client_key,
    get_claims,
    get_rate_limiter,
    get_settings_dep,
    get_tenant_session,
)
from app.core.catalog import Feature, has_feature
from app.core.db import get_session
from app.core.errors import AppError
from app.core.rate_limit import RateLimiter
from app.core.security import AccessClaims
from app.core.settings import Settings
from app.core.tenancy import current_workspace
from app.domains.accounts.models import Workspace
from app.domains.activity.home import HomeOut, home
from app.domains.appointments import service as calendar
from app.domains.appointments.models import AppointmentStatus
from app.domains.contacts import public as contact_public
from app.domains.contacts import service as contacts
from app.domains.contacts.schemas import (
    ConsentIn,
    Contact360,
    ContactIn,
    ContactListOut,
    ContactPatch,
    ContactView,
    InterestIn,
    NoteIn,
    TaskIn,
)
from app.domains.conversations import service as conversations
from app.domains.leads import service as leads
from app.domains.properties import service as properties
from app.domains.properties.schemas import PublicListingOut


class MoveIn(BaseModel):
    stage_id: uuid.UUID
    lost_reason: str | None = Field(default=None, max_length=300)


class AutomationsIn(BaseModel):
    paused: bool


class VisitStatusIn(BaseModel):
    status: AppointmentStatus
    reason: str | None = Field(default=None, max_length=300)


router = APIRouter(tags=["crm"])
public_router = APIRouter(prefix="/public", tags=["public"])

ClaimsDep = Annotated[AccessClaims, Depends(get_claims)]
TenantSession = Annotated[AsyncSession, Depends(get_tenant_session)]
SettingsDep = Annotated[Settings, Depends(get_settings_dep)]


async def require_pipeline(session: TenantSession) -> None:
    workspace = await session.get(Workspace, current_workspace(session))
    if workspace is None or not has_feature(workspace.plan, Feature.PIPELINE_AND_CALENDAR):
        raise AppError("feature_not_in_plan", status_code=403, plan="essential")


PipelineGate = [Depends(require_pipeline)]


# ------------------------------------------------------------------ Início


@router.get("/home", response_model=HomeOut, operation_id="getHome")
async def get_home(claims: ClaimsDep, session: TenantSession) -> HomeOut:
    out = await home(session, claims.user_id)
    await session.commit()
    return out


# ------------------------------------------------------------------ Contatos


@router.get("/contacts", response_model=ContactListOut, operation_id="listContacts")
async def list_contacts(
    session: TenantSession,
    view: Annotated[ContactView, Query()] = "all",
    q: Annotated[str | None, Query(max_length=120)] = None,
) -> ContactListOut:
    return await contacts.list_contacts(session, view, q)


@router.post(
    "/contacts",
    response_model=Contact360,
    status_code=status.HTTP_201_CREATED,
    operation_id="createContact",
)
async def create_contact(data: ContactIn, claims: ClaimsDep, session: TenantSession) -> Contact360:
    person, _ = await contacts.upsert_contact(session, data, user_id=claims.user_id)
    out = await contacts.contact_360(session, person.id)
    await session.commit()
    return out


@router.get(
    "/contacts/export",
    response_class=PlainTextResponse,
    operation_id="exportContacts",
)
async def export_contacts(session: TenantSession) -> PlainTextResponse:
    return PlainTextResponse(
        await contacts.export_csv(session),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="contatos.csv"'},
    )


@router.get("/contacts/{person_id}", response_model=Contact360, operation_id="getContact")
async def get_contact(person_id: uuid.UUID, session: TenantSession) -> Contact360:
    return await contacts.contact_360(session, person_id)


@router.patch("/contacts/{person_id}", response_model=Contact360, operation_id="updateContact")
async def update_contact(
    person_id: uuid.UUID, patch: ContactPatch, session: TenantSession
) -> Contact360:
    await contacts.update_contact(session, person_id, patch)
    out = await contacts.contact_360(session, person_id)
    await session.commit()
    return out


@router.post(
    "/contacts/{person_id}/interests",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="addContactInterest",
)
async def add_interest(person_id: uuid.UUID, data: InterestIn, session: TenantSession) -> None:
    await contacts.add_interest(session, person_id, data)
    await session.commit()


@router.post(
    "/contacts/{person_id}/notes",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="addContactNote",
)
async def add_note(
    person_id: uuid.UUID, data: NoteIn, claims: ClaimsDep, session: TenantSession
) -> None:
    await contacts.add_note(session, person_id, data, claims.user_id)
    await session.commit()


@router.post(
    "/contacts/{person_id}/tasks",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="addContactTask",
)
async def add_task(
    person_id: uuid.UUID, data: TaskIn, claims: ClaimsDep, session: TenantSession
) -> None:
    await contacts.add_task(session, person_id, data, claims.user_id)
    await session.commit()


@router.post(
    "/tasks/{task_id}/done", status_code=status.HTTP_204_NO_CONTENT, operation_id="completeTask"
)
async def complete_task(task_id: uuid.UUID, session: TenantSession) -> None:
    await contacts.complete_task(session, task_id)
    await session.commit()


@router.post(
    "/contacts/{person_id}/consents",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="setContactConsent",
)
async def set_consent(
    person_id: uuid.UUID, data: ConsentIn, claims: ClaimsDep, session: TenantSession
) -> None:
    await contacts.set_consent(session, person_id, data, claims.user_id)
    await session.commit()


# ------------------------------------------------------------------ Funil


@router.get(
    "/pipeline",
    response_model=list[leads.BoardColumn],
    operation_id="getPipeline",
    dependencies=PipelineGate,
)
async def get_pipeline(session: TenantSession) -> list[leads.BoardColumn]:
    out = await leads.board(session)
    await session.commit()
    return out


@router.put(
    "/pipeline/stages",
    response_model=list[leads.StageOut],
    operation_id="updatePipelineStages",
    dependencies=PipelineGate,
)
async def update_stages(data: leads.StagesUpdate, session: TenantSession) -> list[leads.StageOut]:
    out = await leads.update_stages(session, data)
    await session.commit()
    return out


@router.post(
    "/leads/{lead_id}/move",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="moveLead",
    dependencies=PipelineGate,
)
async def move_lead(
    lead_id: uuid.UUID, data: MoveIn, claims: ClaimsDep, session: TenantSession
) -> None:
    await leads.move(
        session, lead_id, data.stage_id, user_id=claims.user_id, lost_reason=data.lost_reason
    )
    await session.commit()


@router.post(
    "/leads/{lead_id}/automations",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="setLeadAutomations",
)
async def set_lead_automations(
    lead_id: uuid.UUID, data: AutomationsIn, session: TenantSession
) -> None:
    await leads.set_automations_paused(session, lead_id, data.paused)
    await session.commit()


# ------------------------------------------------------------------ Caixa de entrada


@router.get(
    "/conversations",
    response_model=list[conversations.InboxItem],
    operation_id="listConversations",
)
async def list_conversations(
    session: TenantSession, needs_you: Annotated[bool, Query()] = False
) -> list[conversations.InboxItem]:
    return await conversations.inbox(session, needs_you=needs_you)


@router.get(
    "/conversations/{conversation_id}",
    response_model=conversations.ThreadOut,
    operation_id="getConversation",
)
async def get_conversation(
    conversation_id: uuid.UUID, session: TenantSession
) -> conversations.ThreadOut:
    out = await conversations.thread(session, conversation_id)
    await session.commit()
    return out


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=conversations.MessageOut,
    status_code=status.HTTP_201_CREATED,
    operation_id="replyConversation",
)
async def reply(
    conversation_id: uuid.UUID,
    data: conversations.ReplyIn,
    claims: ClaimsDep,
    session: TenantSession,
) -> conversations.MessageOut:
    out = await conversations.reply(session, conversation_id, data, claims.user_id)
    await session.commit()
    return out


@router.post(
    "/conversations/{conversation_id}/take-over",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="takeOverConversation",
)
async def take_over(conversation_id: uuid.UUID, claims: ClaimsDep, session: TenantSession) -> None:
    await conversations.take_over(session, conversation_id, claims.user_id)
    await session.commit()


# ------------------------------------------------------------------ Agenda


@router.get(
    "/calendar/settings",
    response_model=calendar.SettingsOut,
    operation_id="getCalendarSettings",
    dependencies=PipelineGate,
)
async def get_calendar_settings(claims: ClaimsDep, session: TenantSession) -> calendar.SettingsOut:
    out = calendar.settings_out(await calendar.get_settings(session, claims.user_id))
    await session.commit()
    return out


@router.put(
    "/calendar/settings",
    response_model=calendar.SettingsOut,
    operation_id="updateCalendarSettings",
    dependencies=PipelineGate,
)
async def update_calendar_settings(
    data: calendar.SettingsIn, claims: ClaimsDep, session: TenantSession
) -> calendar.SettingsOut:
    out = await calendar.update_settings(session, claims.user_id, data)
    await session.commit()
    return out


@router.get(
    "/calendar/week",
    response_model=calendar.WeekOut,
    operation_id="getCalendarWeek",
    dependencies=PipelineGate,
)
async def get_week(
    claims: ClaimsDep, session: TenantSession, start: Annotated[date, Query()]
) -> calendar.WeekOut:
    out = await calendar.week(session, claims.user_id, start)
    await session.commit()
    return out


@router.get(
    "/calendar/slots",
    response_model=list[calendar.Slot],
    operation_id="getFreeSlots",
    dependencies=PipelineGate,
)
async def get_slots(
    claims: ClaimsDep,
    session: TenantSession,
    property_id: Annotated[uuid.UUID | None, Query()] = None,
) -> list[calendar.Slot]:
    out = await calendar.slots_for(session, claims.user_id, property_id=property_id)
    await session.commit()
    return out


@router.post(
    "/calendar/visits",
    response_model=calendar.VisitOut,
    status_code=status.HTTP_201_CREATED,
    operation_id="bookVisit",
    dependencies=PipelineGate,
)
async def book_visit(
    data: calendar.BookIn, claims: ClaimsDep, session: TenantSession
) -> calendar.VisitOut:
    visit = await calendar.book(session, claims.user_id, data)
    await session.commit()
    week = await calendar.week(session, claims.user_id, visit.starts_at.date())
    return next(v for v in week.visits if v.id == visit.id)


@router.post(
    "/calendar/visits/{visit_id}/status",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="setVisitStatus",
    dependencies=PipelineGate,
)
async def set_visit_status(
    visit_id: uuid.UUID, data: VisitStatusIn, session: TenantSession
) -> None:
    if data.status == AppointmentStatus.CANCELLED:
        await calendar.cancel(session, visit_id, data.reason)
    else:
        await calendar.set_status(session, visit_id, data.status)
    await session.commit()


@router.post(
    "/calendar/blocks",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="addCalendarBlock",
    dependencies=PipelineGate,
)
async def add_block(data: calendar.BlockIn, claims: ClaimsDep, session: TenantSession) -> None:
    await calendar.add_block(session, claims.user_id, data)
    await session.commit()


# ------------------------------------------------------------------ public listing page


@public_router.get(
    "/listings/{slug}", response_model=PublicListingOut, operation_id="getPublicListing"
)
async def get_public_listing(
    slug: str,
    session: Annotated[AsyncSession, Depends(get_session)],
    settings: SettingsDep,
) -> PublicListingOut:
    listing = await properties.public_listing_by_slug(
        session, slug, include_demo=settings.public_listings_include_demo
    )
    if listing is None:
        raise AppError("not_found", status_code=404)
    return listing


@public_router.post(
    "/listings/{slug}/contact",
    response_model=contact_public.PublicContactAccepted,
    status_code=status.HTTP_202_ACCEPTED,
    operation_id="contactAboutListing",
)
async def contact_about_listing(  # noqa: PLR0917
    slug: str,
    data: contact_public.PublicContactIn,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
    settings: SettingsDep,
    limiter: Annotated[RateLimiter, Depends(get_rate_limiter)],
) -> contact_public.PublicContactAccepted:
    if not limiter.hit(
        f"listing-contact:{client_key(request)}", settings.interest_rate_limit_per_minute, 60
    ):
        raise AppError("rate_limited", status_code=429)
    out = await contact_public.submit_listing_contact(
        session, slug, data, include_demo=settings.public_listings_include_demo
    )
    await session.commit()
    return out
