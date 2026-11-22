"""L-1: properties, owner authorizations and the publication gate (CLAUDE.md rules 1, 2, 7)."""

from __future__ import annotations

import json
import uuid
from datetime import date, timedelta
from typing import Any

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import encode_access_token
from app.core.settings import Settings
from app.core.tenancy import bind_workspace, cross_tenant
from app.core.time import today_local, utcnow
from app.domains.accounts.models import AuditLog, BrokerProfile, Workspace
from app.domains.backoffice import authorizations
from app.domains.listings.models import Channel, Listing, ListingStatus, UnpublishReason
from app.domains.listings.rules import Blocker
from app.domains.properties import service
from app.domains.properties.models import (
    AuthorizationReview,
    Property,
    PropertyMedia,
    Transaction,
)
from app.domains.properties.schemas import AuthorizationIn, PropertyIn, PropertyPatch
from app.domains.staff.audit import Actor
from app.domains.staff.models import StaffRole
from app.integrations.registry import Integrations
from tests.staff_helpers import add_broker, add_staff, make_client, sign_in, staff_settings

SETTINGS = Settings(cookie_path_prefix="")
TODAY = date(2026, 11, 21)


def property_in(**overrides: Any) -> PropertyIn:
    fields: dict[str, Any] = {
        "kind": "apartment",
        "transaction": "sale",
        "street": "Rua Domingos de Morais",
        "neighborhood": "Vila Mariana",
        "city": "São Paulo",
        "state": "SP",
        "area_m2": 68,
        "bedrooms": 2,
        "parking": 1,
        "price_cents": 69_000_000,
        "condo_fee_cents": 82_000,
    }
    fields.update(overrides)
    return PropertyIn(**fields)


def authorization(**overrides: Any) -> AuthorizationIn:
    fields: dict[str, Any] = {
        "kind": "sale",
        "evidence": "attestation",
        "attest": True,
        "owner_name": "Proprietária Exemplo",
        "signed_at": TODAY - timedelta(days=10),
        "expires_at": TODAY + timedelta(days=80),
    }
    fields.update(overrides)
    return AuthorizationIn(**fields)


async def bound(make_session, broker: BrokerProfile) -> AsyncSession:  # type: ignore[no-untyped-def]
    s: AsyncSession = make_session()
    bind_workspace(s, broker.workspace_id)
    return s


async def add_photos(s: AsyncSession, prop: Property, n: int = 5) -> None:
    s.add_all(
        PropertyMedia(property_id=prop.id, storage_key=f"k{i}", url=f"https://img/{i}", position=i)
        for i in range(n)
    )
    await s.flush()


async def ready_property(
    s: AsyncSession, broker: BrokerProfile, *, verified: bool = True, **overrides: Any
) -> Property:
    prop = await service.create_property(s, property_in(**overrides))
    await add_photos(s, prop)
    await service.update_property(s, prop.id, PropertyPatch(status="active"))
    auth = await service.add_authorization(
        s, prop.id, authorization(kind=prop.transaction.value), broker.user_id
    )
    if verified:
        auth.review_status = AuthorizationReview.VERIFIED
    return prop


async def test_create_assigns_code_slug_and_the_owner_as_responsible(make_session) -> None:  # type: ignore[no-untyped-def]
    async with make_session() as setup:
        broker = await add_broker(setup, "Ana Ribeiro", verified=True)
    s = await bound(make_session, broker)
    first = await service.create_property(s, property_in())
    second = await service.create_property(s, property_in())
    assert first.code.startswith("CV-") and first.code != second.code
    assert first.slug == "apartamento-rua-domingos-de-morais-vila-mariana"
    assert second.slug.endswith("-2")
    assert first.responsible_broker_id == broker.id
    out = await service.to_out(s, first, TODAY)
    assert out.condo_fee_cents == 82_000 and out.iptu_monthly_cents is None  # "Não informado"
    assert Blocker.AUTHORIZATION_MISSING in out.blockers
    await s.close()


