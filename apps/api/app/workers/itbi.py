"""ITBI ingestion CLI.

    uv run python -m app.workers.itbi ingest --city sao-paulo --path data/raw/itbi/sao-paulo

Relative paths resolve from the current folder, then from the repository root. ``--no-raw``
skips the raw audit copy (use it against the shared production database).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_sessionmaker
from app.core.logging import configure_logging
from app.core.settings import REPO_ROOT, Settings, get_settings
from app.domains.market_data.models import MarketCity
from app.domains.market_data.pipeline import RunResult, run_ingestion
from app.domains.market_data.refresh import after_refresh, snapshot
from app.integrations.itbi.http import HttpItbiSource
from app.integrations.itbi.local import LocalFileItbiSource
from app.integrations.itbi.port import ItbiSource
from app.integrations.registry import build_integrations
from app.integrations.search_index.port import SearchIndexPort


def resolve_path(path: str) -> Path:
    candidate = Path(path)
    if candidate.is_absolute() or candidate.exists():
        return candidate
    return REPO_ROOT / candidate


async def refresh_city(  # noqa: PLR0917
    session: AsyncSession,
    city: str,
    source: ItbiSource,
    persist_raw: bool,
    settings: Settings,
    search_index: SearchIndexPort,
) -> RunResult:
    """Ingest, rebuild, then submit changed indexable pages and revalidate the web."""
    existing = await session.scalar(select(MarketCity).where(MarketCity.slug == city))
    before = await snapshot(session, existing.id) if existing else {}
    result = await run_ingestion(session, city, source, persist_raw=persist_raw)
    result.report |= await after_refresh(session, result.city, before, settings, search_index)
    return result


def source_for(settings: Settings, city: str, path: Path | None = None) -> ItbiSource:
    folder = path or resolve_path(f"{settings.itbi_data_dir}/{city}")
    if settings.itbi_http_enabled and path is None:
        return HttpItbiSource(settings.itbi_source_urls, folder)
    return LocalFileItbiSource(folder)


async def ingest(city: str, path: Path, persist_raw: bool) -> int:
    settings = get_settings()
    source = LocalFileItbiSource(path)
    if not source.files():
        print(f"No .xlsx files in {path}", file=sys.stderr)
        return 1
    search_index = build_integrations(settings).search_index
    async with get_sessionmaker()() as session:
        result = await refresh_city(session, city, source, persist_raw, settings, search_index)
    hidden = {"tabs", "excluded_by_tab", "review_top"}
    summary = {k: v for k, v in result.run.report.items() if k not in hidden} | {
        k: v for k, v in result.report.items() if k not in hidden | set(result.run.report)
    }
    print(json.dumps(summary, indent=2, ensure_ascii=False, default=str))
    return 0


def main(argv: list[str] | None = None) -> int:
    settings = get_settings()
    configure_logging(settings.log_level, settings.log_json)
    parser = argparse.ArgumentParser(prog="python -m app.workers.itbi")
    commands = parser.add_subparsers(dest="command", required=True)
    run = commands.add_parser("ingest", help="read the workbooks and rebuild the market data")
    run.add_argument("--city", default="sao-paulo")
    run.add_argument("--path", default=None, help="folder with the .xlsx files")
    run.add_argument("--no-raw", action="store_true", help="do not store raw source rows")
    args = parser.parse_args(argv)
    path = resolve_path(args.path or f"{settings.itbi_data_dir}/{args.city}")
    persist_raw = settings.itbi_persist_raw and not args.no_raw
    return asyncio.run(ingest(args.city, path, persist_raw))


if __name__ == "__main__":
    sys.exit(main())
