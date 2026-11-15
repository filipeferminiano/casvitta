"""arq worker entry point: arq app.workers.settings.WorkerSettings

Jobs (AI generation, WhatsApp sends, ad sync, weekly reports) are registered in ``functions``
as they are built.
"""

from __future__ import annotations

from typing import Any, ClassVar

from arq.connections import RedisSettings

from app.core.logging import configure_logging, get_logger
from app.core.settings import get_settings

log = get_logger(__name__)


async def ping(_ctx: dict[str, Any]) -> str:
    return "pong"


async def startup(_ctx: dict[str, Any]) -> None:
    settings = get_settings()
    configure_logging(settings.log_level, settings.log_json)
    log.info("worker_started")


class WorkerSettings:
    functions: ClassVar[list[Any]] = [ping]
    on_startup = startup
    redis_settings = RedisSettings.from_dsn(get_settings().redis_url)
