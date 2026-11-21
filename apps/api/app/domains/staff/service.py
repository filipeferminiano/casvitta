"""Backoffice staff: email-link sign-in (allowlist only), sessions, re-auth, team and audit log.

Sessions: a 10-minute JWT (audience "casvitta-staff") plus a rotating refresh token that dies
after an hour without use and, in any case, a few hours after sign-in. Sensitive actions need a
proof of identity in the last minutes: the sign-in link itself or a 6-digit code sent by email.
"""

from __future__ import annotations

import csv
import io
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import Select, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.i18n import translate
from app.core.logging import get_logger
from app.core.masking import mask_email
from app.core.rate_limit import RateLimited, RateLimiter
from app.core.security import encode_staff_token, hash_token, new_token
from app.core.settings import Settings
from app.core.time import format_date, format_time, utcnow
from app.domains.accounts.models import AuditLog
from app.domains.staff.audit import ADMIN_TOKEN_ACTOR, Actor, record
from app.domains.staff.models import (
    StaffLoginToken,
    StaffRole,
    StaffSession,
    StaffTokenPurpose,
    StaffUser,
)
from app.domains.staff.permissions import permissions_for
from app.domains.staff.schemas import (
    AuditEntryOut,
    AuditPage,
    StaffInviteIn,
    StaffMemberOut,
    StaffMeOut,
    StaffUpdateIn,
)
from app.integrations.messaging.port import Email, EmailPort

log = get_logger(__name__)

# Last-seen is written at most this often (it is updated on refresh).
_SEEN_EVERY = timedelta(minutes=5)


class StaffLinkInvalid(AppError):
    def __init__(self) -> None:
        super().__init__("link_invalid", status_code=400)


class StaffSessionExpired(AppError):
    def __init__(self) -> None:
        super().__init__("session_expired", status_code=401)


class ReauthRequired(AppError):
    def __init__(self) -> None:
        super().__init__("reauth_required", status_code=403)


@dataclass(frozen=True, slots=True)
class IssuedStaffSession:
    staff_id: uuid.UUID
    access_token: str
    refresh_token: str


def actor_for(staff: StaffUser, authenticated_at: datetime | None) -> Actor:
    return Actor.staff(staff.id, staff.name, permissions_for(staff.role), authenticated_at)


# ------------------------------------------------------------------ sign-in


async def request_link(
    session: AsyncSession,
    email: str,
    *,
    email_port: EmailPort,
    settings: Settings,
    limiter: RateLimiter,
    client_key: str,
) -> None:
    """Emails a sign-in link to an active staff member. Silent for anyone else (no probing)."""
    limit = settings.auth_rate_limit_per_minute
    if not limiter.hit(f"staff-auth:ip:{client_key}", limit, 60) or not limiter.hit(
        f"staff-auth:email:{email}", limit, 60
    ):
        raise RateLimited
    staff = await session.scalar(select(StaffUser).where(StaffUser.email == email))
    if staff is None or not staff.active:
        log.info("staff_link_refused", reason="not_allowlisted")
        return
    token = new_token()
    now = utcnow()
    minutes = settings.login_link_ttl_minutes
    session.add(
        StaffLoginToken(
            staff_user_id=staff.id,
            purpose=StaffTokenPurpose.SIGN_IN,
            token_hash=hash_token(token),
            created_at=now,
            expires_at=now + timedelta(minutes=minutes),
        )
    )
    await session.flush()
    link = f"{settings.admin_url}/entrar/confirmar#t={token}"
    await email_port.send(
        Email(
            to=staff.email,
            subject=translate("email.staff_sign_in.subject"),
            text=translate(
                "email.staff_sign_in.text",
                {"name": staff.name.split(" ")[0], "link": link, "minutes": minutes},
            ),
        )
    )
    if settings.app_env == "development":
        log.info("dev_staff_email_link", link=link)