async def test_publish_requires_verified_creci_and_valid_authorization(make_session) -> None:  # type: ignore[no-untyped-def]
    async with make_session() as setup:
        pending = await add_broker(setup, "Bruno Pendente", verified=False)
        ok = await add_broker(setup, "Carla Conferida", verified=True)

    s = await bound(make_session, pending)
    prop = await ready_property(s, pending)
    try:
        await service.publish(s, prop.id, Channel.MARKETPLACE, TODAY)
        raise AssertionError("published without a verified CRECI")
    except service.PublishBlocked as exc:
        assert exc.blockers == [Blocker.CRECI_UNVERIFIED]
    await s.close()

    s = await bound(make_session, ok)
    bare = await service.create_property(s, property_in())
    await add_photos(s, bare)
    await service.update_property(s, bare.id, PropertyPatch(status="active"))
    try:
        await service.publish(s, bare.id, Channel.MARKETPLACE, TODAY)
        raise AssertionError("published without authorization")
    except service.PublishBlocked as exc:
        assert exc.blockers == [Blocker.AUTHORIZATION_MISSING]

    # Rental authorization does not cover a sale.
    await service.add_authorization(s, bare.id, authorization(kind="rent"), ok.user_id)
    assert await service.blockers_for(s, bare, TODAY) == [Blocker.AUTHORIZATION_WRONG_KIND]

    # Expired yesterday.
    old = authorization(signed_at=TODAY - timedelta(days=100), expires_at=TODAY - timedelta(days=1))
    await service.add_authorization(s, bare.id, old, ok.user_id)
    assert await service.blockers_for(s, bare, TODAY) == [Blocker.AUTHORIZATION_EXPIRED]

    # Valid through its last day.
    last = await service.add_authorization(s, bare.id, authorization(expires_at=TODAY), ok.user_id)
    # Every broker check passes: it waits for the Casvitta check of the authorization.
    listing = await service.publish(s, bare.id, Channel.MARKETPLACE, TODAY)
    assert listing.status == ListingStatus.PENDING_REVIEW
    last.review_status = AuthorizationReview.VERIFIED
    listing = await service.publish(s, bare.id, Channel.MARKETPLACE, TODAY)
    assert listing.status == ListingStatus.PUBLISHED and listing.published_at is not None
    await s.close()


async def test_draft_and_paused_workspace_block_publication(make_session) -> None:  # type: ignore[no-untyped-def]
    async with make_session() as setup:
        broker = await add_broker(setup, "Dora Lima", verified=True)
    s = await bound(make_session, broker)
    prop = await service.create_property(s, property_in())
    await service.add_authorization(s, prop.id, authorization(), broker.user_id)
    assert await service.blockers_for(s, prop, TODAY) == [
        Blocker.PROPERTY_NOT_ACTIVE,
        Blocker.FEWER_PHOTOS,
    ]
    await add_photos(s, prop, 5)
    await service.update_property(s, prop.id, PropertyPatch(status="active"))
    workspace = await s.get(Workspace, broker.workspace_id)
    assert workspace is not None
    workspace.publishing_paused_at = utcnow()
    assert await service.blockers_for(s, prop, TODAY) == [Blocker.PUBLISHING_PAUSED]
    await s.close()


async def test_sold_property_leaves_every_channel(make_session) -> None:  # type: ignore[no-untyped-def]
    async with make_session() as setup:
        broker = await add_broker(setup, "Eva Souza", verified=True)
    s = await bound(make_session, broker)
    prop = await ready_property(s, broker)
    await service.publish(s, prop.id, Channel.MARKETPLACE, TODAY)
    await service.publish(s, prop.id, Channel.BIO_PAGE, TODAY)
    await service.update_property(s, prop.id, PropertyPatch(status="sold"))
    listings = (await s.scalars(select(Listing).where(Listing.property_id == prop.id))).all()
    assert {(item.status, item.unpublish_reason) for item in listings} == {
        (ListingStatus.UNPUBLISHED, UnpublishReason.PROPERTY_UNAVAILABLE)
    }
    await s.close()


async def test_daily_job_unpublishes_expired_authorizations_and_audits(make_session) -> None:  # type: ignore[no-untyped-def]
    async with make_session() as setup:
        broker = await add_broker(setup, "Fábio Reis", verified=True)
    s = await bound(make_session, broker)
    prop = await ready_property(s, broker)
    await service.publish(s, prop.id, Channel.MARKETPLACE, TODAY)
    await s.commit()
    await s.close()

    async with make_session() as job:
        expiry = TODAY + timedelta(days=81)  # the authorization ended the day before
        assert await service.public_listings(job, Channel.MARKETPLACE, today=expiry) == []
        assert await service.expire_authorizations(job, expiry) == 1
        with cross_tenant(job):
            listing = await job.scalar(select(Listing).where(Listing.property_id == prop.id))
            audit = await job.scalar(select(AuditLog).where(AuditLog.entity_id == str(prop.id)))
        assert (
            listing is not None
            and listing.unpublish_reason == UnpublishReason.AUTHORIZATION_EXPIRED
        )
        assert (
            audit is not None
            and audit.actor == "system"
            and audit.reason == "authorization_expired"
        )


