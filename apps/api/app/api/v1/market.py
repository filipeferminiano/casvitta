"""Public price pages (ITBI). Read-only, no auth; every number is gated and rounded upstream."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import client_key, get_rate_limiter, get_settings_dep
from app.core.db import get_session
from app.core.errors import AppError
from app.core.rate_limit import RateLimited, RateLimiter
from app.core.settings import Settings
from app.domains.market_data import service, tools
from app.domains.market_data.gates import Gates
from app.domains.market_data.schemas import (
    BuildingPage,
    CityIndexPage,
    FinancingPage,
    NeighborhoodPage,
    Redirect,
    Sitemap,
    StreetPage,
)

router = APIRouter(prefix="/public/market", tags=["market"])

Session = Annotated[AsyncSession, Depends(get_session)]
AppSettings = Annotated[Settings, Depends(get_settings_dep)]


def _not_found() -> AppError:
    return AppError("not_found", status_code=404)


@router.get("/{city}", response_model=CityIndexPage, operation_id="getMarketCity")
async def get_city(city: str, session: Session, settings: AppSettings) -> CityIndexPage:
    result = await service.city_index(session, city, Gates.from_settings(settings))
    if result is None:
        raise _not_found()
    return result


@router.get(
    "/{city}/neighborhoods/{neighborhood}",
    response_model=NeighborhoodPage | Redirect,
    operation_id="getMarketNeighborhood",
)
async def get_neighborhood(
    city: str, neighborhood: str, session: Session, settings: AppSettings
) -> NeighborhoodPage | Redirect:
    gates = Gates.from_settings(settings)
    result = await service.neighborhood_page(session, city, neighborhood, gates)
    if result is None:
        raise _not_found()
    return result


@router.get(
    "/{city}/neighborhoods/{neighborhood}/streets/{street}",
    response_model=StreetPage | Redirect,
    operation_id="getMarketStreet",
)
async def get_street(
    city: str, neighborhood: str, street: str, session: Session, settings: AppSettings
) -> StreetPage | Redirect:
    gates = Gates.from_settings(settings)
    result = await service.street_page(session, city, neighborhood, street, gates)
    if result is None:
        raise _not_found()
    return result


@router.get(
    "/{city}/neighborhoods/{neighborhood}/buildings/{building}",
    response_model=BuildingPage | Redirect,
    operation_id="getMarketBuilding",
)
async def get_building(
    city: str, neighborhood: str, building: str, session: Session, settings: AppSettings
) -> BuildingPage | Redirect:
    gates = Gates.from_settings(settings)
    result = await service.building_page(session, city, neighborhood, building, gates)
    if result is None:
        raise _not_found()
    return result


@router.get(
    "/{city}/neighborhoods/{neighborhood}/financing",
    response_model=FinancingPage | Redirect,
    operation_id="getMarketFinancing",
)
async def get_financing(
    city: str, neighborhood: str, session: Session, settings: AppSettings
) -> FinancingPage | Redirect:
    gates = Gates.from_settings(settings)
    result = await service.financing_page(session, city, neighborhood, gates, settings)
    if result is None:
        raise _not_found()
    return result


@router.get("/{city}/sitemaps/{template}", response_model=Sitemap, operation_id="getMarketSitemap")
async def get_sitemap(city: str, template: str, session: Session, settings: AppSettings) -> Sitemap:
    result = await service.sitemap(
        session,
        city,
        template,
        Gates.from_settings(settings),
        itbi_reviewed=settings.itbi_sp_rules_reviewed,
    )
    if result is None:
        raise _not_found()
    return result


Limiter = Annotated[RateLimiter, Depends(get_rate_limiter)]


def _limit(limiter: RateLimiter, request: Request, name: str, settings: Settings) -> None:
    if not limiter.hit(
        f"{name}:{client_key(request)}", settings.valuation_rate_limit_per_minute, 60
    ):
        raise RateLimited


@router.get(
    "/{city}/addresses",
    response_model=tools.AddressSuggestions,
    operation_id="getMarketAddresses",
)
async def get_addresses(  # noqa: PLR0917 - FastAPI dependencies
    city: str,
    request: Request,
    session: Session,
    settings: AppSettings,
    limiter: Limiter,
    q: Annotated[str, Query(min_length=2, max_length=120)],
) -> tools.AddressSuggestions:
    """Up to 3 street (+ number) suggestions for the valuation form. Rate-limited."""
    _limit(limiter, request, "addresses", settings)
    result = await tools.address_suggestions(session, city, q)
    if result is None:
        raise _not_found()
    return result


@router.post("/{city}/valuation", response_model=tools.ValuationOut, operation_id="postValuation")
async def post_valuation(  # noqa: PLR0917 - FastAPI dependencies
    city: str,
    payload: tools.ValuationIn,
    request: Request,
    session: Session,
    settings: AppSettings,
    limiter: Limiter,
) -> tools.ValuationOut:
    """Statistical estimate from real sales; never stored, never indexed. Rate-limited."""
    _limit(limiter, request, "valuation", settings)
    result = await tools.valuation(session, city, payload, settings)
    if result is None:
        raise _not_found()
    return result


@router.get("/{city}/itbi", response_model=tools.ItbiPage, operation_id="getMarketItbi")
async def get_itbi(city: str, session: Session, settings: AppSettings) -> tools.ItbiPage:
    result = await tools.itbi_page(session, city, Gates.from_settings(settings), settings)
    if result is None:
        raise _not_found()
    return result
