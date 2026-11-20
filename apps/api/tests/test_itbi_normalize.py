"""Cleaning, location, streets/buildings and slugs: pure rules and one pipeline run on fixtures."""

from __future__ import annotations

from collections import Counter
from datetime import date
from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.market_data.clean import (
    Exclusion,
    classify,
    mentions_bundled_parking,
    to_clean,
)
from app.domains.market_data.locate import (
    LocationIndex,
    NeighborhoodResolver,
    canonical_neighborhood,
    cep_majority,
    looks_like_building,
)
from app.domains.market_data.models import (
    ItbiLocationReview,
    ItbiTransaction,
    MarketBuilding,
    MarketNeighborhood,
    MarketSlugRedirect,
    MarketStreet,
    PropertyKind,
)
from app.domains.market_data.normalize import (
    building_display_name,
    street_display_name,
    unique_slug,
)
from app.domains.market_data.pipeline import run_ingestion
from app.domains.market_data.seeds import SAO_PAULO
from app.domains.market_data.stats import median, outside_p1_p99, percentile, round_to
from app.integrations.itbi.layouts import parse_row
from app.integrations.itbi.local import LocalFileItbiSource
from tests.itbi_workbooks import row, write_workbook

# --- cleaning ---------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("overrides", "expected"),
    [
        ({}, PropertyKind.APARTMENT),
        ({"use": 25.0}, PropertyKind.FLAT),
        ({"use": 10.0}, PropertyKind.HOUSE),
        ({"use": 14.0}, PropertyKind.HOUSE),
        ({"nature": "2.Cessão de direitos"}, Exclusion.NOT_A_PURCHASE),
        ({"nature": "20.Realização ou integralização de capital"}, Exclusion.NOT_A_PURCHASE),
        ({"proportion": 50.0}, Exclusion.PARTIAL_SHARE),
        ({"proportion": 0.64}, Exclusion.PARTIAL_SHARE),  # off-plan land fraction
        ({"value": 0.0}, Exclusion.NO_VALUE),
        ({"use": 24.0}, Exclusion.PARKING),
        ({"use": 23.0}, Exclusion.PARKING),
        ({"use": 63.0}, Exclusion.PARKING),
        ({"use": 30.0}, Exclusion.NOT_RESIDENTIAL),
        ({"use": 85.0}, Exclusion.NOT_RESIDENTIAL),  # commercial flat
        ({"use": 0.0, "built_area": 0.0}, Exclusion.NOT_RESIDENTIAL),  # land
        ({"built_area": 0.0}, Exclusion.NO_BUILT_AREA),
    ],
)
def test_classify(overrides: dict[str, object], expected: object) -> None:
    assert classify(parse_row(row(**overrides))) == expected  # type: ignore[arg-type]


@pytest.mark.parametrize(
    ("unit", "expected"),
    [
        ("AP 201 E 3VGS", True),
        ("APTO 12 + 2 VAGAS", True),
        ("AP 31 VG 12", True),
        ("AP 11", False),
        ("BLOCO B", False),
    ],
)
def test_bundled_parking_text(unit: str, expected: bool) -> None:
    assert mentions_bundled_parking(unit) is expected


def test_under_declared_flag_and_price_per_m2() -> None:
    low = parse_row(row(value=100_000.0, reference_value=300_000.0, built_area=50.0))
    ok = parse_row(row(value=200_000.0, reference_value=300_000.0))
    kind = PropertyKind.APARTMENT
    clean_low = to_clean(low, kind, date(2026, 1, 1))
    assert clean_low.under_declared
    assert clean_low.price_m2_cents == 200_000  # R$ 2.000/m²
    assert not to_clean(ok, kind, date(2026, 1, 1)).under_declared


def test_placeholder_number_is_dropped() -> None:
    clean = to_clean(parse_row(row(number=99_999.0)), PropertyKind.APARTMENT, date(2026, 1, 1))
    assert clean.street_number is None


# --- location ---------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "canonical"),
    [
        ("VL. MARIANA", "VILA MARIANA"),
        ("V MARIANA", "VILA MARIANA"),
        ("JD DA SAUDE", "JARDIM DA SAUDE"),
        ("Aclimação", "ACLIMACAO"),
        ("PQ  DO ESTADO", "PARQUE DO ESTADO"),
    ],
)
def test_canonical_neighborhood(raw: str, canonical: str) -> None:
    assert canonical_neighborhood(raw) == canonical


