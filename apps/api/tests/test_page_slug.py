"""SOC-1b: changing the page address. Old addresses keep leading to the page and stay with the
broker; reserved words and anything with "casvitta" are refused."""

from __future__ import annotations

import pytest

from app.core.tenancy import cross_tenant
from app.domains.accounts.service import _unique_slug, is_reserved_slug
from app.domains.pages.models import PageSlugRedirect
from app.integrations.registry import Integrations
from tests.staff_helpers import add_broker, make_client
from tests.test_pages import SETTINGS, _whatsapp
from tests.test_properties import _cookie


async def test_change_address_keeps_old_links_and_reserves_them(
    make_session, integrations: Integrations
) -> None:  # type: ignore[no-untyped-def]
    async with make_session() as setup:
        broker = await add_broker(setup, "Mariana Alves", verified=True)
        other = await add_broker(setup, "Outra Pessoa", verified=True)
        await setup.commit()
    await _whatsapp(make_session, broker)
    old = broker.slug
    async with make_client(make_session, integrations, SETTINGS) as api:
        h = _cookie(broker)
        await api.post("/v1/page/publish", headers=h)

        check = (await api.get("/v1/page/slug-check?slug=Mariana-Campinas", headers=h)).json()
        assert check["problem"] is None and check["slug"] == "mariana-campinas"
        assert check["url"] == "http://mariana-campinas.localhost:3000"

        r = await api.put("/v1/page/slug", headers=h, json={"slug": "mariana-campinas"})
        assert r.status_code == 200, r.text
        assert r.json()["slug"] == "mariana-campinas" and r.json()["old_slugs"] == [old]

        # The old address (and its QR code) still opens the page, with the new address in it.
        public = (await api.get(f"/v1/public/pages/{old}")).json()
        assert public["slug"] == "mariana-campinas"
        assert public["url"] == "http://mariana-campinas.localhost:3000"

        # Nobody else can take the old address or the new one.
        ho = _cookie(other)
        for taken in (old, "mariana-campinas"):
            problem = (await api.get(f"/v1/page/slug-check?slug={taken}", headers=ho)).json()
            assert problem["problem"] == "taken"
        r = await api.put("/v1/page/slug", headers=ho, json={"slug": old})
        assert r.status_code == 409 and r.json()["error"]["code"] == "page_slug_taken"

        # Going back to an earlier address is allowed and frees that redirect.
        r = await api.put("/v1/page/slug", headers=h, json={"slug": old})
        assert r.json()["slug"] == old and r.json()["old_slugs"] == ["mariana-campinas"]


async def test_address_rules_and_change_limit(make_session, integrations: Integrations) -> None:  # type: ignore[no-untyped-def]
    async with make_session() as setup:
        broker = await add_broker(setup, "Mariana Alves", verified=True)
        await setup.commit()
    async with make_client(make_session, integrations, SETTINGS) as api:
        h = _cookie(broker)
        cases = {
            broker.slug: "same",
            "ab": "invalid",
            "-mariana": "invalid",
            "mari--ana": "invalid",
            "maríana": "invalid",
            "suporte": "reserved",
            "casvitta-oficial": "reserved",
            "marianacasvitta": "reserved",
        }
        for slug, expected in cases.items():
            r = await api.get(f"/v1/page/slug-check?slug={slug}", headers=h)
            assert r.json()["problem"] == expected, slug
        for n in range(5):
            r = await api.put("/v1/page/slug", headers=h, json={"slug": f"mariana-{n}"})
            assert r.status_code == 200, r.text
        r = await api.put("/v1/page/slug", headers=h, json={"slug": "mariana-final"})
        assert r.json()["error"]["code"] == "page_slug_too_many_changes"
        # Coming back to an earlier one is still possible.
        assert (
            await api.put("/v1/page/slug", headers=h, json={"slug": "mariana-1"})
        ).status_code == 200


@pytest.mark.parametrize("slug", ["app", "casvitta", "minhacasvitta", "suporte"])
def test_reserved(slug: str) -> None:
    assert is_reserved_slug(slug)


async def test_signup_slug_skips_casvitta_and_held_addresses(make_session) -> None:  # type: ignore[no-untyped-def]
    async with make_session() as s:
        assert await _unique_slug(s, "Casvitta Silva") == "corretor"
        broker = await add_broker(s, "Ana Ribeiro", verified=True)
        with cross_tenant(s):
            s.add(
                PageSlugRedirect(
                    workspace_id=broker.workspace_id,
                    old_slug="joaosilva",
                    broker_profile_id=broker.id,
                )
            )
            await s.flush()
        assert await _unique_slug(s, "João Silva") == "joaosilva2"