async def confirm_link(
    session: AsyncSession, token: str, *, settings: Settings, user_agent: str | None
) -> IssuedStaffSession:
    now = utcnow()
    row = await session.scalar(
        update(StaffLoginToken)
        .where(
            StaffLoginToken.token_hash == hash_token(token),
            StaffLoginToken.purpose == StaffTokenPurpose.SIGN_IN,
            StaffLoginToken.used_at.is_(None),
            StaffLoginToken.expires_at > now,
        )
        .values(used_at=now)
        .returning(StaffLoginToken)
    )
    if not isinstance(row, StaffLoginToken):
        raise StaffLinkInvalid
    staff = await session.get(StaffUser, row.staff_user_id)
    if staff is None or not staff.active:
        raise StaffLinkInvalid
    staff.last_login_at = now
    staff.last_seen_at = now
    issued = await _issue(session, staff, settings=settings, user_agent=user_agent)
    record(session, actor_for(staff, now), "staff.signed_in", "staff_users", staff.id)
    return issued


async def _issue(
    session: AsyncSession,
    staff: StaffUser,
    *,
    settings: Settings,
    user_agent: str | None,
    family_id: uuid.UUID | None = None,
    family_started_at: datetime | None = None,
    authenticated_at: datetime | None = None,
) -> IssuedStaffSession:
    now = utcnow()
    started = family_started_at or now
    authenticated = authenticated_at or now
    family = family_id or uuid.uuid4()
    refresh = new_token()
    session.add(
        StaffSession(
            staff_user_id=staff.id,
            family_id=family,
            refresh_token_hash=hash_token(refresh),
            family_started_at=started,
            authenticated_at=authenticated,
            created_at=now,
            expires_at=min(
                now + timedelta(minutes=settings.staff_idle_minutes),
                started + timedelta(hours=settings.staff_session_max_hours),
            ),
            user_agent=(user_agent or "")[:300] or None,
        )
    )
    await session.flush()
    return IssuedStaffSession(
        staff_id=staff.id,
        access_token=encode_staff_token(settings, staff.id, family, authenticated, now),
        refresh_token=refresh,
    )


async def refresh(
    session: AsyncSession, refresh_token: str, *, settings: Settings, user_agent: str | None
) -> IssuedStaffSession:
    now = utcnow()
    current = await session.scalar(
        select(StaffSession)
        .where(StaffSession.refresh_token_hash == hash_token(refresh_token))
        .with_for_update()
    )
    if current is None or current.revoked_at is not None or current.expires_at <= now:
        raise StaffSessionExpired
    if current.rotated_at is not None:
        await _revoke_family(session, current.family_id, now)
        log.warning("staff_refresh_token_reuse", family_id=str(current.family_id))
        raise StaffSessionExpired
    current.rotated_at = now
    staff = await session.get(StaffUser, current.staff_user_id)
    if staff is None or not staff.active:
        await _revoke_family(session, current.family_id, now)
        raise StaffSessionExpired
    if staff.last_seen_at is None or now - staff.last_seen_at >= _SEEN_EVERY:
        staff.last_seen_at = now
    return await _issue(
        session,
        staff,
        settings=settings,
        user_agent=user_agent,
        family_id=current.family_id,
        family_started_at=current.family_started_at,
        authenticated_at=current.authenticated_at,
    )


async def _revoke_family(session: AsyncSession, family_id: uuid.UUID, now: datetime) -> None:
    await session.execute(
        update(StaffSession)
        .where(StaffSession.family_id == family_id, StaffSession.revoked_at.is_(None))
        .values(revoked_at=now)
    )


async def sign_out(session: AsyncSession, refresh_token: str | None) -> None:
    if not refresh_token:
        return
    current = await session.scalar(
        select(StaffSession).where(StaffSession.refresh_token_hash == hash_token(refresh_token))
    )
    if current is not None:
        await _revoke_family(session, current.family_id, utcnow())


async def load_active_staff(session: AsyncSession, staff_id: uuid.UUID) -> StaffUser:
    staff = await session.get(StaffUser, staff_id)
    if staff is None or not staff.active:
        raise StaffSessionExpired
    return staff


