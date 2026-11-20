from __future__ import annotations

from collections.abc import Sequence


class FakeSearchIndex:
    """Records submissions instead of calling IndexNow."""

    def __init__(self) -> None:
        self.submissions: list[tuple[str, list[str]]] = []

    async def submit(self, host: str, urls: Sequence[str]) -> None:
        self.submissions.append((host, list(urls)))
