"""Read side of the two tools: address suggestions + valuation, and the ITBI page data."""

from __future__ import annotations

import re
import unicodedata
import uuid
from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.itbi import ItbiRules, compute_itbi
from app.core.settings import Settings
from app.domains.market_data import service
from app.domains.market_data.gates import Gates
from app.domains.market_data.models import (
    ItbiTransaction,
    MarketBuilding,
    MarketCity,
    MarketNeighborhood,
    MarketStreet,
    PropertyKind,
)
from app.domains.market_data.schemas import PlaceRef, SourceInfo
from app.domains.market_data.stats import median, round_to
from app.domains.market_data.valuation import (
    Group,
    GroupLevel,
    ValuationRules,
    comparable_groups,
    estimate,
)

MAX_SUGGESTIONS = 3
SFH_CODE = 1  # "1.Sistema Financeiro de Habitação" in the ITBI files


# --- addresses ---------------------------------------------------------------------------------


class AddressSuggestion(BaseModel):
    id: str  # "{neighborhood}/{street}[/{number}]"
    label: str  # "Rua Joaquim Távora, 1.240"
    detail: str  # neighborhood name
    neighborhood: str
    street: str
    number: int | None


class AddressSuggestions(BaseModel):
    suggestions: list[AddressSuggestion]


def _thousands(number: int) -> str:
    """1240 -> "1.240" (pt-BR)."""
    return f"{number:,}".replace(",", ".")