async def session_is_live(session: AsyncSession, family_id: uuid.UUID) -> bool:
    """False once the login was signed out or revoked (access tokens stop working at once)."""
    live = await session.scalar(
        select(func.count())
        .select_from(StaffSession)
        .where(StaffSession.family_id == family_id, StaffSession.revoked_at.is_(None))
    )
    return bool(live)


# ------------------------------------------------------------------ re-auth


def _code_hash(token_id: uuid.UUID, code: str) -> str:
    return hash_token(f"{token_id}:{code}")


async def request_reauth_code(
    session: AsyncSession,
    staff: StaffUser,
    *,
    email_port: EmailPort,
    settings: Settings,
    limiter: RateLimiter,
) -> None:
    if not limiter.hit(f"staff-reauth:{staff.id}", settings.auth_rate_limit_per_minute, 60):
        raise RateLimited
    now = utcnow()
    # A new code replaces any earlier one.
    await session.execute(
        update(StaffLoginToken)
        .where(
            StaffLoginToken.staff_user_id == staff.id,
            StaffLoginToken.purpose == StaffTokenPurpose.REAUTH,
            StaffLoginToken.used_at.is_(None),
        )
        .values(used_at=now)
    )
    code = f"{secrets.randbelow(1_000_000):06d}"
    token_id = uuid.uuid4()
    minutes = settings.staff_reauth_code_ttl_minutes
    session.add(
        StaffLoginToken(
            id=token_id,
            staff_user_id=staff.id,
            purpose=StaffTokenPurpose.REAUTH,
            token_hash=_code_hash(token_id, code),
            created_at=now,
            expires_at=now + timedelta(minutes=minutes),
        )
    )
    await session.flush()
    await email_port.send(
        Email(
            to=staff.email,
            subject=translate("email.staff_reauth.subject", {"code": code}),
            text=translate(
                "email.staff_reauth.text",
                {"name": staff.name.split(" ")[0], "code": code, "minutes": minutes},
            ),
        )
    )
    if settings.app_env == "development":
        log.info("dev_staff_reauth_code", code=code)


async def confirm_reauth_code(
    session: AsyncSession,
    staff: StaffUser,
    family_id: uuid.UUID,
    code: str,
    *,
    settings: Settings,
) -> str:
    """Checks the code and returns a new access token carrying the new proof time."""
    now = utcnow()
    row = await session.scalar(
        select(StaffLoginToken)
        .where(
            StaffLoginToken.staff_user_id == staff.id,
            StaffLoginToken.purpose == StaffTokenPurpose.REAUTH,
            StaffLoginToken.used_at.is_(None),
            StaffLoginToken.expires_at > now,
        )
        .order_by(StaffLoginToken.created_at.desc())
        .limit(1)
        .with_for_update()
    )
    if row is None or row.attempts >= settings.staff_reauth_max_attempts:
        raise AppError("reauth_code_invalid", status_code=400)
    row.attempts += 1
    if not secrets.compare_digest(row.token_hash, _code_hash(row.id, code)):
        await session.flush()
        raise AppError("reauth_code_invalid", status_code=400)
    row.used_at = now
    await session.execute(
        update(StaffSession)
        .where(StaffSession.family_id == family_id, StaffSession.revoked_at.is_(None))
        .values(authenticated_at=now)
    )
    record(session, actor_for(staff, now), "staff.reauthenticated", "staff_users", staff.id)
    await session.flush()
    return encode_staff_token(settings, staff.id, family_id, now, now)


def reauth_valid_until(settings: Settings, authenticated_at: datetime | None) -> datetime | None:
    if authenticated_at is None:
        return None
    until = authenticated_at + timedelta(minutes=settings.staff_reauth_minutes)
    return until if until > utcnow() else None


def ensure_recent_auth(settings: Settings, actor: Actor) -> None:
    if actor.kind != "staff":
        return  # scripts (admin token) have no interactive proof to renew
    if reauth_valid_until(settings, actor.authenticated_at) is None:
        raise ReauthRequired


