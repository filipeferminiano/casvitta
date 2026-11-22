"""Accounts: email-link sign-in and sign-up, sessions, broker profile and plan.

Sessions: a short JWT access token plus an opaque refresh token. Refreshing rotates the refresh
token; presenting an already-rotated one revokes the whole family (stolen-token detection).
"""

from __future__ import annotations

import re
import unicodedata
import uuid
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.catalog import SELLABLE
from app.core.errors import AppError
from app.core.i18n import translate
from app.core.logging import get_logger
from app.core.rate_limit import RateLimited, RateLimiter
from app.core.security import encode_access_token, hash_token, new_token
from app.core.settings import Settings
from app.core.tenancy import bind_workspace, cross_tenant, current_workspace
from app.core.time import utcnow
from app.domains.accounts.models import (
    AuthSession,
    BrokerProfile,
    CreciReviewStatus,
    LoginToken,
    LoginTokenPurpose,
    Membership,
    Plan,
    Role,
    User,
    Workspace,
    WorkspaceKind,
)
from app.domains.accounts.schemas import (
    AdminBrokerOut,
    BrokerProfileOut,
    BrokerProfileUpdate,
    CreciStatus,
    EmailLinkIn,
    MeOut,
    UserOut,
    WorkspaceOut,
)
from app.domains.billing.models import ChangeKind, ChangeSource, PlanChangeRequest
from app.domains.staff.audit import Actor, record
from app.integrations.messaging.port import Email, EmailPort

log = get_logger(__name__)

# Last-seen is written at most this often (on session refresh).
_SEEN_EVERY = timedelta(minutes=5)

# Subdomains that can never be a broker slug (see apps/web/src/lib/hosts.ts).
RESERVED_SLUGS = frozenset(
    {
        "app",
        "www",
        "api",
        "admin",
        "static",
        "cdn",
        "mail",
        "email",
        "status",
        "docs",
        "blog",
        "suporte",
        "ajuda",
        "casvitta",
    }
)


class LinkInvalid(AppError):
    def __init__(self) -> None:
        super().__init__("link_invalid", status_code=400)


class SessionExpired(AppError):
    def __init__(self) -> None:
        super().__init__("session_expired", status_code=401)


class NoBrokerProfile(AppError):
    def __init__(self) -> None:
        super().__init__("no_broker_profile", status_code=409)


@dataclass(frozen=True, slots=True)
class IssuedSession:
    user_id: uuid.UUID
    workspace_id: uuid.UUID
    access_token: str
    refresh_token: str


# ------------------------------------------------------------------ email links


async def request_email_link(
    session: AsyncSession,
    payload: EmailLinkIn,
    *,
    email_port: EmailPort,
    settings: Settings,
    limiter: RateLimiter,
    client_key: str,
) -> None:
    """Sends a sign-in or sign-up link. Never reveals whether the address has an account."""
    limit = settings.auth_rate_limit_per_minute
    if not limiter.hit(f"auth:ip:{client_key}", limit, 60) or not limiter.hit(
        f"auth:email:{payload.email}", limit, 60
    ):
        raise RateLimited

    user = await session.scalar(select(User).where(User.email == payload.email))
    minutes = settings.login_link_ttl_minutes

    if user is None and payload.intent == "sign_in":
        await email_port.send(
            Email(
                to=payload.email,
                subject=translate("email.no_account.subject"),
                text=translate("email.no_account.text", {"signup": _signup_url(settings)}),
            )
        )
        if settings.app_env == "development":
            log.info("dev_email_no_account", to=payload.email, signup=_signup_url(settings))
        return

    # An existing account always gets a sign-in link, even from the signup form.
    purpose = LoginTokenPurpose.SIGN_IN if user else LoginTokenPurpose.SIGN_UP
    token = new_token()
    now = utcnow()
    session.add(
        LoginToken(
            token_hash=hash_token(token),
            purpose=purpose,
            email=payload.email,
            user_id=user.id if user else None,
            payload=(
                {}
                if user
                else {
                    "name": payload.name or payload.email.split("@")[0],
                    "plan": (payload.plan or Plan.FREE).value,
                }
            ),
            created_at=now,
            expires_at=now + timedelta(minutes=minutes),
        )
    )
    await session.flush()
    kind = "sign_in" if user else "sign_up"
    name = user.name if user else (payload.name or "")
    link = f"{settings.site_url}/entrar/confirmar#t={token}"
    await email_port.send(
        Email(
            to=payload.email,
            subject=translate(f"email.{kind}.subject"),
            text=translate(
                f"email.{kind}.text",
                {"name": name.split(" ")[0] if name else "", "link": link, "minutes": minutes},
            ),
        )
    )
    if settings.app_env == "development":
        log.info("dev_email_link", link=link)  # no real email in local development


