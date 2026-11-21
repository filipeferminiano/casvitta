"""Releasing a wave: curated names, indexable from then on, pages sent to IndexNow."""

from __future__ import annotations

import pytest
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import Settings
from app.domains.market_data import release as release_module
from app.domains.market_data.models import MarketNeighborhood
from app.domains.market_data.release import release_wave
from app.domains.market_data.seeds import SEEDS, NeighborhoodSeed
from app.integrations.search_index.fake import FakeSearchIndex
from app.scripts.seed_market_demo import seed_demo

SITE = "https://casvitta.com.br"


async def test_release_makes_the_wave_indexable_and_submits_its_pages(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    await seed_demo(session)
    # After the demo seed (which syncs places from SEEDS): a wave of one known and one unknown.
    monkeypatch.setitem(
        release_module.SEEDS,
        "sao-paulo",
        (
            NeighborhoodSeed("moema", "Moema Curada", "sul", ("MOEMA",), wave=9, preposition="em"),
            NeighborhoodSeed("nao-existe", "Não Existe", "sul", ("NAO EXISTE",), wave=9),
        ),
    )
    await session.execute(
        update(MarketNeighborhood)
        .where(MarketNeighborhood.slug == "moema")
        .values(is_indexable=False, name="Moema", is_auto=True)
    )
    index = FakeSearchIndex()

    summary = await release_wave(session, "sao-paulo", 9, Settings(site_url=SITE), index)

    assert summary["released"] == ["moema"]
    assert summary["missing_in_data"] == ["nao-existe"]
    moema = await session.scalar(
        select(MarketNeighborhood).where(MarketNeighborhood.slug == "moema")
    )
    assert moema is not None
    assert (moema.is_indexable, moema.name, moema.is_auto) == (True, "Moema Curada", False)
    _, urls = index.submissions[0]
    assert urls[0] == f"{SITE}/preco-m2/sao-paulo"
    assert f"{SITE}/preco-m2/sao-paulo/moema" in urls
    assert all("/moema" in u for u in urls[1:])  # only the released neighborhood's pages

    again = await release_wave(session, "sao-paulo", 9, Settings(site_url=SITE), FakeSearchIndex())
    assert (again["released"], again["already_indexable"], again["pages"]) == ([], ["moema"], 0)


def test_wave_2_seeds_are_curated() -> None:
    wave_2 = [s for s in SEEDS["sao-paulo"] if s.wave == 2]
    assert len(wave_2) == 41
    assert len({s.slug for s in SEEDS["sao-paulo"]}) == len(SEEDS["sao-paulo"])
    by_slug = {s.slug: s for s in wave_2}
    assert (by_slug["tatuape"].name, by_slug["tatuape"].preposition) == ("Tatuapé", "no")
    assert by_slug["freguesia-do-o"].name == "Freguesia do Ó"
    assert all(s.preposition in {"no", "na", "em"} for s in wave_2)
    assert all(s.zone in {"centro", "norte", "sul", "leste", "oeste"} for s in wave_2)