# ------------------------------------------------------------------ me and team


def me_out(staff: StaffUser, actor: Actor, settings: Settings) -> StaffMeOut:
    return StaffMeOut(
        id=staff.id,
        name=staff.name,
        email=staff.email,
        role=staff.role,
        permissions=sorted(permissions_for(staff.role)),
        reauth_valid_until=reauth_valid_until(settings, actor.authenticated_at),
        environment=settings.backoffice_environment,
        modules=list(settings.backoffice_modules),
    )


def _member_out(staff: StaffUser) -> StaffMemberOut:
    return StaffMemberOut(
        id=staff.id,
        name=staff.name,
        email=mask_email(staff.email) or "",
        role=staff.role,
        active=staff.active,
        last_seen_at=staff.last_seen_at,
    )


async def list_team(session: AsyncSession) -> list[StaffMemberOut]:
    rows = await session.scalars(
        select(StaffUser).order_by(StaffUser.active.desc(), StaffUser.created_at)
    )
    return [_member_out(s) for s in rows]


async def _active_admins(session: AsyncSession) -> int:
    count = await session.scalar(
        select(func.count())
        .select_from(StaffUser)
        .where(StaffUser.role == StaffRole.ADMIN, StaffUser.active.is_(True))
    )
    return int(count or 0)


async def invite(session: AsyncSession, actor: Actor, payload: StaffInviteIn) -> StaffMemberOut:
    existing = await session.scalar(select(StaffUser).where(StaffUser.email == payload.email))
    if existing is not None:
        raise AppError("staff_exists", status_code=409)
    staff = StaffUser(
        email=payload.email,
        name=payload.name,
        role=payload.role,
        active=True,
        invited_by_id=actor.staff_id,
    )
    session.add(staff)
    await session.flush()
    record(
        session,
        actor,
        "staff.invited",
        "staff_users",
        staff.id,
        name=staff.name,
        role=staff.role.value,
    )
    return _member_out(staff)


async def update_member(
    session: AsyncSession, actor: Actor, staff_id: uuid.UUID, payload: StaffUpdateIn
) -> StaffMemberOut:
    staff = await session.get(StaffUser, staff_id, with_for_update=True)
    if staff is None:
        raise AppError("not_found", status_code=404)
    changes: dict[str, str | bool] = {}
    loses_admin = (
        staff.role == StaffRole.ADMIN
        and staff.active
        and (
            (payload.role is not None and payload.role != StaffRole.ADMIN)
            or payload.active is False
        )
    )
    if loses_admin and await _active_admins(session) <= 1:
        raise AppError("last_admin", status_code=409)
    if payload.role is not None and payload.role != staff.role:
        changes["role"] = payload.role.value
        changes["previous_role"] = staff.role.value
        staff.role = payload.role
    if payload.active is not None and payload.active != staff.active:
        changes["active"] = payload.active
        staff.active = payload.active
        if not payload.active:
            # Deactivation ends every open session at once.
            await session.execute(
                update(StaffSession)
                .where(StaffSession.staff_user_id == staff.id, StaffSession.revoked_at.is_(None))
                .values(revoked_at=utcnow())
            )
    if changes:
        record(
            session,
            actor,
            "staff.updated",
            "staff_users",
            staff.id,
            name=staff.name,
            changes=changes,
        )
    await session.flush()
    return _member_out(staff)


async def bootstrap_admin(
    session: AsyncSession, actor: Actor, email: str, name: str
) -> StaffMemberOut:
    """First Admin, created by a script with the admin token. Refused once an Admin exists."""
    if await _active_admins(session) > 0:
        raise AppError("staff_already_bootstrapped", status_code=409)
    staff = await session.scalar(select(StaffUser).where(StaffUser.email == email))
    if staff is None:
        staff = StaffUser(email=email, name=name, role=StaffRole.ADMIN, active=True)
        session.add(staff)
    else:
        staff.role, staff.active = StaffRole.ADMIN, True
    await session.flush()
    record(session, actor, "staff.bootstrapped", "staff_users", staff.id, name=staff.name)
    return _member_out(staff)


