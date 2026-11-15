from __future__ import annotations

import uuid
from datetime import datetime

from app.core.time import utcnow
from app.integrations.social.port import InboundComment, PublishedPost, SocialPost


class FakeSocialPages:
    def __init__(self) -> None:
        self.published: list[tuple[str, SocialPost, PublishedPost]] = []
        self.comments: list[InboundComment] = []

    async def publish(self, account_external_id: str, post: SocialPost) -> PublishedPost:
        external_id = f"{post.channel.value}-fake-{uuid.uuid4().hex[:12]}"
        result = PublishedPost(external_id, f"https://example.invalid/{external_id}", utcnow())
        self.published.append((account_external_id, post, result))
        return result

    async def list_comments(
        self, account_external_id: str, since: datetime
    ) -> list[InboundComment]:
        return [c for c in self.comments if c.created_at >= since]
