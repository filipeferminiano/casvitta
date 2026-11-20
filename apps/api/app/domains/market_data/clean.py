"""Which source rows become cleaned purchases, and why the others do not (pure functions).

Kept: nature 1 (compra e venda), the whole property (proportion 100 %), value and built area
present, a residential use (apartment 20, flat 25, house 10/14). Off-plan sales are recorded as a
land fraction (use 0, built area 0), so v1 covers resale only.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from enum import StrEnum

from app.domains.market_data.models import PropertyKind
from app.integrations.itbi.layouts import ItbiRow, normalize_text

USE_KIND: dict[int, PropertyKind] = {
    20: PropertyKind.APARTMENT,
    25: PropertyKind.FLAT,
    10: PropertyKind.HOUSE,
    14: PropertyKind.HOUSE,
}
PARKING_USES = frozenset({23, 24, 63})
NO_NUMBER = frozenset({0, 99999})  # placeholders for "no number" in the source


class Exclusion(StrEnum):
    NOT_A_PURCHASE = "nature_not_1"
    PARTIAL_SHARE = "proportion_not_100"
    NO_DATE = "no_transaction_date"
    NO_VALUE = "no_value"
    NO_BUILT_AREA = "no_built_area"
    PARKING = "parking_unit"
    NOT_RESIDENTIAL = "not_residential"  # commercial, land, commercial flat, other uses
    NO_SQL = "no_sql"
    DUPLICATE = "duplicate_across_files"  # same (sql, transaction date, value)


@dataclass(slots=True)
class CleanRow:
    row_hash: str
    sql: str
    street_key: str
    street_number: int | None
    cep: str
    neighborhood_raw: str
    reference_raw: str
    kind: PropertyKind
    transaction_date: date
    payment_month: date
    value_cents: int
    built_area_m2: Decimal
    price_m2_cents: int
    financing_type_code: int | None
    financed_value_cents: int | None
    construction_year: int | None
    under_declared: bool
    bundled_parking: bool
    price_outlier: bool = False

    @property
    def block(self) -> str:
        """Fiscal block: setor + quadra from the SQL."""
        return self.sql[:6]

    @property
    def has_financing(self) -> bool:
        return self.financing_type_code is not None or bool(self.financed_value_cents)


def classify(row: ItbiRow) -> PropertyKind | Exclusion:  # noqa: PLR0911 - one rule per return
    if row.nature_code != 1:
        return Exclusion.NOT_A_PURCHASE
    if row.proportion_pct != 100:
        return Exclusion.PARTIAL_SHARE
    if row.transaction_date is None:
        return Exclusion.NO_DATE
    if not row.value_cents or row.value_cents <= 0:
        return Exclusion.NO_VALUE
    if row.use_code in PARKING_USES:
        return Exclusion.PARKING
    kind = USE_KIND.get(row.use_code) if row.use_code is not None else None
    if kind is None:
        return Exclusion.NOT_RESIDENTIAL
    if not row.built_area_m2 or row.built_area_m2 <= 0:
        return Exclusion.NO_BUILT_AREA
    if not row.sql:
        return Exclusion.NO_SQL
    return kind


_PARKING_TEXT = re.compile(r"\b(\d*\s*VGS?|VAGAS?|GAR(AGEM|AGENS)?)\b")


def mentions_bundled_parking(unit_raw: str) -> bool:
    """'AP 201 E 3VGS', 'APTO 12 + 2 VAGAS' -> True."""
    return bool(_PARKING_TEXT.search(normalize_text(unit_raw)))


def to_clean(row: ItbiRow, kind: PropertyKind, payment_month: date) -> CleanRow:
    if row.transaction_date is None or not row.value_cents or not row.built_area_m2:
        raise ValueError("to_clean needs a row that classify() kept")
    price_m2 = (Decimal(row.value_cents) / row.built_area_m2).quantize(
        Decimal(1), rounding=ROUND_HALF_UP
    )
    reference = row.reference_value_prop_cents or 0
    return CleanRow(
        row_hash=row.row_hash,
        sql=row.sql,
        street_key=normalize_text(row.street_raw),
        street_number=None if row.street_number in NO_NUMBER else row.street_number,
        cep=row.cep,
        neighborhood_raw=row.neighborhood_raw,
        reference_raw=row.reference_raw,
        kind=kind,
        transaction_date=row.transaction_date,
        payment_month=payment_month,
        value_cents=row.value_cents,
        built_area_m2=row.built_area_m2,
        price_m2_cents=int(price_m2),
        financing_type_code=row.financing_type_code,
        financed_value_cents=row.financed_value_cents or None,
        construction_year=row.construction_year,
        under_declared=reference > 0 and row.value_cents * 2 < reference,
        bundled_parking=mentions_bundled_parking(row.unit_raw),
    )


def dedup_key(row: CleanRow) -> tuple[str, date, int]:
    return (row.sql, row.transaction_date, row.value_cents)