async def test_public_read_model_hides_private_fields_demo_and_unverified(make_session) -> None:  # type: ignore[no-untyped-def]
    async with make_session() as setup:
        real = await add_broker(setup, "Gabi Torres", verified=True)
        demo = await add_broker(setup, "Ana Demo", verified=True, is_demo=True)
    s = await bound(make_session, real)
    prop = await ready_property(s, real, street_number="1200", complement="ap 41")
    await service.publish(s, prop.id, Channel.MARKETPLACE, TODAY)
    await s.commit()
    await s.close()

    s = await bound(make_session, demo)
    demo_prop = await ready_property(s, demo)
    demo_prop.is_demo = True
    await service.publish(s, demo_prop.id, Channel.MARKETPLACE, TODAY)
    await s.commit()
    await s.close()

    async with make_session() as public:
        listings = await service.public_listings(public, Channel.MARKETPLACE, today=TODAY)
        assert [item.code for item in listings] == [prop.code]
        item = listings[0].model_dump()
        assert "street_number" not in item and "complement" not in item and "lat" not in item
        assert item["street"] is None  # street only when the broker allows it
        assert item["broker"]["creci_number"] == "123.456-F"
        assert item["iptu_monthly_cents"] is None
        with_demo = await service.public_listings(
            public, Channel.MARKETPLACE, include_demo=True, today=TODAY
        )
        assert len(with_demo) == 2
        assert listings[0].slug == f"{prop.slug}-{prop.code.lower()}"
        place = await service.public_listings(
            public,
            Channel.MARKETPLACE,
            transaction=Transaction.SALE,
            city="sao-paulo",
            neighborhood="vila-mariana",
            today=TODAY,
        )
        assert [p.code for p in place] == [prop.code]
        assert not await service.public_listings(
            public, Channel.MARKETPLACE, neighborhood="moema", today=TODAY
        )
        assert not await service.public_listings(
            public, Channel.MARKETPLACE, transaction=Transaction.RENT, today=TODAY
        )
        # Street filter only matches streets the broker shows publicly.
        assert not await service.public_listings(
            public, Channel.MARKETPLACE, street="rua-domingos-de-morais", today=TODAY
        )

        # CRECI revoked after publishing: gone from the public read immediately.
        with cross_tenant(public):
            profile = await public.get(BrokerProfile, real.id)
            assert profile is not None
            profile.creci_verified_at = None
            await public.flush()
        assert await service.public_listings(public, Channel.MARKETPLACE, today=TODAY) == []


def _cookie(broker: BrokerProfile) -> dict[str, str]:
    token = encode_access_token(SETTINGS, broker.user_id, broker.workspace_id)
    return {"cookie": f"cv_at={token}"}