def _signup_url(settings: Settings) -> str:
    return f"{settings.site_url}/cadastro/conta"


async def _consume(
    session: AsyncSession, token: str, purposes: set[LoginTokenPurpose]
) -> LoginToken:
    """Marks the token used, atomically: two clicks on one link cannot both succeed."""
    now = utcnow()
    row = await session.scalar(
        update(LoginToken)
        .where(
            LoginToken.token_hash == hash_token(token),
            LoginToken.used_at.is_(None),
            LoginToken.expires_at > now,
            LoginToken.purpose.in_(purposes),
        )
        .values(used_at=now)
        .returning(LoginToken)
    )
    if not isinstance(row, LoginToken):
        raise LinkInvalid
    return row


async def confirm_email_link(
    session: AsyncSession, token: str, *, settings: Settings, user_agent: str | None
) -> tuple[IssuedSession, bool]:
    """Returns the new session and whether an account was created (sign-up)."""
    row = await _consume(session, token, {LoginTokenPurpose.SIGN_IN, LoginTokenPurpose.SIGN_UP})
    created = False
    user = await session.get(User, row.user_id) if row.user_id else None
    if user is None and row.email:
        # Sign-up, unless the same address finished signing up meanwhile.
        user = await session.scalar(select(User).where(User.email == row.email))
        if user is None:
            user = await _create_account(session, row.email, row.payload)
            created = True
    if user is None:
        raise LinkInvalid
    user.last_login_at = utcnow()
    user.last_seen_at = user.last_login_at
    issued = await _issue_session(session, user, settings=settings, user_agent=user_agent)
    return issued, created


async def _create_account(session: AsyncSession, email: str, payload: dict[str, Any]) -> User:
    name = str(payload.get("name") or email.split("@", maxsplit=1)[0])
    chosen = Plan(payload.get("plan", Plan.FREE.value))
    # Legacy signup links (?plano=corretor) mean the paid entry plan of the current ladder.
    if chosen == Plan.CORRETOR:
        chosen = Plan.ESSENTIAL
    user = User(email=email, name=name)
    # Every account starts on Grátis; a paid choice becomes a plan request for staff (no billing).
    workspace = Workspace(name=name, kind=WorkspaceKind.BROKER, plan=Plan.FREE)
    session.add_all([user, workspace])
    await session.flush()
    slug = await _unique_slug(session, name)
    bind_workspace(session, workspace.id)
    session.add_all(
        [
            Membership(user_id=user.id, role=Role.OWNER),
            BrokerProfile(user_id=user.id, display_name=name, slug=slug),
        ]
    )
    if chosen in SELLABLE and chosen != Plan.FREE:
        session.add(
            PlanChangeRequest(
                kind=ChangeKind.PLAN,
                current_plan=Plan.FREE,
                requested_plan=chosen,
                source=ChangeSource.SIGNUP,
                requested_by_user_id=user.id,
            )
        )
    await session.flush()
    log.info("account_created", user_id=str(user.id), workspace_id=str(workspace.id))
    return user


