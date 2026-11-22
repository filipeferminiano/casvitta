"""Builds the set of integration adapters for the running app.

FAKE_INTEGRATIONS=true (the default) wires every port to its fake adapter. Real adapters are not
implemented yet; asking for them fails fast at startup instead of silently calling nothing.
"""

from __future__ import annotations

from dataclasses import dataclass, replace

from fastapi import Request

from app.core.catalog import paid_price_cents
from app.core.settings import Settings
from app.integrations.ads.fake import FakeAdPlatform
from app.integrations.ads.port import AdPlatform, AdPlatformPort
from app.integrations.base import IntegrationNotConfigured
from app.integrations.domains.fake import FakeDomains
from app.integrations.domains.port import DomainsPort
from app.integrations.llm.fake import FakeLLM
from app.integrations.llm.port import LLMPort
from app.integrations.llm.service import LLMService
from app.integrations.messaging.fake import FakeEmail, FakeSms
from app.integrations.messaging.port import EmailPort, SmsPort
from app.integrations.messaging.resend import ResendEmail
from app.integrations.payments.fake import FakePayments
from app.integrations.payments.port import PaymentsPort
from app.integrations.payments.stripe import StripePayments
from app.integrations.search_index.fake import FakeSearchIndex
from app.integrations.search_index.indexnow import IndexNow
from app.integrations.search_index.port import SearchIndexPort
from app.integrations.social.fake import FakeSocialPages
from app.integrations.social.port import SocialPagesPort
from app.integrations.storage.fake import FakeStorage
from app.integrations.storage.port import StoragePort
from app.integrations.whatsapp.fake import FakeWhatsApp
from app.integrations.whatsapp.port import WhatsAppPort


@dataclass(frozen=True, slots=True)
class Integrations:
    llm: LLMPort
    whatsapp: WhatsAppPort
    meta_ads: AdPlatformPort
    google_ads: AdPlatformPort
    social: SocialPagesPort
    storage: StoragePort
    email: EmailPort
    sms: SmsPort
    search_index: SearchIndexPort
    domains: DomainsPort
    payments: PaymentsPort
    is_fake: bool

    def llm_service(self, model: str) -> LLMService:
        return LLMService(self.llm, model)


def fake_integrations() -> Integrations:
    return Integrations(
        llm=FakeLLM(),
        whatsapp=FakeWhatsApp(),
        meta_ads=FakeAdPlatform(AdPlatform.META),
        google_ads=FakeAdPlatform(AdPlatform.GOOGLE),
        social=FakeSocialPages(),
        storage=FakeStorage(),
        email=FakeEmail(),
        sms=FakeSms(),
        search_index=FakeSearchIndex(),
        domains=FakeDomains(),
        payments=FakePayments(),
        is_fake=True,
    )


def build_integrations(settings: Settings) -> Integrations:
    if settings.fake_integrations:
        fakes = replace(
            fake_integrations(),
            search_index=build_search_index(settings),
            payments=build_payments(settings),
        )
        # Per-integration opt-in: a real adapter replaces its fake as soon as it has credentials.
        if settings.email_api_key:
            return replace(
                fakes,
                email=ResendEmail(settings.email_api_key.get_secret_value(), settings.email_from),
            )
        return fakes
    raise IntegrationNotConfigured(
        "Real integration adapters are not implemented yet; set FAKE_INTEGRATIONS=true."
    )


def build_search_index(settings: Settings) -> SearchIndexPort:
    """IndexNow has its own flag: it can be on while the other adapters are still fake."""
    if not settings.indexnow_enabled:
        return FakeSearchIndex()
    if not settings.indexnow_key:
        raise IntegrationNotConfigured("INDEXNOW_ENABLED=true needs INDEXNOW_KEY.")
    return IndexNow(settings.indexnow_key)


def build_payments(settings: Settings) -> PaymentsPort:
    """Stripe as soon as it has a key (test keys outside production); otherwise the fake."""
    if settings.stripe_secret_key and settings.stripe_webhook_secret:
        return StripePayments(
            settings.stripe_secret_key.get_secret_value(),
            settings.stripe_webhook_secret.get_secret_value(),
            api_version=settings.stripe_api_version,
        )
    return FakePayments(
        checkout_base=f"{settings.app_url}/api/v1/dev/payments/checkout",
        prices=paid_price_cents(),
    )


def get_integrations(request: Request) -> Integrations:
    """FastAPI dependency."""
    integrations: Integrations = request.app.state.integrations
    return integrations
