"""Search-engine index notifications (IndexNow: Bing, Yandex, Seznam, Naver and others)."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol


class SearchIndexPort(Protocol):
    async def submit(self, host: str, urls: Sequence[str]) -> None:
        """Tells search engines that ``urls`` (all on ``host``) were added, changed or removed."""
        ...
