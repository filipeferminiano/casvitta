"""Seleções and "Vi no Instagram" on the broker page (plans with page_collections).

Both only point at the broker's own properties. The public page shows an item only while its
property is live on the page (same gate as the page's property list: verified CRECI and a
staff-checked owner authorization), so a selection never brings back a property that left.
"""

from __future__ import annotations

import re
import uuid

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.catalog import Feature, has_feature
from app.core.errors import AppError
from app.domains.accounts.models import BrokerProfile, Workspace
from app.domains.pages.models import (
    BrokerPage,
    PageCollection,
    PageCollectionItem,
    PageInstagramPost,
)
from app.domains.pages.schemas import PublicCollectionOut, PublicInstagramPostOut
from app.domains.properties.models import Property

MAX_COLLECTIONS = 8
MAX_ITEMS = 30
MAX_POSTS = 12

_INSTAGRAM = re.compile(
    r"^https?://(?:www\.)?instagram\.com/(?:[\w.]+/)?(p|reel|reels|tv)/([\w-]{5,40})/?(?:[?#].*)?$",
    re.IGNORECASE,
)


def normalize_instagram_url(value: str) -> str:
    """Canonical post URL without tracking parameters; rejects anything that is not a post."""
    match = _INSTAGRAM.match(value.strip())
    if match is None:
        raise ValueError("instagram_url_invalid")
    kind = "reel" if match.group(1).lower() in {"reel", "reels"} else match.group(1).lower()
    return f"https://www.instagram.com/{kind}/{match.group(2)}/"


class CollectionIn(BaseModel):
    id: uuid.UUID | None = None
    title: str = Field(min_length=2, max_length=60)
    property_ids: list[uuid.UUID] = Field(default_factory=list, max_length=MAX_ITEMS)

    @field_validator("title")
    @classmethod
    def _title(cls, value: str) -> str:
        return " ".join(value.split())

    @field_validator("property_ids")
    @classmethod
    def _unique(cls, value: list[uuid.UUID]) -> list[uuid.UUID]:
        return list(dict.fromkeys(value))


class InstagramPostIn(BaseModel):
    id: uuid.UUID | None = None
    url: str = Field(max_length=300)
    label: str = Field(min_length=2, max_length=60)
    property_id: uuid.UUID

    @field_validator("url")
    @classmethod
    def _url(cls, value: str) -> str:
        return normalize_instagram_url(value)

    @field_validator("label")
    @classmethod
    def _label(cls, value: str) -> str:
        return " ".join(value.split())


class PageCollectionsIn(BaseModel):
    """The whole set, in display order (the editor saves everything at once)."""

    collections: list[CollectionIn] = Field(default_factory=list, max_length=MAX_COLLECTIONS)
    instagram: list[InstagramPostIn] = Field(default_factory=list, max_length=MAX_POSTS)


class CollectionOut(BaseModel):
    id: uuid.UUID
    title: str
    property_ids: list[uuid.UUID]


class InstagramPostOut(BaseModel):
    id: uuid.UUID
    url: str
    label: str
    property_id: uuid.UUID


class PageCollectionsOut(BaseModel):
    # False on plans without page_collections: the editor shows what the plan adds instead.
    available: bool
    collections: list[CollectionOut]
    instagram: list[InstagramPostOut]


async def _available(session: AsyncSession, page: BrokerPage) -> bool:
    workspace = await session.get(Workspace, page.workspace_id)
    return workspace is not None and has_feature(workspace.plan, Feature.PAGE_COLLECTIONS)


async def read(session: AsyncSession, page: BrokerPage) -> PageCollectionsOut:
    collections = (
        await session.scalars(
            select(PageCollection)
            .where(PageCollection.page_id == page.id)
            .order_by(PageCollection.position)
        )
    ).all()
    items: dict[uuid.UUID, list[uuid.UUID]] = {c.id: [] for c in collections}
    if collections:
        for item in await session.scalars(
            select(PageCollectionItem)
            .where(PageCollectionItem.collection_id.in_(items))
            .order_by(PageCollectionItem.position)
        ):
            items[item.collection_id].append(item.property_id)
    posts = (
        await session.scalars(
            select(PageInstagramPost)
            .where(PageInstagramPost.page_id == page.id)
            .order_by(PageInstagramPost.position)
        )
    ).all()
    return PageCollectionsOut(
        available=await _available(session, page),
        collections=[
            CollectionOut(id=c.id, title=c.title, property_ids=items[c.id]) for c in collections
        ],
        instagram=[
            InstagramPostOut(id=p.id, url=p.url, label=p.label, property_id=p.property_id)
            for p in posts
        ],
    )


async def replace(
    session: AsyncSession, page: BrokerPage, profile: BrokerProfile, data: PageCollectionsIn
) -> PageCollectionsOut:
    if not await _available(session, page):
        raise AppError("feature_not_in_plan", status_code=403)
    wanted = {pid for c in data.collections for pid in c.property_ids} | {
        p.property_id for p in data.instagram
    }
    if wanted:
        # Tenant-scoped session: only this workspace's properties, and only this broker's.
        mine = set(
            (
                await session.scalars(
                    select(Property.id).where(
                        Property.id.in_(wanted), Property.responsible_broker_id == profile.id
                    )
                )
            ).all()
        )
        if wanted - mine:
            raise AppError("property_not_found", status_code=404)
    await session.execute(delete(PageCollection).where(PageCollection.page_id == page.id))
    await session.execute(delete(PageInstagramPost).where(PageInstagramPost.page_id == page.id))
    for position, c in enumerate(data.collections):
        collection = PageCollection(page_id=page.id, title=c.title, position=position)
        session.add(collection)
        await session.flush()
        session.add_all(
            PageCollectionItem(collection_id=collection.id, property_id=pid, position=i)
            for i, pid in enumerate(c.property_ids)
        )
    session.add_all(
        PageInstagramPost(
            page_id=page.id, url=p.url, label=p.label, property_id=p.property_id, position=i
        )
        for i, p in enumerate(data.instagram)
    )
    await session.flush()
    return await read(session, page)


async def public(
    session: AsyncSession, page: BrokerPage, live: set[str]
) -> tuple[list[PublicCollectionOut], list[PublicInstagramPostOut]]:
    """For the public page (cross-tenant session); `live` = codes of the page's live properties."""
    if not live or not await _available(session, page):
        return [], []
    own = await read(session, page)
    referenced = {p for c in own.collections for p in c.property_ids} | {
        p.property_id for p in own.instagram
    }
    live_codes: dict[uuid.UUID, str] = {}
    if referenced:
        for prop in await session.scalars(select(Property).where(Property.id.in_(referenced))):
            if prop.code in live:
                live_codes[prop.id] = prop.code
    collections = [
        PublicCollectionOut(
            title=c.title, codes=[live_codes[p] for p in c.property_ids if p in live_codes]
        )
        for c in own.collections
    ]
    posts = [
        PublicInstagramPostOut(url=p.url, label=p.label, code=live_codes[p.property_id])
        for p in own.instagram
        if p.property_id in live_codes
    ]
    return [c for c in collections if c.codes], posts
