"""IndexNow: host grouping, adapter selection, request shape and batching."""

from __future__ import annotations

import json

import httpx
import pytest
from pydantic import ValidationError

from app.core.settings import Settings
from app.domains.seo.service import group_by_host, submit_urls
from app.integrations.base import IntegrationError, IntegrationNotConfigured
from app.integrations.registry import build_integrations
from app.integrations.search_index.fake import FakeSearchIndex
from app.integrations.search_index.indexnow import MAX_URLS_PER_REQUEST, IndexNow
from app.scripts.indexnow_submit import parse_sitemap
from app.workers.settings import indexnow_submit

ROOT = "casvitta.com.br"
KEY = "0123456789abcdef0123456789abcdef"


def test_group_by_host_keeps_only_https_on_our_domains() -> None:
    groups, skipped = group_by_host(
        [
            "https://casvitta.com.br/comprar",
            "https://anaribeiro.casvitta.com.br/apto-vila-mariana",
            "https://casvitta.com.br/comprar",  # duplicate
            "https://casvitta.com.br/alugar",
            "http://casvitta.com.br/sobre",
            "https://evilcasvitta.com.br/x",
            "https://example.com/casvitta.com.br",
        ],
        ROOT,
    )
    assert groups == {
        "casvitta.com.br": ["https://casvitta.com.br/comprar", "https://casvitta.com.br/alugar"],
        "anaribeiro.casvitta.com.br": ["https://anaribeiro.casvitta.com.br/apto-vila-mariana"],
    }
    assert skipped == [
        "http://casvitta.com.br/sobre",
        "https://evilcasvitta.com.br/x",
        "https://example.com/casvitta.com.br",
    ]


async def test_submit_urls_sends_one_submission_per_host() -> None:
    index = FakeSearchIndex()
    result = await submit_urls(
        index, ["https://casvitta.com.br/", "https://ana.casvitta.com.br/a"], ROOT
    )
    assert result.submitted == 2
    assert index.submissions == [
        ("casvitta.com.br", ["https://casvitta.com.br/"]),
        ("ana.casvitta.com.br", ["https://ana.casvitta.com.br/a"]),
    ]


def test_registry_uses_fake_until_enabled() -> None:
    integrations = build_integrations(Settings(fake_integrations=True, indexnow_key=KEY))
    assert isinstance(integrations.search_index, FakeSearchIndex)


def test_registry_uses_indexnow_when_enabled_with_a_key() -> None:
    settings = Settings(fake_integrations=True, indexnow_enabled=True, indexnow_key=KEY)
    integrations = build_integrations(settings)
    assert isinstance(integrations.search_index, IndexNow)
    # The other adapters stay fake.
    assert integrations.is_fake


def test_registry_refuses_indexnow_without_key() -> None:
    with pytest.raises(IntegrationNotConfigured):
        build_integrations(Settings(fake_integrations=True, indexnow_enabled=True))


def test_settings_reject_a_malformed_key() -> None:
    with pytest.raises(ValidationError):
        Settings(indexnow_key="short")
    assert Settings(indexnow_key="").indexnow_key is None


async def test_indexnow_posts_the_documented_body_in_batches() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(202)

    adapter = IndexNow(KEY, transport=httpx.MockTransport(handler))
    urls = [f"https://casvitta.com.br/imovel/{i}" for i in range(MAX_URLS_PER_REQUEST + 1)]
    await adapter.submit("casvitta.com.br", urls)

    assert len(requests) == 2
    first = json.loads(requests[0].content)
    assert str(requests[0].url) == "https://api.indexnow.org/indexnow"
    assert first["host"] == "casvitta.com.br"
    assert first["key"] == KEY
    assert first["keyLocation"] == "https://casvitta.com.br/indexnow-key.txt"
    assert len(first["urlList"]) == MAX_URLS_PER_REQUEST
    assert json.loads(requests[1].content)["urlList"] == [urls[-1]]


async def test_indexnow_raises_when_the_key_is_rejected() -> None:
    adapter = IndexNow(KEY, transport=httpx.MockTransport(lambda _: httpx.Response(403)))
    with pytest.raises(IntegrationError):
        await adapter.submit("casvitta.com.br", ["https://casvitta.com.br/"])


async def test_worker_job_submits_through_the_configured_port() -> None:
    integrations = build_integrations(Settings(fake_integrations=True))
    submitted = await indexnow_submit(
        {"integrations": integrations},
        ["https://casvitta.com.br/imovel/apto", "https://outro.com/x"],
    )
    assert submitted == 1
    assert isinstance(integrations.search_index, FakeSearchIndex)
    assert integrations.search_index.submissions == [
        ("casvitta.com.br", ["https://casvitta.com.br/imovel/apto"])
    ]


def test_parse_sitemap_reads_loc_elements() -> None:
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?><urlset>'
        "<url><loc>https://casvitta.com.br</loc></url>"
        "<url><loc>\n https://casvitta.com.br/comprar?a=1&amp;b=2 \n</loc></url></urlset>"
    )
    assert parse_sitemap(xml) == [
        "https://casvitta.com.br",
        "https://casvitta.com.br/comprar?a=1&b=2",
    ]
