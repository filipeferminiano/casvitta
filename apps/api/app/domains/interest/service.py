"""Interest signups: store, double opt-in over WhatsApp, admin listing.

Rules: capture pages promise nothing (CLAUDE.md 11); consent per purpose with timestamp and source
(8); before the person answers "SIM" the only message sent is the opt-in request.
"""

from __future__ import annotations

import csv
import io
import json
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.logging import get_logger
from app.core.rate_limit import RateLimited, RateLimiter
from app.core.time import utcnow
from app.domains.interest.models import (
    ConsentPurpose,
    InterestKind,
    InterestSignup,
    InterestSignupConsent,
    InterestStatus,
)
from app.domains.interest.schemas import InterestSignupIn
from app.integrations.whatsapp.port import TemplateMessage, WhatsAppPort

log = get_logger(__name__)

OPT_IN_TEMPLATE = "interest_opt_in"
CONFIRM_WORDS = {"SIM", "S", "SIM!"}
STOP_WORDS = {"SAIR", "PARAR", "CANCELAR", "STOP"}


class ConsentRequired(AppError):
    def __init__(self) -> None:
        super().__init__("consent_required", status_code=422)


async def create_signup(
    session: AsyncSession,
    payload: InterestSignupIn,
    *,
    whatsapp: WhatsAppPort,
    limiter: RateLimiter,
    client_key: str,
    limit_per_minute: int,
) -> bool:
    """Returns True when stored and the opt-in was sent; False for honeypot hits."""
    if not limiter.hit(f"interest:{client_key}:{payload.kind}", limit_per_minute, 60):
        raise RateLimited
    if payload.website:
        log.info("interest_honeypot", kind=payload.kind)
        return False
    if not payload.consents.contact_about_properties:
        raise ConsentRequired

    now = utcnow()
    source = payload.source_page or "public_form"
    signup = InterestSignup(
        kind=payload.kind,
        name=payload.name,
        phone_e164=payload.phone,
        email=payload.email,
        criteria=payload.criteria.model_dump(mode="json"),
        utm_source=payload.utm.source,
        utm_medium=payload.utm.medium,
        utm_campaign=payload.utm.campaign,
        source_page=payload.source_page,
        status=InterestStatus.PENDING_OPT_IN,
        consents=[
            InterestSignupConsent(
                purpose=ConsentPurpose.CONTACT_ABOUT_PROPERTIES,
                granted=True,
                granted_at=now,
                source=source,
            ),
            InterestSignupConsent(
                purpose=ConsentPurpose.MARKETING,
                granted=payload.consents.marketing,
                granted_at=now,
                source=source,
            ),
        ],
    )
    session.add(signup)
    await session.flush()

    await whatsapp.send_template(
        signup.phone_e164,
        TemplateMessage(
            name=OPT_IN_TEMPLATE, parameters=(signup.name.split(" ")[0], signup.kind.value)
        ),
    )
    signup.opt_in_requested_at = utcnow()
    if signup.kind is InterestKind.OWNER_LISTING:
        # Staff task: assign a CRECI-registered broker of the region (manual at first, rule 13).
        log.info(
            "staff_task_assign_broker", signup_id=str(signup.id), cep=signup.criteria.get("cep")
        )
    await session.flush()
    return True


async def handle_whatsapp_reply(session: AsyncSession, phone_e164: str, text: str) -> int:
    """Reply to the opt-in request: "SIM" confirms, "SAIR" unsubscribes. Returns rows changed."""
    word = text.strip().upper()
    statuses: tuple[InterestStatus, ...]
    if word in CONFIRM_WORDS:
        target, statuses = InterestStatus.CONFIRMED, (InterestStatus.PENDING_OPT_IN,)
    elif word in STOP_WORDS:
        target = InterestStatus.UNSUBSCRIBED
        statuses = (InterestStatus.PENDING_OPT_IN, InterestStatus.CONFIRMED)
    else:
        return 0
    rows = (
        await session.scalars(
            select(InterestSignup).where(
                InterestSignup.phone_e164 == phone_e164, InterestSignup.status.in_(statuses)
            )
        )
    ).all()
    now = utcnow()
    for row in rows:
        row.status = target
        if target is InterestStatus.CONFIRMED:
            row.opt_in_confirmed_at = now
    await session.flush()
    return len(rows)


async def list_signups(
    session: AsyncSession, kind: InterestKind | None = None
) -> Sequence[InterestSignup]:
    stmt = select(InterestSignup).order_by(InterestSignup.created_at.desc())
    if kind:
        stmt = stmt.where(InterestSignup.kind == kind)
    return (await session.scalars(stmt)).all()


CSV_FIELDS = [
    "id",
    "created_at",
    "kind",
    "status",
    "name",
    "phone_e164",
    "email",
    "consent_contact",
    "consent_marketing",
    "opt_in_confirmed_at",
    "source_page",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "criteria",
]


def to_csv(rows: Sequence[InterestSignup]) -> str:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=CSV_FIELDS)
    writer.writeheader()
    for row in rows:
        consents = {c.purpose: c.granted for c in row.consents}
        writer.writerow(
            {
                "id": row.id,
                "created_at": row.created_at.isoformat(),
                "kind": row.kind.value,
                "status": row.status.value,
                "name": row.name,
                "phone_e164": row.phone_e164,
                "email": row.email or "",
                "consent_contact": consents.get(ConsentPurpose.CONTACT_ABOUT_PROPERTIES, False),
                "consent_marketing": consents.get(ConsentPurpose.MARKETING, False),
                "opt_in_confirmed_at": row.opt_in_confirmed_at.isoformat()
                if row.opt_in_confirmed_at
                else "",
                "source_page": row.source_page or "",
                "utm_source": row.utm_source or "",
                "utm_medium": row.utm_medium or "",
                "utm_campaign": row.utm_campaign or "",
                "criteria": json.dumps(row.criteria, ensure_ascii=False),
            }
        )
    return buffer.getvalue()
