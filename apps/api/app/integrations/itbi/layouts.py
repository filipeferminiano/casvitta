"""Column layouts of São Paulo's "Guias de ITBI pagas" monthly tabs, and the typed row parser.

Columns 0-27 sit at the same positions in every tab; only the headers of columns 26-27 differ
(checked against every tab of 2019-2026):

- ``PADRAO``: col 26 "Descrição do padrão (IPTU)", col 27 "ACC (IPTU)"   (2023+ mostly)
- ``PARDAO``: same, with the source's typo "Descrição do pardão (IPTU)"    (FEV-2026)
- ``ACC_ACC``: both headed "ACC (IPTU)"; col 26 still holds the standard description (2019-2022+)
- ``HEADERLESS``: the tab starts with data (JAN-2024, OUT-2024); accepted only when the first rows
  type-check against the positions below.

A trailing empty column may follow. Anything else fails loudly with :class:`ItbiLayoutError`.
The registry number (matrícula) and registry office (cartório) are never read into a record.
"""

from __future__ import annotations

import hashlib
import re
import unicodedata
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from enum import StrEnum


class ItbiLayoutError(ValueError):
    """A tab does not match any known layout (a new vintage of the file?)."""


class Layout(StrEnum):
    PADRAO = "padrao"
    PARDAO = "pardao"
    ACC_ACC = "acc_acc"
    HEADERLESS = "headerless"


# Normalized headers (no accents, upper case, single spaces) of columns 0-25.
COMMON_HEADERS: tuple[str, ...] = (
    "N DO CADASTRO (SQL)",
    "NOME DO LOGRADOURO",
    "NUMERO",
    "COMPLEMENTO",
    "BAIRRO",
    "REFERENCIA",
    "CEP",
    "NATUREZA DE TRANSACAO",
    "VALOR DE TRANSACAO (DECLARADO PELO CONTRIBUINTE)",
    "DATA DE TRANSACAO",
    "VALOR VENAL DE REFERENCIA",
    "PROPORCAO TRANSMITIDA (%)",
    "VALOR VENAL DE REFERENCIA (PROPORCIONAL)",
    "BASE DE CALCULO ADOTADA",
    "TIPO DE FINANCIAMENTO",
    "VALOR FINANCIADO",
    "CARTORIO DE REGISTRO",
    "MATRICULA DO IMOVEL",
    "SITUACAO DO SQL",
    "AREA DO TERRENO (M2)",
    "TESTADA (M)",
    "FRACAO IDEAL",
    "AREA CONSTRUIDA (M2)",
    "USO (IPTU)",
    "DESCRICAO DO USO (IPTU)",
    "PADRAO (IPTU)",
)
TAIL_HEADERS: dict[Layout, tuple[str, str]] = {
    Layout.PADRAO: ("DESCRICAO DO PADRAO (IPTU)", "ACC (IPTU)"),
    Layout.PARDAO: ("DESCRICAO DO PARDAO (IPTU)", "ACC (IPTU)"),
    Layout.ACC_ACC: ("ACC (IPTU)", "ACC (IPTU)"),
}
WIDTH = 28  # columns read; anything after must be empty


class Col:
    """Positions shared by every layout."""

    SQL = 0
    STREET = 1
    NUMBER = 2
    UNIT = 3
    NEIGHBORHOOD = 4
    REFERENCE = 5
    CEP = 6
    NATURE = 7
    VALUE = 8
    DATE = 9
    REFERENCE_VALUE = 10
    PROPORTION = 11
    REFERENCE_VALUE_PROP = 12
    TAX_BASE = 13
    FINANCING_TYPE = 14
    FINANCED_VALUE = 15
    # 16 registry office and 17 registry number: never read.
    SQL_STATUS = 18
    LAND_AREA = 19
    FRONTAGE = 20
    IDEAL_FRACTION = 21
    BUILT_AREA = 22
    USE = 23
    USE_DESC = 24
    STANDARD = 25
    STANDARD_DESC = 26
    CONSTRUCTION_YEAR = 27


def normalize_text(value: object) -> str:
    """Upper case, no accents, collapsed spaces. Empty for None."""
    if value is None:
        return ""
    text = unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", text.upper()).strip()


def detect_layout(first_row: Sequence[object]) -> Layout:
    """Layout of a tab from its first row; raises ItbiLayoutError on anything unexpected."""
    header = [normalize_text(c) for c in first_row]
    if header and _is_digits(header[0]):
        return Layout.HEADERLESS
    if len(header) < WIDTH:
        raise ItbiLayoutError(f"expected at least {WIDTH} columns, got {len(header)}")
    if tuple(header[:26]) != COMMON_HEADERS:
        diffs = [
            f"col {i}: {got!r} != {want!r}"
            for i, (got, want) in enumerate(zip(header[:26], COMMON_HEADERS, strict=True))
            if got != want
        ]
        raise ItbiLayoutError("unexpected headers: " + "; ".join(diffs))
    if any(header[WIDTH:]):
        raise ItbiLayoutError(f"unexpected extra headers: {header[WIDTH:]}")
    tail = (header[26], header[27])
    for layout, expected in TAIL_HEADERS.items():
        if tail == expected:
            return layout
    raise ItbiLayoutError(f"unexpected headers at columns 26-27: {tail}")


