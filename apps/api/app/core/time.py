"""Time helpers. Store UTC; present in America/Sao_Paulo with pt-BR formats."""

from __future__ import annotations

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

TZ = ZoneInfo("America/Sao_Paulo")


def utcnow() -> datetime:
    return datetime.now(UTC)


def to_local(value: datetime) -> datetime:
    if value.tzinfo is None:
        raise ValueError("naive datetimes are not allowed; store timezone-aware UTC")
    return value.astimezone(TZ)


def format_time(value: datetime) -> str:
    """'14h' on the hour, '14h03' otherwise, in São Paulo time."""
    local = to_local(value)
    return f"{local.hour}h" if local.minute == 0 else f"{local.hour}h{local.minute:02d}"


def format_date(value: date | datetime) -> str:
    """'dd/MM/yyyy' (datetimes are converted to São Paulo time first)."""
    day = to_local(value).date() if isinstance(value, datetime) else value
    return day.strftime("%d/%m/%Y")
