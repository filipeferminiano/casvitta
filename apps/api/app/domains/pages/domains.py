"""Custom domains for broker pages (mockups social/14 and 15; plans with custom_domain).

The broker adds a TXT record (proves they own the domain) and a CNAME to our target. A check
(the broker's "Verificar agora" or the daily job) moves the domain along:

    pending ──DNS right──▶ provisioning ──certificate──▶ active
       │ (after the wait)        │ (certificate failed)      │ (DNS removed / certificate failed)
       └──────────────▶ error ◀──┴───────────────────────────┘

An error says exactly what was found. While a domain is not active the page stays on
{slug}.casvitta.com.br, so it is never offline; once active, the subdomain redirects to it (the
web answers 308) and old QR codes keep working. Detaching releases the certificate and keeps the
row as history.
"""

from __future__ import annotations

import re
import secrets
from datetime import datetime, timedelta
from urllib.parse import urlsplit

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.catalog import Feature, has_feature
from app.core.errors import AppError
from app.core.i18n import translate
from app.core.settings import Settings
from app.core.tenancy import cross_tenant
from app.core.time import utcnow
from app.domains.accounts.models import BrokerProfile, User, Workspace
from app.domains.pages.models import BrokerPage, CustomDomain, DomainStatus
from app.integrations.domains.port import CertificateState, DomainsPort
from app.integrations.messaging.port import Email, EmailPort

_LABEL = re.compile(r"^(?!-)[a-z0-9-]{1,63}(?<!-)$")
# Registrable suffixes: a hostname right under one of these is the bare domain (no CNAME there).
_SUFFIXES = frozenset(
    {
        "br", "com.br", "net.br", "org.br", "imb.br", "adv.br", "eng.br", "arq.br", "art.br",
        "blog.br", "eco.br", "emp.br", "app.br", "dev.br", "tec.br", "com", "net", "org", "io",
        "co", "app", "dev", "site", "online", "imb", "test", "localhost",
    }
)  # fmt: skip
_LIVE = (DomainStatus.PENDING, DomainStatus.PROVISIONING, DomainStatus.ACTIVE, DomainStatus.ERROR)
VERIFICATION_PREFIX = "_casvitta"


class DomainOut(BaseModel):
    hostname: str
    zone: str  # the registered domain (marianaimoveis.com.br), where the records are created
    status: DomainStatus
    # DNS records the broker creates (shown with copy buttons).
    # Full names, and the short names most providers ask for ("_casvitta.www", "www").
    txt_name: str
    txt_host: str
    txt_value: str
    cname_name: str
    cname_host: str
    cname_target: str
    error_code: str | None
    found_value: str | None
    last_checked_at: datetime | None
    activated_at: datetime | None
    created_at: datetime
    waiting_until: datetime  # after this, missing DNS records become an error


def normalize_hostname(value: str, settings: Settings) -> str:
    """'https://WWW.MarianaImoveis.com.br/' -> 'www.marianaimoveis.com.br', or a ValueError code."""
    raw = value.strip().lower()
    if "://" in raw:
        raw = urlsplit(raw).hostname or ""
    raw = raw.split("/")[0].rstrip(".")
    try:
        host = raw.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise ValueError("domain_invalid") from exc
    labels = host.split(".")
    if len(host) > 253 or len(labels) < 2 or not all(_LABEL.match(x) for x in labels):
        raise ValueError("domain_invalid")
    root = urlsplit(settings.site_url).hostname or ""
    root = root.removeprefix("www.")
    if "casvitta" in host or host == root or host.endswith(f".{root}"):
        raise ValueError("domain_reserved")
    if ".".join(labels[1:]) in _SUFFIXES or host in _SUFFIXES:
        raise ValueError("domain_apex")  # a CNAME cannot sit on the bare domain: use www.
    return host


def domain_url(settings: Settings, hostname: str) -> str:
    """Same scheme and port as the site (https in production; http://…:3000 locally)."""
    site = urlsplit(settings.site_url)
    port = f":{site.port}" if site.port else ""
    return f"{site.scheme}://{hostname}{port}"