def slugify(name: str) -> str:
    """'Ana Paula Ribeiro' -> 'anaribeiro' (first + last name, ASCII, a-z0-9)."""
    ascii_name = unicodedata.normalize("NFD", name).encode("ascii", "ignore").decode()
    parts = [p for p in re.split(r"\s+", ascii_name.lower()) if p]
    picked = parts[:1] + parts[-1:] if len(parts) > 1 else parts
    slug = re.sub(r"[^a-z0-9]", "", "".join(picked))[:40]
    return slug or "corretor"


async def _unique_slug(session: AsyncSession, name: str) -> str:
    base = slugify(name)
    with cross_tenant(session):  # slugs are unique across the platform
        taken = set(
            (
                await session.scalars(
                    select(BrokerProfile.slug).where(BrokerProfile.slug.like(f"{base}%"))
                )
            ).all()
        )
    candidate, n = base, 1
    while candidate in taken or candidate in RESERVED_SLUGS:
        n += 1
        candidate = f"{base}{n}"
    return candidate


# ------------------------------------------------------------------ sessions


async def _workspace_for(session: AsyncSession, user: User) -> uuid.UUID:
    # Resolving which workspace a user belongs to is, by nature, across tenants.
    with cross_tenant(session):
        membership = await session.scalar(
            select(Membership)
            .where(Membership.user_id == user.id)
            .order_by(Membership.created_at)
            .limit(1)
        )
    if membership is None:
        raise SessionExpired
    return membership.workspace_id


async def _issue_session(
    session: AsyncSession,
    user: User,
    *,
    settings: Settings,
    user_agent: str | None,
    family_id: uuid.UUID | None = None,
) -> IssuedSession:
    workspace_id = await _workspace_for(session, user)
    refresh = new_token()
    now = utcnow()
    session.add(
        AuthSession(
            user_id=user.id,
            family_id=family_id or uuid.uuid4(),
            refresh_token_hash=hash_token(refresh),
            created_at=now,
            expires_at=now + timedelta(days=settings.refresh_token_ttl_days),
            user_agent=(user_agent or "")[:300] or None,
        )
    )
    await session.flush()
    return IssuedSession(
        user_id=user.id,
        workspace_id=workspace_id,
        access_token=encode_access_token(settings, user.id, workspace_id, now),
        refresh_token=refresh,
    )


