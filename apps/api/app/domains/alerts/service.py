"""Stores property alerts from the price pages. No outbound message in this milestone."""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from urllib.parse import urlsplit

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.logging import get_logger
from app.core.rate_limit import RateLimited, RateLimiter
from app.core.time import utcnow
from app.domains.alerts.models import AlertScope, PropertyAlert, PropertyAlertConsent
from app.domains.alerts.schemas import PropertyAlertIn, PropertyAlertOut
from app.domains.interest.models import ConsentPurpose
from app.domains.interest.service import ConsentRequired
from app.domains.market_data.models import (
    MarketBuilding,
    MarketCity,
    MarketNeighborhood,
    MarketStreet,
)
from app.domains.market_data.service import building_path, neighborhood_path, street_path

log = get_logger(__name__)


class UnknownPlace(AppError):
    def __init__(self) -> None:
        super().__init__("not_found", status_code=404)


async def _resolve(session: AsyncSession, payload: PropertyAlertIn) -> tuple[uuid.UUID, uuid.UUID]:
    """(city id, scope id) from the page's slugs."""
    if payload.scope is AlertScope.CITY:
        city = await session.scalar(select(MarketCity.id).where(MarketCity.slug == payload.city))
        if city is None:
            raise UnknownPlace
        return city, city
    row = (
        await session.execute(
            select(MarketCity.id, MarketNeighborhood.id)
            .join(MarketNeighborhood, MarketNeighborhood.city_id == MarketCity.id)
            .where(MarketCity.slug == payload.city, MarketNeighborhood.slug == payload.neighborhood)
        )
    ).first()
    if row is None:
        raise UnknownPlace
    city_id, neighborhood_id = row
    if payload.scope is AlertScope.NEIGHBORHOOD:
        return city_id, neighborhood_id
    if payload.scope in (AlertScope.STREET, AlertScope.STREET_SEGMENT):
        found = await session.scalar(
            select(MarketStreet.id).where(
                MarketStreet.neighborhood_id == neighborhood_id, MarketStreet.slug == payload.street
            )
        )
    else:
        found = await session.scalar(
            select(MarketBuilding.id).where(
                MarketBuilding.neighborhood_id == neighborhood_id,
                MarketBuilding.slug == payload.building,
            )
        )
    if found is None:
        raise UnknownPlace
    return city_id, found


async def create_alert(
    session: AsyncSession,
    payload: PropertyAlertIn,
    *,
    limiter: RateLimiter,
    client_key: str,
    limit_per_minute: int,
) -> PropertyAlert | None:
    """Stored alert, or None when the honeypot was filled (answered like a success)."""
    if not limiter.hit(f"alert:{client_key}", limit_per_minute, 60):
        raise RateLimited
    if payload.website:
        log.info("alert_honeypot", scope=payload.scope)
        return None
    if not payload.consents.contact_about_properties:
        raise ConsentRequired
    city_id, scope_id = await _resolve(session, payload)
    now = utcnow()
    source = payload.source_page or "price_page"
    alert = PropertyAlert(
        city_id=city_id,
        scope=payload.scope,
        scope_id=scope_id,
        intent=payload.intent,
        name=payload.name,
        phone_e164=payload.phone,
        email=payload.email,
        source_page=payload.source_page,
        source_path=urlsplit(payload.source_page).path[:300] if payload.source_page else None,
        valuation_snapshot=payload.valuation_snapshot,
        utm_source=payload.utm.source,
        utm_medium=payload.utm.medium,
        utm_campaign=payload.utm.campaign,
        consents=[
            PropertyAlertConsent(
                purpose=ConsentPurpose.CONTACT_ABOUT_PROPERTIES,
                granted=True,
                granted_at=now,
                source=source,
            ),
            PropertyAlertConsent(
                purpose=ConsentPurpose.MARKETING,
                granted=payload.consents.marketing,
                granted_at=now,
                source=source,
            ),
        ],
    )
    session.add(alert)
    await session.flush()
    return alert


async def list_alerts(session: AsyncSession) -> list[PropertyAlertOut]:
    alerts = (
        await session.scalars(select(PropertyAlert).order_by(PropertyAlert.created_at.desc()))
    ).all()
    return [await _out(session, alert) for alert in alerts]


async def delete_alert(session: AsyncSession, alert_id: uuid.UUID) -> bool:
    """LGPD deletion on request (staff)."""
    alert = await session.get(PropertyAlert, alert_id)
    if alert is None:
        return False
    await session.delete(alert)
    await session.flush()
    return True


async def _out(session: AsyncSession, alert: PropertyAlert) -> PropertyAlertOut:
    name, path = await _scope_label(session, alert.scope, alert.scope_id)
    consents = {c.purpose: c.granted for c in alert.consents}
    return PropertyAlertOut(
        id=alert.id,
        scope=alert.scope,
        scope_name=name,
        scope_path=path,
        intent=alert.intent,
        name=alert.name,
        phone_e164=alert.phone_e164,
        email=alert.email,
        status=alert.status,
        source_path=alert.source_path,
        has_valuation=alert.valuation_snapshot is not None,
        contact_consent=consents.get(ConsentPurpose.CONTACT_ABOUT_PROPERTIES, False),
        marketing_consent=consents.get(ConsentPurpose.MARKETING, False),
        source_page=alert.source_page,
        created_at=alert.created_at,
    )


async def _scope_label(
    session: AsyncSession, scope: AlertScope, scope_id: uuid.UUID
) -> tuple[str, str]:
    if scope is AlertScope.CITY:
        city = await session.get(MarketCity, scope_id)
        return (city.name, f"/preco-m2/{city.slug}") if city else ("—", "")
    if scope is AlertScope.NEIGHBORHOOD:
        neighborhood = await session.get(MarketNeighborhood, scope_id)
        street: MarketStreet | None = None
    elif scope in (AlertScope.STREET, AlertScope.STREET_SEGMENT):
        street = await session.get(MarketStreet, scope_id)
        neighborhood = (
            await session.get(MarketNeighborhood, street.neighborhood_id) if street else None
        )
    else:
        building = await session.get(MarketBuilding, scope_id)
        if building is None:
            return "—", ""
        neighborhood = await session.get(MarketNeighborhood, building.neighborhood_id)
        city = await session.get(MarketCity, building.city_id)
        if neighborhood is None or city is None:
            return building.name, ""
        return building.name, building_path(city.slug, neighborhood.slug, building.slug)
    if neighborhood is None:
        return "—", ""
    city = await session.get(MarketCity, neighborhood.city_id)
    city_slug = city.slug if city else ""
    if street is not None:
        return (
            f"{street.name}, {neighborhood.name}",
            street_path(city_slug, neighborhood.slug, street.slug),
        )
    return neighborhood.name, neighborhood_path(city_slug, neighborhood.slug)


def to_csv(rows: Sequence[PropertyAlertOut]) -> str:
    import csv  # noqa: PLC0415 - only for the admin export
    import io  # noqa: PLC0415

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    fields = list(PropertyAlertOut.model_fields)
    writer.writerow(fields)
    for row in rows:
        data = row.model_dump(mode="json")
        writer.writerow([data[f] for f in fields])
    return buffer.getvalue()