def test_building_like_values_are_not_neighborhoods() -> None:
    assert looks_like_building("COND SKY CAMPO BELO")
    assert looks_like_building("SETOR 2 AYLA MOEMA")
    assert not looks_like_building("VILA MARIANA")


def test_resolver_uses_curated_aliases() -> None:
    resolver = NeighborhoodResolver.from_seeds(SAO_PAULO)
    assert resolver.resolve("INDIANOPOLIS") == "moema"
    assert resolver.resolve("VL CLEMENTINO") == "vila-clementino"
    assert resolver.resolve("BOSQUE DA SAUDE") == "bosque-da-saude"  # not Saúde
    assert resolver.resolve("SAUDE") == "saude"
    assert resolver.resolve("") is None


def test_resolver_learns_only_frequent_non_building_spellings() -> None:
    resolver = NeighborhoodResolver.from_seeds(SAO_PAULO)
    resolver.learn(Counter({"PERDIZES": 25, "VILA RARA": 3, "COND ALGUM": 99}))
    assert resolver.resolve("PERDIZES") == "perdizes"
    assert resolver.resolve("VILA RARA") is None
    assert resolver.resolve("COND ALGUM") is None


def test_cep_majority_leaves_ties_unresolved() -> None:
    votes = {
        "04000001": Counter({"vila-mariana": 3, "moema": 1}),
        "04000002": Counter({"moema": 2, "saude": 2}),
    }
    assert cep_majority(votes) == {"04000001": "vila-mariana"}


def test_location_index_assigns_empty_bairro_by_cep() -> None:
    index = LocationIndex(NeighborhoodResolver.from_seeds(SAO_PAULO))
    for _ in range(3):
        index.observe("04000001", "VL MARIANA")
    index.observe("04000001", "COND QUALQUER")
    index.build()
    assert index.locate("04000001", "") == "vila-mariana"
    assert index.locate("04000001", "MOEMA") == "moema"  # an own resolvable Bairro wins
    assert index.locate("09999999", "") is None


# --- streets, buildings, slugs ----------------------------------------------------------------


@pytest.mark.parametrize(
    ("key", "name"),
    [
        ("R DOMINGOS DE MORAIS", "Rua Domingos de Morais"),
        ("AV PROF NOE AZEVEDO", "Avenida Professor Noe Azevedo"),
        ("AL DOS ARAPANES", "Alameda dos Arapanes"),
        ("PC DR JOAO MENDES", "Praça Doutor Joao Mendes"),
        ("R S LAZARO", "Rua São Lazaro"),
    ],
)
def test_street_display_names(key: str, name: str) -> None:
    assert street_display_name(key) == name


def test_building_name_prefers_the_most_frequent_building_reference() -> None:
    refs = Counter({"COND MAISON BLANCHE": 3, "ED POESIA": 1, "PROX METRO": 9})
    assert building_display_name(refs, "Rua X", 10) == ("Condomínio Maison Blanche", True)
    tie = Counter({"ED BETA": 2, "ED ALFA": 2})
    assert building_display_name(tie, "Rua X", 10) == ("Edifício Alfa", True)
    assert building_display_name(Counter({"FUNDOS": 2}), "Rua X", 10) == (
        "Edifício na Rua X, 10",
        False,
    )


def test_unique_slug() -> None:
    taken = {"edificio-alfa"}
    assert unique_slug("edificio-alfa", taken) == "edificio-alfa-2"
    assert unique_slug("edificio-alfa", taken) == "edificio-alfa-3"
    assert unique_slug("", taken) == "sem-nome"


# --- stats ------------------------------------------------------------------------------------


def test_percentiles_and_rounding() -> None:
    values = [10, 20, 30, 40]
    assert median(values) == 25
    assert percentile(values, 25) == 18  # 17.5 rounded half up
    assert percentile([7], 99) == 7
    assert round_to(68_949_900, 100_000) == 68_900_000
    assert round_to(68_950_000, 100_000) == 69_000_000
    assert round_to(1_234_567, 1_000) == 1_235_000


def test_outliers_need_a_big_enough_group() -> None:
    assert outside_p1_p99([1, 1_000_000]) == [False, False]
    values = [100] * 98 + [1, 10_000]
    flags = outside_p1_p99(values)
    assert flags[-2:] == [True, True]
    assert sum(flags) == 2


# --- pipeline ---------------------------------------------------------------------------------