@dataclass(frozen=True, slots=True)
class ItbiRow:
    """One typed row. Money in integer cents; areas and percentages as Decimal."""

    row_hash: str
    sql: str  # 11 digits: setor(3) quadra(3) lote(4) check digit(1)
    street_raw: str
    street_number: int | None
    unit_raw: str
    neighborhood_raw: str
    reference_raw: str
    cep: str  # 8 digits, or "" when missing
    nature_code: int | None
    value_cents: int | None
    transaction_date: date | None
    reference_value_cents: int | None
    proportion_pct: Decimal | None
    reference_value_prop_cents: int | None
    tax_base_cents: int | None
    financing_type_code: int | None
    financing_type_raw: str
    financed_value_cents: int | None
    sql_status: str
    land_area_m2: Decimal | None
    frontage_m: Decimal | None
    ideal_fraction: Decimal | None
    built_area_m2: Decimal | None
    use_code: int | None
    standard_code: int | None
    standard_desc: str
    construction_year: int | None

    @property
    def setor(self) -> str:
        return self.sql[:3]

    @property
    def quadra(self) -> str:
        return self.sql[3:6]


def row_hash(cells: Sequence[object]) -> str:
    """Identity of a source row (all 28 columns as published, position-independent)."""
    payload = "\x1f".join(_canonical(c) for c in list(cells[:WIDTH]) + [""] * (WIDTH - len(cells)))
    return hashlib.sha256(payload.encode()).hexdigest()


def is_blank(cells: Sequence[object]) -> bool:
    return not any(str(c).strip() for c in cells[:10] if c is not None)


def parse_row(cells: Sequence[object]) -> ItbiRow:
    """Typed row from the 28 positional cells. Unparseable values become None, never errors."""
    c = list(cells[:WIDTH]) + [""] * max(0, WIDTH - len(cells))
    return ItbiRow(
        row_hash=row_hash(c),
        sql=_digits(c[Col.SQL]).zfill(11) if _digits(c[Col.SQL]) else "",
        street_raw=_text(c[Col.STREET]),
        street_number=_int(c[Col.NUMBER]),
        unit_raw=_text(c[Col.UNIT]),
        neighborhood_raw=_text(c[Col.NEIGHBORHOOD]),
        reference_raw=_text(c[Col.REFERENCE]),
        cep=_digits(c[Col.CEP]).zfill(8) if _digits(c[Col.CEP]) else "",
        nature_code=_leading_code(c[Col.NATURE]),
        value_cents=_cents(c[Col.VALUE]),
        transaction_date=_date(c[Col.DATE]),
        reference_value_cents=_cents(c[Col.REFERENCE_VALUE]),
        proportion_pct=_decimal(c[Col.PROPORTION]),
        reference_value_prop_cents=_cents(c[Col.REFERENCE_VALUE_PROP]),
        tax_base_cents=_cents(c[Col.TAX_BASE]),
        financing_type_code=_leading_code(c[Col.FINANCING_TYPE]),
        financing_type_raw=_text(c[Col.FINANCING_TYPE]),
        financed_value_cents=_cents(c[Col.FINANCED_VALUE]),
        sql_status=_text(c[Col.SQL_STATUS]),
        land_area_m2=_decimal(c[Col.LAND_AREA]),
        frontage_m=_decimal(c[Col.FRONTAGE]),
        ideal_fraction=_decimal(c[Col.IDEAL_FRACTION]),
        built_area_m2=_decimal(c[Col.BUILT_AREA]),
        use_code=_int(c[Col.USE]),
        standard_code=_int(c[Col.STANDARD]),
        standard_desc=_text(c[Col.STANDARD_DESC]),
        construction_year=_year(c[Col.CONSTRUCTION_YEAR]),
    )


def check_headerless(rows: Sequence[Sequence[object]]) -> None:
    """A headerless tab is accepted only when its first rows look like ITBI data rows."""
    sample = [r for r in rows[:20] if not is_blank(r)]
    if not sample:
        raise ItbiLayoutError("headerless tab without data")
    for cells in sample:
        row = parse_row(cells)
        if not (row.sql and row.transaction_date and row.nature_code is not None):
            raise ItbiLayoutError("headerless tab whose rows do not type-check")
        if len(cells) > WIDTH and any(str(x).strip() for x in cells[WIDTH:]):
            raise ItbiLayoutError("headerless tab with unexpected extra columns")


# --- cell parsers -------------------------------------------------------------------------------

_LEADING_CODE = re.compile(r"^\s*(\d{1,3})\s*\.")
_DATE_BR = re.compile(r"^(\d{2})/(\d{2})/(\d{4})$")


def _canonical(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value).strip()


def _text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value)).strip() if value is not None else ""


def _is_digits(text: str) -> bool:
    return bool(re.fullmatch(r"\d+(\.0)?", text))


def _digits(value: object) -> str:
    if isinstance(value, float):
        return str(int(value)) if value.is_integer() else ""
    if isinstance(value, int):
        return str(value)
    text = _text(value)
    if re.fullmatch(r"\d+\.0", text):
        text = text[:-2]
    return text if text.isdigit() else ""


def _decimal(value: object) -> Decimal | None:
    if value is None or isinstance(value, bool | date):
        return None
    if isinstance(value, int | float):
        return Decimal(repr(value)) if isinstance(value, float) else Decimal(value)
    text = _text(value)
    if not text:
        return None
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    try:
        return Decimal(text)
    except InvalidOperation:
        return None


def _cents(value: object) -> int | None:
    amount = _decimal(value)
    if amount is None:
        return None
    return int((amount * 100).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def _int(value: object) -> int | None:
    amount = _decimal(value)
    if amount is None or amount != amount.to_integral_value():
        return None
    return int(amount)


def _year(value: object) -> int | None:
    year = _int(value)
    return year if year is not None and 1800 <= year <= 2100 else None


def _leading_code(value: object) -> int | None:
    match = _LEADING_CODE.match(_text(value))
    return int(match.group(1)) if match else None


def _date(value: object) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    match = _DATE_BR.match(_text(value))
    if match:
        day, month, year = (int(g) for g in match.groups())
        try:
            return date(year, month, day)
        except ValueError:
            return None
    return None