def _fold(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", text).strip()


async def address_suggestions(
    session: AsyncSession, city_slug: str, query: str
) -> AddressSuggestions | None:
    """Streets (and building numbers) we have sales for. No register yet: coverage is partial."""
    city = await session.scalar(select(MarketCity).where(MarketCity.slug == city_slug))
    if city is None:
        return None
    match = re.match(r"^(.*?)[,\s]+(\d{1,5})\s*$", query.strip())
    text, number = (match.group(1), int(match.group(2))) if match else (query, None)
    words = [
        w for w in _fold(text).split() if len(w) >= 2 and w not in {"rua", "r", "av", "avenida"}
    ]
    if not words:
        return AddressSuggestions(suggestions=[])
    stmt = (
        select(MarketStreet, MarketNeighborhood)
        .join(MarketNeighborhood, MarketNeighborhood.id == MarketStreet.neighborhood_id)
        .where(MarketStreet.city_id == city.id)
    )
    for word in words:
        stmt = stmt.where(func.lower(MarketStreet.slug).contains(word))
    rows = (await session.execute(stmt.order_by(MarketStreet.name).limit(20))).all()
    suggestions: list[AddressSuggestion] = []
    for street, neighborhood in rows:
        if number is not None:
            has_building = await session.scalar(
                select(MarketBuilding.id).where(
                    MarketBuilding.street_id == street.id, MarketBuilding.street_number == number
                )
            )
            if has_building is None and len(rows) > 1:
                continue
        suggestions.append(
            AddressSuggestion(
                id=f"{neighborhood.slug}/{street.slug}" + (f"/{number}" if number else ""),
                label=f"{street.name}, {_thousands(number)}" if number else street.name,
                detail=neighborhood.name,
                neighborhood=neighborhood.slug,
                street=street.slug,
                number=number,
            )
        )
        if len(suggestions) >= MAX_SUGGESTIONS:
            break
    return AddressSuggestions(suggestions=suggestions)


# --- valuation ---------------------------------------------------------------------------------


class ValuationIn(BaseModel):
    neighborhood: str = Field(min_length=2, max_length=80)
    street: str | None = Field(default=None, max_length=140)
    number: int | None = Field(default=None, ge=1, le=99_999)
    kind: Literal["apartment", "house"]
    area_m2: Decimal = Field(gt=10, le=2_000)  # IPTU built area (on the carnê)
    year: int | None = Field(default=None, ge=1850, le=2100)
    bedrooms: int | None = Field(default=None, ge=0, le=20)  # not used in the math
    parking: int | None = Field(default=None, ge=0, le=20)  # not used in the math


class ComparableGroupOut(BaseModel):
    level: GroupLevel
    label: str
    sales: int
    median_price_m2_cents: int | None  # None: fewer than 10 sales, count only


class ValuationOut(BaseModel):
    status: Literal["ok", "outside_coverage"]
    neighborhood: PlaceRef | None = None
    street_name: str | None = None
    center_cents: int | None = None
    low_cents: int | None = None
    high_cents: int | None = None
    price_m2_cents: int | None = None
    confidence: Literal["alta", "media", "baixa"] | None = None
    comparables: int | None = None
    basis: GroupLevel | None = None
    groups: list[ComparableGroupOut] = []
    window_end: date | None = None
    source: SourceInfo | None = None


async def valuation(
    session: AsyncSession, city_slug: str, payload: ValuationIn, settings: Settings
) -> ValuationOut | None:
    city = await session.scalar(select(MarketCity).where(MarketCity.slug == city_slug))
    if city is None:
        return None
    source = await service.source_info(session, city)
    neighborhood = await session.scalar(
        select(MarketNeighborhood).where(
            MarketNeighborhood.city_id == city.id, MarketNeighborhood.slug == payload.neighborhood
        )
    )
    if neighborhood is None or source.window_end is None:
        return ValuationOut(status="outside_coverage", source=source)
    street_id: uuid.UUID | None = None
    street_name: str | None = None
    if payload.street:
        street = await session.scalar(
            select(MarketStreet).where(
                MarketStreet.neighborhood_id == neighborhood.id, MarketStreet.slug == payload.street
            )
        )
        if street:
            street_id, street_name = street.id, street.name
    rules = ValuationRules.from_settings(settings)
    groups = await comparable_groups(
        session,
        neighborhood_id=neighborhood.id,
        street_id=street_id,
        kind=PropertyKind(payload.kind),
        area_m2=payload.area_m2,
        year=payload.year,
        window_end=source.window_end,
        rules=rules,
    )
    result = estimate(groups, payload.area_m2, rules)
    ref = service._neighborhood_ref(city.slug, neighborhood)
    if result is None:
        return ValuationOut(
            status="outside_coverage",
            neighborhood=ref,
            street_name=street_name,
            groups=[_group_out(g) for g in groups],
            window_end=source.window_end,
            source=source,
        )
    return ValuationOut(
        status="ok",
        neighborhood=ref,
        street_name=street_name,
        center_cents=result.center_cents,
        low_cents=result.low_cents,
        high_cents=result.high_cents,
        price_m2_cents=result.price_m2_cents,
        confidence=result.confidence,
        comparables=result.comparables,
        basis=result.basis,
        groups=[_group_out(g) for g in result.groups],
        window_end=source.window_end,
        source=source,
    )


def _group_out(group: Group) -> ComparableGroupOut:
    return ComparableGroupOut(
        level=group.level,
        label=group.label,
        sales=group.sales,
        median_price_m2_cents=round_to(group.median_price_m2_cents, 1_000)
        if group.median_price_m2_cents is not None
        else None,
    )


# --- ITBI ----------------------------------------------------------------------------------


class ItbiRulesOut(BaseModel):
    rate_bps: int
    sfh_rate_bps: int
    sfh_limit_cents: int | None
    effective_from: str
    reviewed: bool  # false: the page is noindex and shows "texto a revisar"
    registry_low_cents: int | None
    registry_high_cents: int | None


class ItbiNeighborhoodRow(BaseModel):
    place: PlaceRef
    sales: int
    median_value_cents: int | None
    median_itbi_cents: int | None  # "ITBI mediano estimado", from each sale's tax base


class ItbiPage(BaseModel):
    city: PlaceRef
    source: SourceInfo
    rules: ItbiRulesOut
    city_row: ItbiNeighborhoodRow | None
    neighborhoods: list[ItbiNeighborhoodRow]


async def itbi_page(
    session: AsyncSession, city_slug: str, gates: Gates, settings: Settings
) -> ItbiPage | None:
    city = await session.scalar(select(MarketCity).where(MarketCity.slug == city_slug))
    if city is None:
        return None
    source = await service.source_info(session, city)
    rules = ItbiRules.sao_paulo(settings)
    rows_out: list[ItbiNeighborhoodRow] = []
    city_values: list[int] = []
    city_taxes: list[int] = []
    if source.window_end is not None:
        start = date(source.window_end.year - 1, source.window_end.month, 1)
        neighborhoods = (
            await session.scalars(
                select(MarketNeighborhood)
                .where(MarketNeighborhood.city_id == city.id, MarketNeighborhood.is_indexable)
                .order_by(MarketNeighborhood.name)
            )
        ).all()
        by_id = {n.id: n for n in neighborhoods}
        sales: dict[uuid.UUID, tuple[list[int], list[int]]] = {
            n.id: ([], []) for n in neighborhoods
        }
        result = await session.execute(
            select(
                ItbiTransaction.neighborhood_id,
                ItbiTransaction.value_cents,
                ItbiTransaction.tax_base_cents,
                ItbiTransaction.financing_type_code,
                ItbiTransaction.financed_value_cents,
            ).where(
                ItbiTransaction.city_id == city.id,
                ItbiTransaction.transaction_date > start,
                ItbiTransaction.transaction_date <= source.window_end,
                ItbiTransaction.under_declared.is_(False),
                ItbiTransaction.price_outlier.is_(False),
            )
        )
        for nid, value, base, financing, financed in result:
            # The source has a few negative amounts (data-entry errors): read them as not reported.
            tax = compute_itbi(
                rules,
                price_cents=value,
                venal_cents=base if base and base > 0 else None,
                financed_cents=financed if financed and financed > 0 else None,
                sfh=financing == SFH_CODE,
            ).total_cents
            city_values.append(value)
            city_taxes.append(tax)
            if nid in sales:
                sales[nid][0].append(value)
                sales[nid][1].append(tax)
        for nid, (values, taxes) in sales.items():
            n = by_id[nid]
            priced = gates.priced(len(values))
            rows_out.append(
                ItbiNeighborhoodRow(
                    place=service._neighborhood_ref(city.slug, n),
                    sales=len(values),
                    median_value_cents=gates.value(median(values)) if priced else None,
                    median_itbi_cents=round_to(median(taxes), 10_000) if priced else None,
                )
            )
    city_row = (
        ItbiNeighborhoodRow(
            place=PlaceRef(slug=city.slug, name=city.name, path=service.city_path(city.slug)),
            sales=len(city_values),
            median_value_cents=gates.value(median(city_values)),
            median_itbi_cents=round_to(median(city_taxes), 10_000),
        )
        if gates.priced(len(city_values))
        else None
    )
    return ItbiPage(
        city=PlaceRef(slug=city.slug, name=city.name, path=f"/itbi/{city.slug}"),
        source=source,
        rules=ItbiRulesOut(
            rate_bps=rules.rate_bps,
            sfh_rate_bps=rules.sfh_rate_bps,
            sfh_limit_cents=rules.sfh_limit_cents,
            effective_from=rules.effective_from,
            reviewed=rules.reviewed,
            registry_low_cents=settings.itbi_sp_registry_low_cents,
            registry_high_cents=settings.itbi_sp_registry_high_cents,
        ),
        city_row=city_row,
        neighborhoods=rows_out,
    )
