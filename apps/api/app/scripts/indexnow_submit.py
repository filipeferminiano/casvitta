"""Submits every URL in a sitemap to IndexNow.

    INDEXNOW_ENABLED=true INDEXNOW_KEY=... python -m app.scripts.indexnow_submit \\
        https://casvitta.com.br/sitemap.xml [https://{broker}.casvitta.com.br/sitemap.xml ...]

Run after a deploy until listing publish/unpublish enqueues ``indexnow_submit`` (workers). Each
host must serve the key at /indexnow-key.txt first; the script checks that before submitting.
"""

from __future__ import annotations

import asyncio
import html
import re
import sys
from urllib.parse import urlsplit

import httpx

from app.core.settings import get_settings
from app.domains.seo.service import group_by_host, submit_urls
from app.integrations.registry import build_search_index
from app.integrations.search_index.indexnow import KEY_PATH

_LOC = re.compile(r"<loc>\s*(.*?)\s*</loc>", re.DOTALL)


def parse_sitemap(xml: str) -> list[str]:
    """URLs in a sitemap's <loc> elements (our own sitemap; no XML parser needed)."""
    return [html.unescape(loc) for loc in _LOC.findall(xml)]


async def main(sitemap_urls: list[str]) -> int:
    settings = get_settings()
    if not settings.indexnow_enabled or not settings.indexnow_key:
        print("Set INDEXNOW_ENABLED=true and INDEXNOW_KEY to submit.", file=sys.stderr)
        return 1
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        urls: list[str] = []
        for sitemap_url in sitemap_urls:
            response = await client.get(sitemap_url)
            response.raise_for_status()
            urls += parse_sitemap(response.text)
        groups, _ = group_by_host(urls, settings.indexnow_root_domain)
        for host in groups:
            key = await client.get(f"https://{host}{KEY_PATH}")
            if key.status_code != 200 or key.text.strip() != settings.indexnow_key:
                print(f"https://{host}{KEY_PATH} does not serve INDEXNOW_KEY.", file=sys.stderr)
                return 1
    result = await submit_urls(build_search_index(settings), urls, settings.indexnow_root_domain)
    hosts = ", ".join(groups) or "-"
    print(f"Submitted {result.submitted} URLs ({hosts}); skipped {len(result.skipped)}.")
    for url in result.skipped:
        print(f"  skipped {url} (not https on {settings.indexnow_root_domain})")
    return 0


if __name__ == "__main__":
    targets = sys.argv[1:] or ["https://casvitta.com.br/sitemap.xml"]
    if any(urlsplit(t).scheme not in ("http", "https") for t in targets):
        sys.exit("Usage: python -m app.scripts.indexnow_submit <sitemap-url> [...]")
    sys.exit(asyncio.run(main(targets)))