async def test_api_is_confined_to_the_workspace(make_session, integrations: Integrations) -> None:  # type: ignore[no-untyped-def]  # noqa: PLR0915
    async with make_session() as setup:
        ana = await add_broker(setup, "Ana Ribeiro", verified=True)
        bruno = await add_broker(setup, "Bruno Alves", verified=True)

    api: AsyncClient
    async with make_client(make_session, integrations, SETTINGS) as api:
        created = await api.post(
            "/v1/properties",
            json=json.loads(property_in().model_dump_json()),
            headers=_cookie(ana),
        )
        assert created.status_code == 201, created.text
        body = created.json()
        assert body["blockers"] == [
            "property_not_active",
            "authorization_missing",
            "fewer_photos",
        ]
        pid = body["id"]

        assert (await api.get(f"/v1/properties/{pid}", headers=_cookie(bruno))).status_code == 404
        assert (await api.get("/v1/properties", headers=_cookie(bruno))).json() == []

        blocked = await api.put(f"/v1/properties/{pid}/listings/marketplace", headers=_cookie(ana))
        assert blocked.status_code == 409
        assert blocked.json()["error"]["code"] == "publish_blocked.property_not_active"

        await api.patch(f"/v1/properties/{pid}", json={"status": "active"}, headers=_cookie(ana))
        auth = authorization().model_dump(mode="json")
        added = await api.post(
            f"/v1/properties/{pid}/authorizations",
            data={"data": json.dumps(auth)},
            headers=_cookie(ana),
        )
        assert added.status_code == 201, added.text
        assert added.json()["authorization"]["evidence"] == "attestation"

        doc = {**auth, "evidence": "document", "attest": False}
        missing = await api.post(
            f"/v1/properties/{pid}/authorizations",
            data={"data": json.dumps(doc)},
            headers=_cookie(ana),
        )
        assert missing.status_code == 422

        for i in range(5):
            r = await api.post(
                f"/v1/properties/{pid}/photos",
                files={"photo": (f"f{i}.jpg", b"\xff\xd8\xff", "image/jpeg")},
                headers=_cookie(ana),
            )
            assert r.status_code == 201
        published = await api.put(
            f"/v1/properties/{pid}/listings/marketplace", headers=_cookie(ana)
        )
        assert published.status_code == 200, published.text
        # Waits for the Casvitta check of the owner's authorization (BO6).
        assert published.json()["listings"][0]["status"] == "pending_review"
        assert (await api.get("/v1/public/listings")).json() == []

        assert published.json()["media"][0]["is_cover"] is True
        wrong = await api.post(
            f"/v1/properties/{pid}/photos",
            files={"photo": ("x.exe", b"MZ", "application/octet-stream")},
            headers=_cookie(ana),
        )
        assert wrong.status_code == 415

        assert (await api.get("/v1/public/listings?channel=meta")).status_code == 404

    async with make_session() as setup:
        await add_staff(setup, "ops@casvitta.com.br", StaffRole.OPERATIONS)
        await add_staff(setup, "fin@casvitta.com.br", StaffRole.FINANCE)
    staff_cfg = staff_settings()
    async with make_client(make_session, integrations, staff_cfg) as fin:
        await sign_in(fin, integrations, "fin@casvitta.com.br")
        assert (await fin.get("/v1/staff/authorizations")).status_code == 403
    async with make_client(make_session, integrations, staff_cfg) as ops:
        await sign_in(ops, integrations, "ops@casvitta.com.br")
        queue = (await ops.get("/v1/staff/authorizations")).json()
        assert [q["property_code"] for q in queue] == [body["code"]]
        assert queue[0]["waiting_listings"] == 1 and queue[0]["evidence"] == "attestation"
        r = await ops.post(f"/v1/staff/authorizations/{queue[0]['id']}/verify")
        assert r.status_code == 204
        assert (await ops.get("/v1/staff/authorizations")).json() == []

    async with make_client(make_session, integrations, SETTINGS) as api:
        public = await api.get("/v1/public/listings")
        assert [item["code"] for item in public.json()] == [body["code"]]
        mine = (await api.get(f"/v1/properties/{pid}", headers=_cookie(ana))).json()
        assert mine["listings"][0]["status"] == "published"
        assert mine["authorization"]["review_status"] == "verified"
    async with make_session() as check:
        with cross_tenant(check):
            entry = await check.scalar(
                select(AuditLog).where(AuditLog.action == "authorization.verified")
            )
        assert entry is not None and entry.details["listings"] == 1


async def test_rejected_authorization_keeps_the_listing_off(make_session) -> None:  # type: ignore[no-untyped-def]
    async with make_session() as setup:
        broker = await add_broker(setup, "Helena Prado", verified=True)
        staff = await add_staff(setup, "ops2@casvitta.com.br", StaffRole.OPERATIONS)
    s = await bound(make_session, broker)
    prop = await ready_property(s, broker, verified=False)
    listing = await service.publish(s, prop.id, Channel.MARKETPLACE, TODAY)
    assert listing.status == ListingStatus.PENDING_REVIEW
    await s.commit()
    await s.close()

    async with make_session() as staff_session:
        queue = await authorizations.queue(staff_session)
        actor = Actor.staff(staff.id, staff.name, frozenset(), None)
        await authorizations.reject(staff_session, actor, queue[0].id, "Assinatura ilegível")
        await staff_session.commit()

    s = await bound(make_session, broker)
    out = await service.to_out(s, await service.get_property(s, prop.id), TODAY)
    assert out.listings[0].status == ListingStatus.UNPUBLISHED
    assert Blocker.AUTHORIZATION_REJECTED in out.blockers
    await s.close()


async def test_authorization_dates_are_validated() -> None:
    try:
        authorization(signed_at=TODAY, expires_at=TODAY - timedelta(days=1))
        raise AssertionError("accepted an authorization that ends before it starts")
    except ValueError:
        pass
    try:
        authorization(attest=False)
        raise AssertionError("accepted an attestation without the broker's confirmation")
    except ValueError:
        pass
    assert today_local() is not None and uuid.uuid4()
