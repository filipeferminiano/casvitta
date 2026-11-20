"""Downloads the ITBI workbooks from configured URLs into a cache folder, then reads them locally.

Behind ITBI_HTTP_ENABLED; the monthly refresh uses it once the source URLs are configured.
"""

from __future__ import annotations

from collections.abc import Iterator, Sequence
from pathlib import Path
from urllib.parse import unquote, urlsplit

import httpx

from app.integrations.base import IntegrationError
from app.integrations.itbi.local import LocalFileItbiSource
from app.integrations.itbi.port import ItbiTab


class HttpItbiSource:
    def __init__(
        self,
        urls: Sequence[str],
        cache_dir: Path,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self.urls = list(urls)
        self.cache_dir = cache_dir
        self._transport = transport
        self._local = LocalFileItbiSource(cache_dir)

    def download(self) -> list[Path]:
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        paths: list[Path] = []
        with httpx.Client(transport=self._transport, timeout=120, follow_redirects=True) as client:
            for url in self.urls:
                name = Path(unquote(urlsplit(url).path)).name
                if not name.endswith(".xlsx"):
                    raise IntegrationError("da Prefeitura", f"not an .xlsx URL: {url}")
                response = client.get(url)
                if response.status_code != 200:
                    raise IntegrationError("da Prefeitura", f"{url}: HTTP {response.status_code}")
                path = self.cache_dir / name
                path.write_bytes(response.content)
                paths.append(path)
        return paths

    def tabs(self) -> Iterator[ItbiTab]:
        self.download()
        return self._local.tabs()

    def code_tables(self) -> tuple[dict[int, str], dict[int, str]]:
        return self._local.code_tables()
