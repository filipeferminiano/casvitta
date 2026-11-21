"""Imóveis (broker app) and the public listings read model. Thin: logic lives in the service."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_claims, get_settings_dep, get_tenant_session
from app.core.db import get_session
from app.core.errors import AppError
from app.core.security import AccessClaims
from app.core.settings import Settings
from app.domains.listings.models import Channel
from app.domains.properties import service
from app.domains.properties.models import (
    AuthorizationEvidence,
    MediaKind,
    PropertyMedia,
    Transaction,
)
from app.domains.properties.schemas import (
    AuthorizationIn,
    PropertyIn,
    PropertyOut,
    PropertyPatch,
    PublicListingOut,
)
from app.integrations.registry import Integrations, get_integrations

router = APIRouter(prefix="/properties", tags=["properties"])
public_router = APIRouter(prefix="/public", tags=["public"])

ClaimsDep = Annotated[AccessClaims, Depends(get_claims)]
TenantSession = Annotated[AsyncSession, Depends(get_tenant_session)]
IntegrationsDep = Annotated[Integrations, Depends(get_integrations)]

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
IMAGE_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
DOCUMENT_TYPES = {**IMAGE_TYPES, "application/pdf": "pdf"}


async def _read_upload(upload: UploadFile, allowed: dict[str, str]) -> tuple[bytes, str]:
    content_type = upload.content_type or ""
    if content_type not in allowed:
        raise AppError("upload_type_not_allowed", status_code=415)
    data = await upload.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise AppError("upload_too_large", status_code=413)
    return data, allowed[content_type]


@router.get("", response_model=list[PropertyOut], operation_id="listProperties")
async def list_properties(session: TenantSession) -> list[PropertyOut]:
    return [await service.to_out(session, p) for p in await service.list_properties(session)]


@router.post(
    "",
    response_model=PropertyOut,
    status_code=status.HTTP_201_CREATED,
    operation_id="createProperty",
)
async def create_property(data: PropertyIn, session: TenantSession) -> PropertyOut:
    prop = await service.create_property(session, data)
    out = await service.to_out(session, prop)
    await session.commit()
    return out


@router.get("/{property_id}", response_model=PropertyOut, operation_id="getProperty")
async def get_property(property_id: uuid.UUID, session: TenantSession) -> PropertyOut:
    return await service.to_out(session, await service.get_property(session, property_id))


@router.patch("/{property_id}", response_model=PropertyOut, operation_id="updateProperty")
async def update_property(
    property_id: uuid.UUID, patch: PropertyPatch, session: TenantSession
) -> PropertyOut:
    prop = await service.update_property(session, property_id, patch)
    out = await service.to_out(session, prop)
    await session.commit()
    return out


@router.post(
    "/{property_id}/authorizations",
    response_model=PropertyOut,
    status_code=status.HTTP_201_CREATED,
    operation_id="addOwnerAuthorization",
)
async def add_authorization(
    property_id: uuid.UUID,
    *,
    claims: ClaimsDep,
    session: TenantSession,
    integrations: IntegrationsDep,
    data: Annotated[str, Form(description="AuthorizationIn as JSON")],
    document: Annotated[UploadFile | None, File()] = None,
) -> PropertyOut:
    payload = AuthorizationIn.model_validate_json(data)
    key: str | None = None
    if payload.evidence == AuthorizationEvidence.DOCUMENT and document is not None:
        content, ext = await _read_upload(document, DOCUMENT_TYPES)
        key = f"authorizations/{claims.workspace_id}/{property_id}/{uuid.uuid4()}.{ext}"
        await integrations.storage.put(key, content, document.content_type or "")
    await service.add_authorization(session, property_id, payload, claims.user_id, key)
    out = await service.to_out(session, await service.get_property(session, property_id))
    await session.commit()
    return out


@router.post(
    "/{property_id}/photos",
    response_model=PropertyOut,
    status_code=status.HTTP_201_CREATED,
    operation_id="addPropertyPhoto",
)
async def add_photo(
    property_id: uuid.UUID,
    *,
    claims: ClaimsDep,
    session: TenantSession,
    integrations: IntegrationsDep,
    photo: Annotated[UploadFile, File()],
) -> PropertyOut:
    prop = await service.get_property(session, property_id)
    content, ext = await _read_upload(photo, IMAGE_TYPES)
    key = f"properties/{claims.workspace_id}/{prop.id}/{uuid.uuid4()}.{ext}"
    stored = await integrations.storage.put(key, content, photo.content_type or "")
    existing = len((await service.to_out(session, prop)).media)
    session.add(
        PropertyMedia(
            property_id=prop.id,
            kind=MediaKind.PHOTO,
            storage_key=stored.key,
            url=stored.url,
            position=existing,
            is_cover=existing == 0,
        )
    )
    await session.flush()
    out = await service.to_out(session, prop)
    await session.commit()
    return out


@router.put(
    "/{property_id}/listings/{channel}", response_model=PropertyOut, operation_id="publishListing"
)
async def publish(property_id: uuid.UUID, channel: Channel, session: TenantSession) -> PropertyOut:
    await service.publish(session, property_id, channel)
    out = await service.to_out(session, await service.get_property(session, property_id))
    await session.commit()
    return out


@router.delete(
    "/{property_id}/listings/{channel}",
    response_model=PropertyOut,
    operation_id="unpublishListing",
)
async def unpublish(
    property_id: uuid.UUID, channel: Channel, session: TenantSession
) -> PropertyOut:
    await service.unpublish(session, property_id, channel)
    out = await service.to_out(session, await service.get_property(session, property_id))
    await session.commit()
    return out


@public_router.get(
    "/listings", response_model=list[PublicListingOut], operation_id="listPublicListings"
)
async def public_listings(
    *,
    session: Annotated[AsyncSession, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
    channel: Annotated[Channel, Query()] = Channel.MARKETPLACE,
    transaction: Annotated[Transaction | None, Query()] = None,
    city: Annotated[str | None, Query(max_length=120)] = None,
    neighborhood: Annotated[str | None, Query(max_length=120)] = None,
    street: Annotated[str | None, Query(max_length=160)] = None,
) -> list[PublicListingOut]:
    """Published listings that pass the gate now. Place filters are URL slugs."""
    if channel not in service.PUBLIC_CHANNELS:
        raise AppError("not_found", status_code=404)
    return await service.public_listings(
        session,
        channel,
        include_demo=settings.public_listings_include_demo,
        transaction=transaction,
        city=city,
        neighborhood=neighborhood,
        street=street,
    )
