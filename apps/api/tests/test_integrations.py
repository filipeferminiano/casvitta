from __future__ import annotations

from datetime import date
from pathlib import Path

import pytest
from pydantic import BaseModel

from app.core.settings import Settings
from app.integrations.ads.fake import FakeAdPlatform
from app.integrations.ads.port import (
    AdPlatform,
    CampaignSpec,
    DailySpend,
    ExternalCampaignStatus,
)
from app.integrations.base import IntegrationNotConfigured
from app.integrations.llm.fake import FakeLLM
from app.integrations.llm.prompts import PromptNotFound, load_prompt, parse_prompt
from app.integrations.llm.service import InvalidAIOutput, LLMService
from app.integrations.registry import build_integrations
from app.integrations.whatsapp.fake import FakeWhatsApp

PROMPT = """
## System
Você escreve anúncios usando só os fatos do imóvel. Exemplo de saída: {"title": "..."}

## User
Imóvel: $property
"""


class _AdOut(BaseModel):
    title: str


def test_registry_defaults_to_fakes() -> None:
    integrations = build_integrations(Settings(fake_integrations=True))
    assert integrations.is_fake
    assert isinstance(integrations.whatsapp, FakeWhatsApp)


def test_registry_refuses_real_adapters_until_implemented() -> None:
    with pytest.raises(IntegrationNotConfigured):
        build_integrations(Settings(fake_integrations=False))


def test_prompt_render_keeps_json_braces() -> None:
    prompt = parse_prompt("ad_copy", 1, PROMPT)
    system, user = prompt.render({"property": "Apartamento · Vila Mariana"})
    assert '{"title": "..."}' in system
    assert user == "Imóvel: Apartamento · Vila Mariana"


def test_load_prompt_from_versioned_file(tmp_path: Path) -> None:
    (tmp_path / "ad_copy").mkdir()
    (tmp_path / "ad_copy" / "v2.md").write_text(PROMPT, "utf-8")
    assert load_prompt("ad_copy", 2, base_dir=tmp_path).version == 2
    with pytest.raises(PromptNotFound):
        load_prompt("ad_copy", 3, base_dir=tmp_path)


async def test_llm_service_validates_output_and_reports_metadata() -> None:
    llm = FakeLLM({"ad_copy": '{"title": "2 quartos na Vila Mariana"}'})
    result = await LLMService(llm, "claude-sonnet-5-5").generate(
        parse_prompt("ad_copy", 1, PROMPT), {"property": "x"}, _AdOut
    )
    assert result.output.title == "2 quartos na Vila Mariana"
    assert (result.prompt_id, result.prompt_version) == ("ad_copy", 1)
    assert result.model == "fake:claude-sonnet-5-5"
    assert result.output_tokens > 0
    assert llm.requests[0].user == "Imóvel: x"


async def test_llm_service_rejects_invalid_output() -> None:
    llm = FakeLLM({"ad_copy": '{"headline": "wrong shape"}'})
    with pytest.raises(InvalidAIOutput):
        await LLMService(llm, "m").generate(
            parse_prompt("ad_copy", 1, PROMPT), {"property": "x"}, _AdOut
        )


def _spec(reference: str = "c1") -> CampaignSpec:
    return CampaignSpec(
        reference=reference,
        name="Apto Vila Mariana",
        daily_budget_cents=2_000,
        max_spend_cents=60_000,
        starts_on=date(2026, 11, 16),
        ends_on=None,
        landing_url="https://anaribeiro.casvitta.com.br/apto-vila-mariana",
        title="2 quartos na Vila Mariana",
        body="68 m², 1 vaga.",
    )


async def test_fake_ads_is_idempotent_and_tracks_spend() -> None:
    meta = FakeAdPlatform(AdPlatform.META)
    first = await meta.create_campaign(_spec())
    again = await meta.create_campaign(_spec())
    assert first == again
    assert first.status is ExternalCampaignStatus.ACTIVE
    meta.record_spend(first.external_id, DailySpend(date(2026, 11, 16), 1_850, 900, 31))
    assert (await meta.get_daily_spend(first.external_id, date(2026, 11, 16))).spend_cents == 1_850
    assert (await meta.get_daily_spend(first.external_id, date(2026, 11, 17))).spend_cents == 0
    paused = await meta.pause_campaign(first.external_id)
    assert paused.status is ExternalCampaignStatus.PAUSED


async def test_fake_ads_can_simulate_rejection() -> None:
    meta = FakeAdPlatform(AdPlatform.META)
    meta.reject_next_with = "A foto 3 tem texto acima do limite."
    result = await meta.create_campaign(_spec("c2"))
    assert result.status is ExternalCampaignStatus.REJECTED
    assert result.rejection_reason == "A foto 3 tem texto acima do limite."


async def test_fake_whatsapp_records_outbox() -> None:
    whatsapp = FakeWhatsApp()
    receipt = await whatsapp.send_text("+5511927408912", "Oi! Sou a assistente virtual da Ana.")
    assert whatsapp.outbox[0].to_e164 == "+5511927408912"
    assert receipt.external_id.startswith("wamid.fake.")
