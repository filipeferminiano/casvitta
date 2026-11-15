"""Facebook Page and Instagram professional account publishing."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Protocol


class SocialChannel(StrEnum):
    FACEBOOK = "facebook"
    INSTAGRAM = "instagram"


class PostFormat(StrEnum):
    IMAGE = "image"
    CAROUSEL = "carousel"
    REELS = "reels"
    STORY = "story"


@dataclass(frozen=True, slots=True)
class SocialPost:
    channel: SocialChannel
    format: PostFormat
    caption: str
    media_urls: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class PublishedPost:
    external_id: str
    permalink: str
    published_at: datetime


@dataclass(frozen=True, slots=True)
class InboundComment:
    external_id: str
    post_external_id: str
    author_name: str
    text: str
    created_at: datetime


class SocialPagesPort(Protocol):
    async def publish(self, account_external_id: str, post: SocialPost) -> PublishedPost: ...

    async def list_comments(
        self, account_external_id: str, since: datetime
    ) -> list[InboundComment]: ...