def zone_of(hostname: str) -> str:
    """Registered domain: the longest known suffix plus one label."""
    labels = hostname.split(".")
    for i in range(len(labels)):
        if ".".join(labels[i + 1 :]) in _SUFFIXES:
            return ".".join(labels[i:])
    return ".".join(labels[-2:])


def _relative(name: str, zone: str) -> str:
    return name.removesuffix(f".{zone}") if name != zone else "@"


def verification_name(hostname: str) -> str:
    return f"{VERIFICATION_PREFIX}.{hostname}"


def to_out(domain: CustomDomain, settings: Settings) -> DomainOut:
    zone = zone_of(domain.hostname)
    return DomainOut(
        hostname=domain.hostname,
        zone=zone,
        status=domain.status,
        txt_name=verification_name(domain.hostname),
        txt_host=_relative(verification_name(domain.hostname), zone),
        txt_value=domain.verification_token,
        cname_name=domain.hostname,
        cname_host=_relative(domain.hostname, zone),
        cname_target=settings.custom_domain_cname_target,
        error_code=domain.error_code,
        found_value=domain.found_value,
        last_checked_at=domain.last_checked_at,
        activated_at=domain.activated_at,
        created_at=domain.created_at,
        waiting_until=domain.created_at + timedelta(hours=settings.custom_domain_dns_wait_hours),
    )


async def _allowed(session: AsyncSession, workspace_id: object) -> bool:
    workspace = await session.get(Workspace, workspace_id)
    return workspace is not None and has_feature(workspace.plan, Feature.CUSTOM_DOMAIN)


async def live_for_page(session: AsyncSession, page: BrokerPage) -> CustomDomain | None:
    return await session.scalar(
        select(CustomDomain).where(CustomDomain.page_id == page.id, CustomDomain.status.in_(_LIVE))
    )


async def serving_hostname(session: AsyncSession, page: BrokerPage) -> str | None:
    """The domain the page is served on now: active and still in the plan (else the subdomain)."""
    domain = await live_for_page(session, page)
    if domain is None or domain.status != DomainStatus.ACTIVE:
        return None
    return domain.hostname if await _allowed(session, page.workspace_id) else None


async def connect(
    session: AsyncSession, page: BrokerPage, raw: str, settings: Settings
) -> CustomDomain:
    if not await _allowed(session, page.workspace_id):
        raise AppError("feature_not_in_plan", status_code=403)
    try:
        hostname = normalize_hostname(raw, settings)
    except ValueError as exc:
        raise AppError(str(exc), status_code=422) from exc
    if await live_for_page(session, page) is not None:
        raise AppError("domain_already_connected", status_code=409)
    with cross_tenant(session):  # a hostname is unique across the platform
        taken = await session.scalar(
            select(CustomDomain.id).where(
                CustomDomain.hostname == hostname, CustomDomain.status.in_(_LIVE)
            )
        )
    if taken is not None:
        raise AppError("domain_taken", status_code=409)
    domain = CustomDomain(
        page_id=page.id,
        hostname=hostname,
        verification_token=f"casvitta-verify={secrets.token_hex(12)}",
    )
    session.add(domain)
    await session.flush()
    return domain


def _dns_problem(
    domain: CustomDomain, txt: tuple[str, ...], cname: str | None, settings: Settings
) -> tuple[str, str | None] | None:
    target = settings.custom_domain_cname_target.lower().rstrip(".")
    if domain.verification_token not in txt:
        return "txt_missing", (txt[0] if txt else None)
    if cname is None:
        return "cname_missing", None
    if cname.lower().rstrip(".") != target:
        return "cname_wrong", cname
    return None


