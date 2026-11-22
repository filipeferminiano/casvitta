"""SOC-1b: Seleções and "Vi no Instagram". Only the broker's own properties; the public page only
shows items whose property is live on the page; Grátis has neither."""

from __future__ import annotations

import pytest

from app.core.tenancy import cross_tenant
from app.domains.accounts.models import Plan, Workspace
from app.domains.listings.models import Channel
from app.domains.pages import service
from app.domains.pages.collections import normalize_instagram_url
from app.domains.properties import service as properties
from app.integrations.registry import Integrations
from tests.staff_helpers import add_broker, make_client
from tests.test_pages import SETTINGS, _whatsapp
from tests.test_properties import TODAY, _cookie, bound, ready_property

REEL = "https://www.instagram.com/reel/C9xYz12AbC/?igsh=abc"


async def _set_plan(make_session, workspace_id, plan: Plan) -> None:  # type: ignore[no-untyped-def]
    async with make_session() as s:
        with cross_tenant(s):
            workspace = await s.get(Workspace, workspace_id)
            assert workspace is not None
            workspace.plan = plan
            await s.commit()


async def test_collections_and_posts_show_only_live_properties(
    make_session, integrations: Integrations
) -> None:  # type: ignore[no-untyped-def]
    async with make_session() as setup:
        broker = await add_broker(setup, "Mariana Alves", verified=True)
        other = await add_broker(setup, "Outro Corretor", verified=True)
        await setup.commit()
    await _whatsapp(make_session, broker)
    await _set_plan(make_session, broker.workspace_id, Plan.ESSENTIAL)
    s = await bound(make_session, broker)
    live = await ready_property(s, broker)
    waiting = await ready_property(s, broker, verified=False)  # authorization not checked yet
    for prop in (live, waiting):
        await properties.publish(s, prop.id, Channel.BIO_PAGE, TODAY)
    page, profile = await service.get_or_create(s, broker.user_id)
    await service.publish(s, page, profile)
    await s.commit()
    await s.close()
    s = await bound(make_session, other)
    foreign = await ready_property(s, other)
    await s.commit()
    await s.close()

    async with make_client(make_session, integrations, SETTINGS) as api:
        h = _cookie(broker)
        assert (await api.get("/v1/page/collections", headers=h)).json()["available"] is True
        body = {
            "collections": [
                {"title": "  Até   R$ 800 mil ", "property_ids": [str(waiting.id), str(live.id)]},
                {"title": "Só pendentes", "property_ids": [str(waiting.id)]},
            ],
            "instagram": [{"url": REEL, "label": "Tour no Cambuí", "property_id": str(live.id)}],
        }
        r = await api.put("/v1/page/collections", headers=h, json=body)
        assert r.status_code == 200, r.text
        saved = r.json()
        assert saved["collections"][0]["title"] == "Até R$ 800 mil"
        assert saved["instagram"][0]["url"] == "https://www.instagram.com/reel/C9xYz12AbC/"

        public = (await api.get(f"/v1/public/pages/{broker.slug}")).json()
        # The pending property never shows; a selection left empty disappears.
        assert public["collections"] == [{"title": "Até R$ 800 mil", "codes": [live.code]}]
        assert public["instagram"] == [
            {
                "url": "https://www.instagram.com/reel/C9xYz12AbC/",
                "label": "Tour no Cambuí",
                "code": live.code,
            }
        ]

        # Another broker's property cannot be added (tenant + responsible broker).
        bad = {"collections": [{"title": "Alheio", "property_ids": [str(foreign.id)]}]}
        assert (await api.put("/v1/page/collections", headers=h, json=bad)).status_code == 404
        not_a_post = {
            "instagram": [
                {"url": "https://evil.example/p/x", "label": "x x", "property_id": str(live.id)}
            ]
        }
        assert (
            await api.put("/v1/page/collections", headers=h, json=not_a_post)
        ).status_code == 422

        # Downgrade to Grátis: nothing is deleted, but nothing shows and editing is closed.
        await _set_plan(make_session, broker.workspace_id, Plan.FREE)
        mine = (await api.get("/v1/page/collections", headers=h)).json()
        assert mine["available"] is False and len(mine["collections"]) == 2
        public = (await api.get(f"/v1/public/pages/{broker.slug}")).json()
        assert public["collections"] == [] and public["instagram"] == []
        assert (await api.put("/v1/page/collections", headers=h, json=body)).status_code == 403


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("https://instagram.com/p/AbCdE123/", "https://www.instagram.com/p/AbCdE123/"),
        (
            "https://www.instagram.com/reels/AbCdE123?utm=1",
            "https://www.instagram.com/reel/AbCdE123/",
        ),
        (
            "https://www.instagram.com/mariana/reel/AbCdE123/",
            "https://www.instagram.com/reel/AbCdE123/",
        ),
    ],
)
def test_instagram_url_normalized(raw: str, expected: str) -> None:
    assert normalize_instagram_url(raw) == expected


@pytest.mark.parametrize(
    "raw",
    [
        "https://www.instagram.com/mariana/",
        "javascript:alert(1)",
        "https://instagram.com.evil/p/AbCdE1/",
    ],
)
def test_instagram_url_rejects_non_posts(raw: str) -> None:
    with pytest.raises(ValueError, match="instagram_url_invalid"):
        normalize_instagram_url(raw)
