"""IndexNow adapter (https://www.indexnow.org/documentation).

The key is served by the web app at https://{host}/indexnow-key.txt on every host, so one key
covers the marketplace and every broker subdomain.
"""

from __future__ import annotations

from collections.abc import Sequence

import httpx

from app.core.logging import get_logger
from app.integrations.base import IntegrationError

log = get_logger(__name__)

ENDPOINT = "https://api.indexnow.org/indexnow"
KEY_PATH = "/indexnow-key.txt"
MAX_URLS_PER_REQUEST = 10_000


class IndexNow:
    def __init__(
        self,
        key: str,
        endpoint: str = ENDPOINT,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._key = key
        self._endpoint = endpoint
        self._transport = transport

    async def submit(self, host: str, urls: Sequence[str]) -> None:
        async with httpx.AsyncClient(transport=self._transport, timeout=15) as client:
            for start in range(0, len(urls), MAX_URLS_PER_REQUEST):
                batch = list(urls[start : start + MAX_URLS_PER_REQUEST])
                response = await client.post(
                    self._endpoint,
                    json={
                        "host": host,
                        "key": self._key,
                        "keyLocation": f"https://{host}{KEY_PATH}",
                        "urlList": batch,
                    },
                )
                # 200 = accepted, 202 = accepted while the key is being validated.
                if response.status_code not in (200, 202):
                    raise IntegrationError(
                        "de indexação", f"IndexNow {response.status_code}: {response.text[:200]}"
                    )
                log.info("indexnow_submitted", host=host, urls=len(batch))
