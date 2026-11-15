"""Rate limiting port. In-memory fixed window for now; a Redis adapter comes with the arq work.

The in-memory adapter is per process: fine for one instance and for tests, not for a fleet.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from typing import Protocol

from app.core.errors import AppError


class RateLimited(AppError):
    def __init__(self) -> None:
        super().__init__("rate_limited", status_code=429)


class RateLimiter(Protocol):
    def hit(self, key: str, limit: int, window_seconds: int) -> bool:
        """Count one request for `key`; False when the limit for the current window is exceeded."""
        ...


class InMemoryRateLimiter:
    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._windows: dict[str, tuple[int, int]] = {}

    def hit(self, key: str, limit: int, window_seconds: int) -> bool:
        window = int(self._clock() // window_seconds)
        current_window, count = self._windows.get(key, (window, 0))
        if current_window != window:
            count = 0
        count += 1
        self._windows[key] = (window, count)
        return count <= limit

    def reset(self) -> None:
        self._windows.clear()