async def check(
    session: AsyncSession,
    domain: CustomDomain,
    port: DomainsPort,
    settings: Settings,
    *,
    email_port: EmailPort | None = None,
    now: datetime | None = None,
) -> None:
    if domain.status == DomainStatus.DETACHED:
        return
    now = now or utcnow()
    before = domain.status
    answer = await port.lookup(domain.hostname, verification_name(domain.hostname))
    problem = _dns_problem(domain, answer.txt, answer.cname, settings)
    domain.last_checked_at = now
    waited = now - domain.created_at > timedelta(hours=settings.custom_domain_dns_wait_hours)
    if problem is not None:
        domain.error_code, domain.found_value = problem
        if domain.status != DomainStatus.PENDING or waited:
            domain.status = DomainStatus.ERROR
    elif domain.status in (DomainStatus.PENDING, DomainStatus.ERROR):
        await port.request_certificate(domain.hostname)
        domain.status = DomainStatus.PROVISIONING
        domain.error_code = domain.found_value = None
    else:
        state = await port.certificate_state(domain.hostname)
        if state == CertificateState.FAILED:
            domain.status, domain.error_code, domain.found_value = (
                DomainStatus.ERROR,
                "cert_failed",
                None,
            )
        elif state == CertificateState.ACTIVE and domain.status == DomainStatus.PROVISIONING:
            domain.status = DomainStatus.ACTIVE
            domain.activated_at = now
            domain.error_code = domain.found_value = None
    await session.flush()
    if email_port is not None and domain.status != before:
        if domain.status == DomainStatus.ACTIVE:
            await _notify(session, domain, "domain_active", email_port, settings)
        elif before == DomainStatus.ACTIVE:
            await _notify(session, domain, "domain_broken", email_port, settings)


async def _notify(
    session: AsyncSession, domain: CustomDomain, kind: str, email_port: EmailPort, s: Settings
) -> None:
    with cross_tenant(session):
        row = (
            await session.execute(
                select(BrokerProfile, User)
                .join(BrokerPage, BrokerPage.broker_profile_id == BrokerProfile.id)
                .join(User, User.id == BrokerProfile.user_id)
                .where(BrokerPage.id == domain.page_id)
            )
        ).first()
    if row is None:
        return
    profile, user = row
    site = urlsplit(s.site_url)
    root = (site.hostname or "").removeprefix("www.")
    port = f":{site.port}" if site.port else ""
    subdomain = f"{site.scheme}://{profile.slug}.{root}{port}"
    await email_port.send(
        Email(
            to=user.email,
            subject=translate(f"email.{kind}.subject", {"domain": domain.hostname}),
            text=translate(
                f"email.{kind}.text",
                {
                    "name": profile.display_name.split(" ")[0],
                    "domain": domain.hostname,
                    "subdomain": subdomain,
                    "problem": translate(f"domain_error.{domain.error_code or 'cert_failed'}"),
                    "link": f"{s.app_url}/minha-pagina",
                },
            ),
        )
    )


async def detach(session: AsyncSession, page: BrokerPage, port: DomainsPort) -> None:
    domain = await live_for_page(session, page)
    if domain is None:
        raise AppError("domain_not_found", status_code=404)
    await port.release_certificate(domain.hostname)
    domain.status = DomainStatus.DETACHED
    domain.detached_at = utcnow()
    await session.flush()


async def resolve(session: AsyncSession, hostname: str) -> str | None:
    """Public: which page slug a custom hostname serves (active domains in a plan that has it)."""
    with cross_tenant(session):
        row = (
            await session.execute(
                select(CustomDomain, BrokerPage, BrokerProfile)
                .join(BrokerPage, BrokerPage.id == CustomDomain.page_id)
                .join(BrokerProfile, BrokerProfile.id == BrokerPage.broker_profile_id)
                .where(
                    CustomDomain.hostname == hostname.lower().split(":")[0],
                    CustomDomain.status == DomainStatus.ACTIVE,
                )
            )
        ).first()
        if row is None or not await _allowed(session, row[1].workspace_id):
            return None
    return row[2].slug


async def check_all(
    session: AsyncSession, port: DomainsPort, settings: Settings, email_port: EmailPort
) -> int:
    """Daily job: every domain not detached."""
    with cross_tenant(session):
        domains = (
            await session.scalars(select(CustomDomain).where(CustomDomain.status.in_(_LIVE)))
        ).all()
        for domain in domains:
            await check(session, domain, port, settings, email_port=email_port)
        await session.commit()
    return len(domains)
