"""ITBI refresh: read every monthly tab once, store raw rows (optional), and build the derived data.

Stages: ingest (this module) -> clean -> locate -> normalize -> aggregate. Derived tables are
rebuilt from the source on every run, so changing a rule only needs a re-run.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.time import utcnow
from app.domains.market_data.ingest import (
    RAW_BATCH,
    IngestReport,
    SourceRow,
    get_or_create_city,
    iter_rows,
    store_code_tables,
    store_raw,
)
from app.domains.market_data.models import ItbiIngestionRun, MarketCity, RunStatus
from app.integrations.itbi.port import ItbiSource

log = get_logger(__name__)


@dataclass(slots=True)
class RunResult:
    run: ItbiIngestionRun
    city: MarketCity
    ingest: IngestReport
    extra: dict[str, Any] = field(default_factory=dict)


async def run_ingestion(
    session: AsyncSession, city_slug: str, source: ItbiSource, *, persist_raw: bool
) -> RunResult:
    city = await get_or_create_city(session, city_slug)
    run = ItbiIngestionRun(city_id=city.id, persist_raw=persist_raw, report={})
    session.add(run)
    await session.flush()
    uses, standards = source.code_tables()
    await store_code_tables(session, uses, standards)

    report = IngestReport()
    batch: list[SourceRow] = []
    try:
        for row in iter_rows(source, report):
            if persist_raw:
                batch.append(row)
                if len(batch) >= RAW_BATCH:
                    await store_raw(session, city.id, run.id, batch, report)
                    batch.clear()
        if batch:
            await store_raw(session, city.id, run.id, batch, report)
    except Exception:
        run.status = RunStatus.FAILED
        run.finished_at = utcnow()
        run.report = report.as_dict()
        await session.commit()
        raise
    run.status = RunStatus.SUCCEEDED
    run.finished_at = utcnow()
    run.data_through = report.data_through
    run.report = report.as_dict()
    await session.commit()
    log.info("itbi_ingested", city=city_slug, rows=report.rows_read)
    return RunResult(run=run, city=city, ingest=report)
