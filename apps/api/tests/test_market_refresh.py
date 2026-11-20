"""After a refresh: IndexNow gets only changed indexable pages; the web cache is revalidated."""

from __future__ import annotations

import httpx
from pydantic import SecretStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import Settings
from app.domains.market_data.refresh import after_refresh, snapshot
from app.integrations.search_index.fake import FakeSearchIndex
from app.scripts.seed_market_demo import seed_demo

SITE = "https://casvitta.com.br"


async def test_first_refresh_submits_every_indexable_page(session: AsyncSession) -> None:
    result = await seed_demo(session)
    index = FakeSearchIndex()
    summary = await after_refresh(session, result.city, {}, Settings(site_url=SITE), index)
    assert len(index.submissions) == 1
    host, urls = index.submissions[0]
    assert host == "casvitta.com.br"
    assert urls[0] == f"{SITE}/preco-m2/sao-paulo"
    assert f"{SITE}/preco-m2/sao-paulo/vila-mariana" in urls
    assert f"{SITE}/financiamento/sao-paulo/moema" in urls
    assert f"{SITE}/condominio/sao-paulo/vila-mariana/condominio-jardim-exemplo" in urls
    # Below the gate or not indexable: never submitted.
    assert not any("aclimacao" in u or "poucos-dados" in u for u in urls)
    assert summary["web_revalidated"] is False  # not configured


async def test_unchanged_refresh_submits_nothing(session: AsyncSession) -> None:
    result = await seed_demo(session)
    before = await snapshot(session, result.city.id)
    index = FakeSearchIndex()
    summary = await after_refresh(session, result.city, before, Settings(site_url=SITE), index)
    assert summary["changed_indexable_pages"] == 0
    assert index.submissions == []


async def test_revalidates_the_web_with_the_secret(session: AsyncSession) -> None:
    result = await seed_demo(session)
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"revalidated": ["market"]})

    settings = Settings(
        site_url=SITE,
        web_revalidate_url="https://casvitta.com.br/api/revalidate",
        web_revalidate_secret=SecretStr("s3cret-value"),
    )
    summary = await after_refresh(
        session, result.city, {}, settings, FakeSearchIndex(), httpx.MockTransport(handler)
    )
    assert summary["web_revalidated"] is True
    assert seen[0].headers["authorization"] == "Bearer s3cret-value"
