"""arq worker entry point: arq app.workers.settings.WorkerSettings

Jobs (AI generation, WhatsApp sends, ad sync, weekly reports) are registered in ``functions``
as they are built.

``indexnow_submit``: enqueue it with the absolute URLs of pages that were published, changed or
unpublished (listing pages on the marketplace and on the broker's landing host).
"""

from __future__ import annotations

from typing import Any, ClassVar

from arq.connections import RedisSettings

from app.core.logging import configure_logging, get_logger
from app.core.settings import get_settings
from app.domains.seo.service import submit_urls
from app.integrations.registry import Integrations, build_integrations

log = get_logger(__name__)


async def ping(_ctx: dict[str, Any]) -> str:
    return "pong"


async def indexnow_submit(ctx: dict[str, Any], urls: list[str]) -> int:
    integrations: Integrations = ctx["integrations"]
    result = await submit_urls(integrations.search_index, urls, get_settings().indexnow_root_domain)
    if result.skipped:
        log.warning("indexnow_skipped_urls", urls=result.skipped)
    return result.submitted


async def itbi_refresh(ctx: dict[str, Any], city: str = "sao-paulo") -> dict[str, Any]:
    """Monthly ITBI refresh: download (ITBI_HTTP_ENABLED) or read the folder, rebuild, notify."""
    from app.core.db import get_sessionmaker  # noqa: PLC0415 - worker-only imports
    from app.workers.itbi import refresh_city, source_for  # noqa: PLC0415

    settings = get_settings()
    integrations: Integrations = ctx["integrations"]
    async with get_sessionmaker()() as session:
        result = await refresh_city(
            session,
            city,
            source_for(settings, city),
            settings.itbi_persist_raw,
            settings,
            integrations.search_index,
        )
    return {k: v for k, v in result.report.items() if k != "excluded_by_tab"}


async def startup(ctx: dict[str, Any]) -> None:
    settings = get_settings()
    configure_logging(settings.log_level, settings.log_json)
    ctx["integrations"] = build_integrations(settings)
    log.info("worker_started")


class WorkerSettings:
    functions: ClassVar[list[Any]] = [ping, indexnow_submit, itbi_refresh]
    on_startup = startup
    redis_settings = RedisSettings.from_dsn(get_settings().redis_url)
