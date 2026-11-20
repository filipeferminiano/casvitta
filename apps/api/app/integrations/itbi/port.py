"""Sources of São Paulo ITBI workbooks (Secretaria Municipal da Fazenda, "Guias de ITBI pagas")."""

from __future__ import annotations

import re
from collections.abc import Iterator, Sequence
from dataclasses import dataclass
from datetime import date
from typing import Protocol

MONTHS = ("JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ")
_TAB = re.compile(r"^\s*([A-Za-z]{3})\s*[-/ ]\s*(\d{4})\s*$")


def payment_month(tab_name: str) -> date | None:
    """First day of the month a monthly tab covers ("JAN-2026" -> 2026-01-01); None otherwise.

    The year comes from the tab, never from the file name.
    """
    match = _TAB.match(tab_name)
    if not match or match.group(1).upper() not in MONTHS:
        return None
    return date(int(match.group(2)), MONTHS.index(match.group(1).upper()) + 1, 1)


@dataclass(frozen=True, slots=True)
class ItbiTab:
    source_file: str
    tab: str
    payment_month: date
    rows: Sequence[Sequence[object]]  # one tab at a time; row 0 may be a header


class ItbiSource(Protocol):
    def tabs(self) -> Iterator[ItbiTab]:
        """Monthly tabs, one at a time (a whole workbook is never held in memory)."""
        ...

    def code_tables(self) -> tuple[dict[int, str], dict[int, str]]:
        """(IPTU use codes, IPTU standard codes) from the reference tabs."""
        ...