def _apartment(**overrides: object) -> list[object]:
    base: dict[str, object] = {
        "sql": 4_202_001.0,  # setor 004, quadra 202
        "street": "R DAS FLORES FICTICIAS",
        "number": 100.0,
        "cep": 4_101_000.0,
        "neighborhood": "VL MARIANA",
        "reference": "COND JARDIM FICTICIO",
    }
    return row(**(base | overrides))  # type: ignore[arg-type]


def _workbooks(folder: Path, reference: str = "COND JARDIM FICTICIO") -> Path:
    write_workbook(
        folder / "a.xlsx",
        {
            "JAN-2026": (
                "padrao",
                [
                    _apartment(value=500_000.0, reference=reference),
                    _apartment(sql=4_202_002.0, value=600_000.0, reference=reference),
                    _apartment(sql=4_202_003.0, value=700_000.0, neighborhood="", reference=""),
                    _apartment(sql=4_202_004.0, nature="2.Cessão de direitos"),
                    _apartment(sql=4_202_005.0, use=24.0),
                    # Empty Bairro and a CEP nobody voted for: review report.
                    _apartment(sql=5_000_001.0, cep=9_999_999.0, neighborhood="", street="R Y"),
                ],
            )
        },
    )
    write_workbook(
        folder / "b.xlsx",
        {
            # Same sale (sql, date, value) paid again in a later tab: duplicate.
            "FEV-2026": ("padrao", [_apartment(value=500_000.0, unit="AP 11 E 1 VG")]),
        },
    )
    return folder


async def test_pipeline_cleans_locates_and_groups(tmp_path: Path, session: AsyncSession) -> None:
    source = LocalFileItbiSource(_workbooks(tmp_path))
    result = await run_ingestion(session, "sao-paulo", source, persist_raw=False)

    assert result.report["kept"] == 4
    assert result.report["excluded"] == {
        "nature_not_1": 1,
        "parking_unit": 1,
        "duplicate_across_files": 1,
    }
    assert result.report["located"] == 3
    assert result.report["unlocated"] == 1

    mariana = await session.scalar(
        select(MarketNeighborhood).where(MarketNeighborhood.slug == "vila-mariana")
    )
    assert mariana is not None and mariana.is_indexable and mariana.wave == 1
    perdizes_like = await session.scalar(
        select(func.count()).select_from(MarketNeighborhood).where(MarketNeighborhood.is_auto)
    )
    assert perdizes_like == 0  # nothing frequent enough to learn in 6 rows

    street = await session.scalar(select(MarketStreet).where(MarketStreet.slug != ""))
    assert street is not None
    assert (street.name, street.slug) == ("Rua das Flores Ficticias", "rua-das-flores-ficticias")

    building = await session.scalar(select(MarketBuilding))
    assert building is not None
    assert building.name == "Condomínio Jardim Ficticio"
    assert building.slug == "condominio-jardim-ficticio"
    assert building.construction_year == 2001
    tx_in_building = select(func.count()).where(ItbiTransaction.building_id == building.id)
    assert await session.scalar(tx_in_building) == 3

    review = (await session.scalars(select(ItbiLocationReview))).all()
    assert [(r.cep, r.street, r.row_count) for r in review] == [("09999999", "R Y", 1)]


async def test_slugs_are_stable_and_renames_redirect(tmp_path: Path, session: AsyncSession) -> None:
    first = tmp_path / "v1"
    first.mkdir()
    await run_ingestion(
        session, "sao-paulo", LocalFileItbiSource(_workbooks(first)), persist_raw=False
    )
    building = await session.scalar(select(MarketBuilding))
    assert building is not None
    old_slug, building_id = building.slug, building.id

    # Same files again: nothing changes.
    await run_ingestion(
        session, "sao-paulo", LocalFileItbiSource(_workbooks(first)), persist_raw=False
    )
    assert (await session.scalar(select(MarketBuilding.slug))) == old_slug
    assert await session.scalar(select(func.count()).select_from(MarketSlugRedirect)) == 0

    # The building's name in the source changes: new slug, old one redirects.
    second = tmp_path / "v2"
    second.mkdir()
    await run_ingestion(
        session,
        "sao-paulo",
        LocalFileItbiSource(_workbooks(second, reference="ED NOVO NOME")),
        persist_raw=False,
    )
    renamed = await session.get(MarketBuilding, building_id)
    assert renamed is not None
    await session.refresh(renamed)
    assert renamed.slug == "edificio-novo-nome"
    redirect = await session.scalar(select(MarketSlugRedirect))
    assert redirect is not None
    assert (redirect.old_slug, redirect.entity_id) == (old_slug, building_id)
