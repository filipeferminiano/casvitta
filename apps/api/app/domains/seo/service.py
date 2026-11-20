"""Notifies search engines when public pages change (IndexNow).

Callers pass absolute URLs of pages that were published, changed or unpublished (a removed page is
submitted too, so engines recrawl it and drop it). Only https URLs on the root domain or one of its
subdomains are sent; IndexNow takes one request per host.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, field
from urllib.parse import urlsplit

from app.integrations.search_index.port import SearchIndexPort


@dataclass(frozen=True, slots=True)
class SubmitResult:
    submitted: int
    skipped: list[str] = field(default_factory=list)


def group_by_host(urls: Iterable[str], root_domain: str) -> tuple[dict[str, list[str]], list[str]]:
    """Returns ({host: urls}, skipped), deduplicated, keeping the input order."""
    root = root_domain.lower()
    groups: dict[str, list[str]] = {}
    skipped: list[str] = []
    seen: set[str] = set()
    for url in urls:
        if url in seen:
            continue
        seen.add(url)
        parts = urlsplit(url)
        host = (parts.hostname or "").lower()
        if parts.scheme != "https" or not (host == root or host.endswith(f".{root}")):
            skipped.append(url)
            continue
        groups.setdefault(host, []).append(url)
    return groups, skipped


async def submit_urls(
    index: SearchIndexPort, urls: Iterable[str], root_domain: str
) -> SubmitResult:
    groups, skipped = group_by_host(urls, root_domain)
    for host, host_urls in groups.items():
        await index.submit(host, host_urls)
    return SubmitResult(submitted=sum(len(u) for u in groups.values()), skipped=skipped)