# ------------------------------------------------------------------ audit log


@dataclass(frozen=True, slots=True)
class AuditFilters:
    actor_staff_id: uuid.UUID | None = None
    actor: str | None = None  # "system" or "system:admin-token"
    action: str | None = None
    since: datetime | None = None
    until: datetime | None = None


def _audit_query(filters: AuditFilters) -> Select[AuditLog, str]:
    query = select(AuditLog, StaffUser.name).outerjoin(
        StaffUser, StaffUser.id == AuditLog.actor_staff_id
    )
    if filters.actor_staff_id is not None:
        query = query.where(AuditLog.actor_staff_id == filters.actor_staff_id)
    if filters.actor is not None:
        query = query.where(AuditLog.actor == filters.actor)
    if filters.action is not None:
        query = query.where(AuditLog.action == filters.action)
    if filters.since is not None:
        query = query.where(AuditLog.occurred_at >= filters.since)
    if filters.until is not None:
        query = query.where(AuditLog.occurred_at < filters.until)
    return query


def actor_name(row: AuditLog, staff_name: str | None) -> str:
    if staff_name:
        return staff_name
    if row.actor == ADMIN_TOKEN_ACTOR:
        return "Script"
    if row.actor.startswith("staff:"):
        return "Equipe (token antigo)"  # rows from before staff accounts
    return "Sistema"


def _entry(row: AuditLog, staff_name: str | None) -> AuditEntryOut:
    return AuditEntryOut(
        id=row.id,
        occurred_at=row.occurred_at,
        actor=row.actor,
        actor_name=actor_name(row, staff_name),
        actor_staff_id=row.actor_staff_id,
        action=row.action,
        entity=row.entity,
        entity_id=row.entity_id,
        reason=row.reason,
        details=row.details or {},
    )


async def list_audit(
    session: AsyncSession, filters: AuditFilters, *, before: datetime | None, limit: int
) -> AuditPage:
    query = _audit_query(filters)
    if before is not None:
        query = query.where(AuditLog.occurred_at < before)
    rows = (
        await session.execute(
            query.order_by(AuditLog.occurred_at.desc(), AuditLog.id.desc()).limit(limit + 1)
        )
    ).all()
    items = [_entry(r, name) for r, name in rows[:limit]]
    actions = list(
        await session.scalars(select(AuditLog.action).distinct().order_by(AuditLog.action))
    )
    return AuditPage(
        items=items,
        next_before=items[-1].occurred_at if len(rows) > limit else None,
        actions=actions,
    )


AUDIT_EXPORT_MAX_ROWS = 50_000


async def export_audit_csv(session: AsyncSession, actor: Actor, filters: AuditFilters) -> str:
    rows = (
        await session.execute(
            _audit_query(filters).order_by(AuditLog.occurred_at.desc()).limit(AUDIT_EXPORT_MAX_ROWS)
        )
    ).all()
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["data", "hora", "quem", "acao", "entidade", "id", "motivo", "detalhe"])
    for row, name in rows:
        writer.writerow(
            [
                format_date(row.occurred_at),
                format_time(row.occurred_at),
                actor_name(row, name),
                row.action,
                row.entity,
                row.entity_id or "",
                row.reason or "",
                _details_text(row.details or {}),
            ]
        )
    # The export itself is audited (after building it, so it is not part of its own file).
    record(
        session,
        actor,
        "audit.exported",
        "audit_log",
        None,
        count=len(rows),
        filters={k: str(v) for k, v in vars_of(filters).items() if v is not None},
    )
    await session.flush()
    return buffer.getvalue()


def vars_of(filters: AuditFilters) -> dict[str, object]:
    return {
        "actor_staff_id": filters.actor_staff_id,
        "actor": filters.actor,
        "action": filters.action,
        "since": filters.since,
        "until": filters.until,
    }


def _details_text(details: dict[str, object]) -> str:
    return "; ".join(f"{k}={v}" for k, v in sorted(details.items()))
