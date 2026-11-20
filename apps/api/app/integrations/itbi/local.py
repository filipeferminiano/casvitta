"""Reads the ITBI workbooks from a local folder with python-calamine, one tab at a time."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import date
from pathlib import Path

from python_calamine import CalamineWorkbook

from app.integrations.itbi.layouts import normalize_text
from app.integrations.itbi.port import ItbiTab, payment_month

USE_TAB = "TABELA DE USOS"
STANDARD_TAB = "TABELA DE PADROES"


class LocalFileItbiSource:
    def __init__(self, folder: Path) -> None:
        self.folder = folder

    def files(self) -> list[Path]:
        """Workbooks in chronological order of their tabs (file names are not reliable)."""
        paths = [p for p in self.folder.glob("*.xlsx") if not p.name.startswith("~$")]
        return sorted(paths, key=lambda p: (_first_month(p), p.name))

    def tabs(self) -> Iterator[ItbiTab]:
        for path in self.files():
            workbook = CalamineWorkbook.from_path(str(path))
            for name in workbook.sheet_names:
                month = payment_month(name)
                if month is None:
                    continue
                rows = workbook.get_sheet_by_name(name).to_python()
                yield ItbiTab(path.name, name, month, rows)
                del rows

    def code_tables(self) -> tuple[dict[int, str], dict[int, str]]:
        """From the most recent workbook that has both reference tabs."""
        for path in reversed(self.files()):
            workbook = CalamineWorkbook.from_path(str(path))
            names = {normalize_text(n): n for n in workbook.sheet_names}
            if USE_TAB in names and STANDARD_TAB in names:
                return (
                    _code_table(workbook, names[USE_TAB]),
                    _code_table(workbook, names[STANDARD_TAB]),
                )
        return {}, {}


def _first_month(path: Path) -> date:
    months = [m for m in map(payment_month, CalamineWorkbook.from_path(str(path)).sheet_names) if m]
    return min(months) if months else date.max


def _code_table(workbook: CalamineWorkbook, name: str) -> dict[int, str]:
    table: dict[int, str] = {}
    for row in workbook.get_sheet_by_name(name).to_python()[1:]:
        if len(row) < 2:
            continue
        try:
            code = int(float(str(row[0])))
        except ValueError:
            continue
        description = " ".join(str(row[1]).split())
        if description:
            table[code] = description
    return table