async def refresh_session(
    session: AsyncSession, refresh_token: str, *, settings: Settings, user_agent: str | None
) -> IssuedSession:
    now = utcnow()
    current = await session.scalar(
        select(AuthSession)
        .where(AuthSession.refresh_token_hash == hash_token(refresh_token))
        .with_for_update()
    )
    if current is None or current.revoked_at is not None or current.expires_at <= now:
        raise SessionExpired
    if current.rotated_at is not None:
        # An old token came back: someone else may hold it. End every session of this login.
        await session.execute(
            update(AuthSession)
            .where(AuthSession.family_id == current.family_id, AuthSession.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        log.warning("refresh_token_reuse", family_id=str(current.family_id))
        raise SessionExpired
    current.rotated_at = now
    user = await session.get(User, current.user_id)
    if user is None:
        raise SessionExpired
    if user.last_seen_at is None or now - user.last_seen_at >= _SEEN_EVERY:
        user.last_seen_at = now  # "Último acesso" in the backoffice
    return await _issue_session(
        session, user, settings=settings, user_agent=user_agent, family_id=current.family_id
    )


async def sign_out(session: AsyncSession, refresh_token: str | None) -> None:
    if not refresh_token:
        return
    current = await session.scalar(
        select(AuthSession).where(AuthSession.refresh_token_hash == hash_token(refresh_token))
    )
    if current is not None:
        await session.execute(
            update(AuthSession)
            .where(AuthSession.family_id == current.family_id, AuthSession.revoked_at.is_(None))
            .values(revoked_at=utcnow())
        )


async def create_handoff(session: AsyncSession, user_id: uuid.UUID, *, settings: Settings) -> str:
    """One-time code to open the same account on another host (casvitta.com.br -> app.)."""
    code = new_token()
    now = utcnow()
    session.add(
        LoginToken(
            token_hash=hash_token(code),
            purpose=LoginTokenPurpose.HANDOFF,
            user_id=user_id,
            payload={},
            created_at=now,
            expires_at=now + timedelta(seconds=settings.handoff_ttl_seconds),
        )
    )
    await session.flush()
    return code


async def claim_handoff(
    session: AsyncSession, code: str, *, settings: Settings, user_agent: str | None
) -> IssuedSession:
    row = await _consume(session, code, {LoginTokenPurpose.HANDOFF})
    user = await session.get(User, row.user_id) if row.user_id else None
    if user is None:
        raise LinkInvalid
    view_as = (row.payload or {}).get("view_as")
    if view_as:
        # Staff viewing as the customer: a short read-only access token and no refresh token.
        workspace_id = uuid.UUID(str(row.payload["workspace_id"]))
        return IssuedSession(
            user_id=user.id,
            workspace_id=workspace_id,
            access_token=encode_access_token(
                settings, user.id, workspace_id, acting_staff_id=uuid.UUID(str(view_as))
            ),
            refresh_token="",
        )
    return await _issue_session(session, user, settings=settings, user_agent=user_agent)


async def create_view_as_handoff(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    workspace_id: uuid.UUID,
    staff_id: uuid.UUID,
    settings: Settings,
) -> str:
    """One-time code that opens the customer's app read-only for a staff member (BO5)."""
    code = new_token()
    now = utcnow()
    session.add(
        LoginToken(
            token_hash=hash_token(code),
            purpose=LoginTokenPurpose.HANDOFF,
            user_id=user_id,
            payload={"view_as": str(staff_id), "workspace_id": str(workspace_id)},
            created_at=now,
            expires_at=now + timedelta(seconds=settings.handoff_ttl_seconds),
        )
    )
    await session.flush()
    return code


# ------------------------------------------------------------------ profile


def creci_status(profile: BrokerProfile) -> CreciStatus:
    if profile.creci_verified_at is not None:
        return "verified"
    return "pending" if profile.creci_number else "missing"


def _creci_display(profile: BrokerProfile) -> str | None:
    if not profile.creci_number:
        return None
    kind = profile.creci_kind.value if profile.creci_kind else "F"
    return f"{profile.creci_number}-{kind}"


def broker_out(profile: BrokerProfile) -> BrokerProfileOut:
    return BrokerProfileOut(
        id=profile.id,
        display_name=profile.display_name,
        slug=profile.slug,
        creci_name=profile.creci_name,
        creci_number=_creci_display(profile),
        creci_state=profile.creci_state,
        creci_kind=profile.creci_kind,
        creci_status=creci_status(profile),
        creci_verified_at=profile.creci_verified_at,
        whatsapp_e164=profile.whatsapp_e164,
        regions=list(profile.regions or []),
        is_demo=profile.is_demo,
        creci_review_status=profile.creci_review_status,
        # What staff asked the broker to fix (shown in the app until a new number is sent).
        creci_review_reason=(
            profile.creci_review_reason
            if profile.creci_review_status
            in (CreciReviewStatus.CORRECTION_REQUESTED, CreciReviewStatus.REJECTED)
            else None
        ),
    )


async def get_me(
    session: AsyncSession, user_id: uuid.UUID, acting_staff_id: uuid.UUID | None = None
) -> MeOut:
    """Session must be bound to the user's workspace."""
    user = await session.get(User, user_id)
    if user is None:
        raise SessionExpired
    workspace_id = current_workspace(session)
    workspace = await session.get(Workspace, workspace_id) if workspace_id else None
    if workspace is None:
        raise SessionExpired
    profile = await session.scalar(select(BrokerProfile).where(BrokerProfile.user_id == user.id))
    return MeOut(
        user=UserOut(id=user.id, name=user.name, email=user.email),
        workspace=WorkspaceOut(
            id=workspace.id, name=workspace.name, plan=workspace.plan, is_demo=workspace.is_demo
        ),
        broker=broker_out(profile) if profile else None,
        viewing_as=await _staff_name(session, acting_staff_id) if acting_staff_id else None,
    )


async def _staff_name(session: AsyncSession, staff_id: uuid.UUID) -> str:
    from app.domains.staff.models import StaffUser  # noqa: PLC0415 - avoids an import cycle

    staff = await session.get(StaffUser, staff_id)
    return staff.name if staff else "Equipe Casvitta"


async def update_broker_profile(
    session: AsyncSession, user_id: uuid.UUID, patch: BrokerProfileUpdate
) -> BrokerProfileOut:
    profile = await session.scalar(select(BrokerProfile).where(BrokerProfile.user_id == user_id))
    if profile is None:
        raise NoBrokerProfile
    changes = patch.model_dump(exclude_unset=True)
    creci_fields = {"creci_number", "creci_state", "creci_kind"}
    creci_changed = any(
        field in changes and changes[field] != getattr(profile, field) for field in creci_fields
    )
    if "whatsapp" in changes:
        profile.whatsapp_e164 = changes.pop("whatsapp")
    for field, value in changes.items():
        setattr(profile, field, value)
    if creci_changed:
        # A new number needs a new check before publishing (CLAUDE.md rule 1). After a correction
        # request the reason stays, so staff see "Correção enviada" in the queue.
        profile.creci_verified_at = None
        profile.creci_submitted_at = utcnow() if profile.creci_number else None
        profile.creci_review_status = CreciReviewStatus.PENDING if profile.creci_number else None
    await session.flush()
    return broker_out(profile)


async def set_plan(session: AsyncSession, plan: Plan) -> WorkspaceOut:
    """Without billing a broker can only go back to Grátis; paid plans are plan requests."""
    workspace = await session.get(Workspace, current_workspace(session))
    if workspace is None:
        raise SessionExpired
    if plan != Plan.FREE:
        raise AppError("plan_change_requires_request", status_code=409)
    workspace.plan = plan
    await session.flush()
    return WorkspaceOut(
        id=workspace.id, name=workspace.name, plan=workspace.plan, is_demo=workspace.is_demo
    )


# ------------------------------------------------------------------ staff


async def list_brokers_for_staff(
    session: AsyncSession, status: CreciStatus | None, actor: Actor
) -> list[AdminBrokerOut]:
    with cross_tenant(session):
        rows = (
            await session.execute(
                select(BrokerProfile, User.email)
                .join(User, User.id == BrokerProfile.user_id)
                .order_by(func.coalesce(BrokerProfile.creci_submitted_at, BrokerProfile.created_at))
            )
        ).all()
    result = [
        AdminBrokerOut(
            **broker_out(profile).model_dump(),
            workspace_id=profile.workspace_id,
            email=email,
            creci_submitted_at=profile.creci_submitted_at,
        )
        for profile, email in rows
        if status is None or creci_status(profile) == status
    ]
    record(
        session,
        actor,
        "broker_profile.listed",
        "broker_profiles",
        None,
        status=status,
        count=len(result),
    )
    await session.flush()
    return result


async def verify_creci(
    session: AsyncSession, profile_id: uuid.UUID, actor: Actor
) -> BrokerProfileOut:
    """Staff checked the number at the regional council (manual for now, CLAUDE.md rule 1)."""
    with cross_tenant(session):
        profile = await session.get(BrokerProfile, profile_id)
        if profile is None or not profile.creci_number:
            raise AppError("not_found", status_code=404)
        profile.creci_verified_at = utcnow()
        profile.creci_review_status = CreciReviewStatus.VERIFIED
        profile.creci_reviewed_at = profile.creci_verified_at
        profile.creci_reviewed_by_id = actor.staff_id
        record(
            session,
            actor,
            "broker_profile.creci_verified",
            "broker_profiles",
            str(profile.id),
            creci=_creci_display(profile),
            state=profile.creci_state,
        )
        await session.flush()
    return broker_out(profile)
