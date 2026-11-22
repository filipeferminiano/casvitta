"""Application settings, read from environment variables (see .env.example at the repo root)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Development only; production refuses to start with it (see _production_secrets).
DEV_JWT_SECRET = "dev-only-jwt-secret-change-me-in-production"  # noqa: S105

_PARENTS = Path(__file__).resolve().parents
# apps/api/app/core/settings.py -> repo root. The container image is shallower (/srv/app/...)
# and has no .env file: settings come from the environment there.
REPO_ROOT = _PARENTS[4] if len(_PARENTS) > 4 else _PARENTS[-1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(REPO_ROOT / ".env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: Literal["development", "test", "production"] = "development"
    log_level: str = "INFO"
    log_json: bool = False

    database_url: str = "postgresql+asyncpg://casvitta:casvitta@localhost:5432/casvitta"
    test_database_url: str = "postgresql+asyncpg://casvitta:casvitta@localhost:5432/casvitta_test"
    # Managed Postgres (Supabase session pooler) needs TLS and a small pool: the Micro
    # tier allows few pooled connections and Cloud Run may run more than one instance.
    database_ssl_require: bool = False
    # All tables live in this Postgres schema (the Supabase project is shared with other apps,
    # so nothing goes to public). Set as search_path on every connection.
    database_schema: str = Field(default="casvitta", pattern=r"^[a-z_][a-z0-9_]*$")
    database_pool_size: int = 5
    database_max_overflow: int = 2
    redis_url: str = "redis://localhost:6379/0"
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://app.localhost:3000"]
    )
    jwt_secret: SecretStr = SecretStr(DEV_JWT_SECRET)

    # Sign-in. Links in emails point to the marketplace host; the app host gets its session
    # through a one-time handoff code. Browsers call the API same-origin under /api/v1.
    site_url: str = "http://localhost:3000"
    app_url: str = "http://app.localhost:3000"
    cookie_path_prefix: str = "/api"
    cookie_secure: bool = False
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 30
    login_link_ttl_minutes: int = 15
    handoff_ttl_seconds: int = 60
    auth_rate_limit_per_minute: int = 5

    # Integrations: fake adapters unless explicitly disabled AND credentials exist.
    fake_integrations: bool = True
    anthropic_api_key: SecretStr | None = None
    llm_model: str = "claude-sonnet-5-5"
    whatsapp_access_token: SecretStr | None = None
    whatsapp_phone_number_id: str | None = None
    whatsapp_verify_token: SecretStr | None = None
    meta_app_id: str | None = None
    meta_app_secret: SecretStr | None = None
    meta_access_token: SecretStr | None = None
    google_ads_developer_token: SecretStr | None = None
    google_ads_client_id: str | None = None
    google_ads_client_secret: SecretStr | None = None
    google_ads_refresh_token: SecretStr | None = None
    storage_bucket: str | None = None
    storage_endpoint_url: str | None = None
    storage_access_key_id: str | None = None
    storage_secret_access_key: SecretStr | None = None
    email_from: str = "Casvitta <nao-responda@casvitta.com.br>"
    email_api_key: SecretStr | None = None
    sms_api_key: SecretStr | None = None
    # IndexNow (Bing and others). Real calls only when enabled with a key; the same key must be
    # set on the web app, which serves it at /indexnow-key.txt. Not a secret: it is public.
    indexnow_enabled: bool = False
    indexnow_key: str | None = Field(default=None, pattern=r"^[A-Za-z0-9-]{8,128}$")
    indexnow_root_domain: str = "casvitta.com.br"

    # Backoffice (staff). Its own host, token audience, cookies and short sessions.
    admin_url: str = "http://admin.localhost:3000"
    staff_access_token_ttl_minutes: int = 10
    staff_idle_minutes: int = 60  # a refresh token unused this long is dead
    staff_session_max_hours: int = 8  # absolute: sign in again after this
    staff_reauth_minutes: int = 15  # sensitive actions need a proof of identity this recent
    staff_reauth_code_ttl_minutes: int = 10
    staff_reauth_max_attempts: int = 5
    backoffice_environment: Literal["production", "staging", "development"] = "development"
    # Modules switched on in the backoffice. A module without data stays off (honest empty
    # state); "moderation" waits for listings, "revenue" for billing.
    backoffice_modules: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["overview", "creci", "captures", "accounts", "team"]
    )
    # Listing moderation (BO6) thresholds: price this far (%) from the comparables' median goes to
    # a person; fewer comparables than this and price is not judged (as with estimates, rule 12);
    # photos with more than this share of text go to a person.
    moderation_price_deviation_pct: int = 25
    moderation_min_comparables: int = 5
    moderation_max_photo_text_ratio: float = 0.15
    # Owner requests go back to the queue when the broker does not accept within this time.
    capture_assignment_timeout_hours: int = 24
    # CRECI review promise shown at sign-up ("1 dia útil"): older requests get the SLA badge.
    creci_review_sla_hours: int = 24
    # Public lookup of each regional council, opened from BO2. Only addresses someone checked;
    # a state without one shows the instruction without a link. JSON in the environment.
    creci_lookup_urls: dict[str, str] = Field(
        default_factory=lambda: {
            "SP": "https://www.crecisp.gov.br/",
            "ES": "https://crecies.gov.br/profissional-regularizado",
        }
    )

    # Shared token for scripts and CI only (staff use their own accounts). Accepted only while
    # admin_token_enabled is on; audited as "system:admin-token".
    admin_token: SecretStr | None = None
    admin_token_enabled: bool = False
    # End-to-end tests only: GET /v1/dev/outbox shows the emails the fake adapter "sent", so a
    # browser test can open sign-in links. Refused in production.
    dev_outbox_enabled: bool = False
    # Minimum photos before a property can be published (CRM mockup 04).
    listing_min_photos: int = 5
    # Show is_demo listings on public pages. Local demos only; production refuses it (rule 7).
    public_listings_include_demo: bool = False
    # Casvitta Social: the broker page goes live only with a verified CRECI (CLAUDE.md rule 1).
    # False = the page is public as soon as the broker publishes it, with the CRECI they sent;
    # properties still need the verified CRECI (PROMPT_SOCIAL_BUILD §2).
    page_requires_verified_creci: bool = True
    # Public page events (views, WhatsApp clicks): requests per IP per minute.
    page_events_rate_limit_per_minute: int = 60
    page_inquiries_rate_limit_per_hour: int = 10
    # Custom domains: brokers point a CNAME here; DNS errors show after this many hours.
    custom_domain_cname_target: str = "paginas.casvitta.com.br"
    custom_domain_dns_wait_hours: int = 48
    # Public interest form: requests per IP and kind per minute.
    interest_rate_limit_per_minute: int = 5

    # Business configuration. Money in integer cents, rates in basis points.
    # Plans, prices and limits live in app.core.catalog (one catalog, PROMPT_CRM_BUILD §1).
    # Annual prices are in the catalog but stay hidden until the owner confirms them
    # (CLAUDE.md: never shown as a promotion or discount).
    show_annual_prices: bool = False
    # False: plan changes are requests assigned by staff (audited). True: paid plans go through
    # Stripe Checkout (cards only); staff can still assign plans.
    billing_enabled: bool = False
    # Stripe (test keys outside production). Empty key = fake payments adapter.
    stripe_secret_key: SecretStr | None = None
    stripe_webhook_secret: SecretStr | None = None
    stripe_api_version: str | None = None  # None = the account's default version
    # Who may pay through Stripe while billing is being tried (emails, CSV). Empty = everyone.
    # Required in production with a test key: a public test card would otherwise buy plans.
    billing_allowed_emails: Annotated[list[str], NoDecode] = Field(default_factory=list)
    min_daily_budget_cents: int = 2_000
    financing_illustrative_annual_rate_bps: int = 1_150

    # Market data (ITBI, public price pages). Thresholds are privacy gates: below them a page
    # shows no numbers, is noindex and stays out of sitemaps.
    itbi_data_dir: str = "data/raw/itbi"
    # Raw source rows are an audit copy; keep them off in production (shared database disk).
    itbi_persist_raw: bool = True
    itbi_http_enabled: bool = False
    itbi_source_urls: Annotated[list[str], NoDecode] = Field(default_factory=list)
    # ITBI is paid weeks after the deed: rolling windows end this many months before the newest
    # complete payment month.
    market_window_lag_months: int = 1
    market_min_neighborhood_12m: int = 30
    market_min_street_36m: int = 5
    market_min_building_all: int = 5
    # Every published median (any page, band, month or comparable group) needs this many sales.
    market_min_price_group: int = 10
    # Below this many sales, show the median only (no p25/p75, no area range, year not month).
    market_min_for_ranges: int = 10
    market_round_value_cents: int = 100_000  # R$ 1.000
    market_round_price_m2_cents: int = 1_000  # R$ 10
    # Financing page defaults (rate comes from financing_illustrative_annual_rate_bps).
    market_down_payment_pct: int = 20
    market_min_down_payment_pct: int = 20  # below this the simulator shows a field error
    market_term_months: int = 360
    market_max_income_commitment_pct: int = 30
    # Valuation tool ("Quanto vale meu imóvel"): see app/domains/market_data/valuation.py.
    valuation_months: int = 24
    valuation_full_confidence_sales: int = 30
    valuation_high_spread_pct: int = 25
    valuation_medium_sales: int = 15
    valuation_medium_spread_pct: int = 40
    valuation_rate_limit_per_minute: int = 20
    # ITBI São Paulo. Rules must be reviewed by a person against current law before the page is
    # indexed (ITBI_SP_RULES_REVIEWED). The SFH limit has no default on purpose.
    itbi_sp_rate_bps: int = 300
    itbi_sp_sfh_rate_bps: int = 50
    itbi_sp_sfh_limit_cents: int | None = None
    itbi_sp_rules_effective_from: str = "2026-01-01"
    itbi_sp_rules_reviewed: bool = False
    # Registration (cartório) costs shown as an estimate range; hidden while unset.
    itbi_sp_registry_low_cents: int | None = None
    itbi_sp_registry_high_cents: int | None = None
    # Web cache revalidation after each refresh (empty URL = skip).
    web_revalidate_url: str = ""
    web_revalidate_secret: SecretStr | None = None

    @model_validator(mode="after")
    def _production_secrets(self) -> Settings:
        secret = self.jwt_secret.get_secret_value()
        if self.app_env == "production" and (secret == DEV_JWT_SECRET or len(secret) < 32):
            raise ValueError("JWT_SECRET must be set in production (32+ characters)")
        if self.app_env == "production" and self.dev_outbox_enabled:
            raise ValueError("DEV_OUTBOX_ENABLED is for end-to-end tests, never production")
        if self.app_env == "production" and self.public_listings_include_demo:
            raise ValueError("PUBLIC_LISTINGS_INCLUDE_DEMO never runs in production (rule 7)")
        if self.stripe_secret_key and not self.stripe_webhook_secret:
            raise ValueError("STRIPE_SECRET_KEY needs STRIPE_WEBHOOK_SECRET (webhook signatures)")
        if self.app_env == "production" and self.billing_enabled and not self.stripe_secret_key:
            raise ValueError("BILLING_ENABLED in production needs STRIPE_SECRET_KEY")
        test_key = self.stripe_secret_key and self.stripe_secret_key.get_secret_value().startswith(
            ("sk_test_", "rk_test_")
        )
        if (
            self.app_env == "production"
            and self.billing_enabled
            and test_key
            and not self.billing_allowed_emails
        ):
            raise ValueError("A Stripe test key in production needs BILLING_ALLOWED_EMAILS")
        return self

    @field_validator("database_url", "test_database_url", mode="before")
    @classmethod
    def _asyncpg_scheme(cls, value: object) -> object:
        """Accept the plain postgres:// URLs that hosting providers hand out."""
        if isinstance(value, str):
            for prefix in ("postgresql://", "postgres://"):
                if value.startswith(prefix):
                    return "postgresql+asyncpg://" + value.removeprefix(prefix)
        return value

    @field_validator("billing_allowed_emails", mode="after")
    @classmethod
    def _lower_emails(cls, value: list[str]) -> list[str]:
        return [v.strip().lower() for v in value if v.strip()]

    @field_validator(
        "cors_origins",
        "itbi_source_urls",
        "backoffice_modules",
        "billing_allowed_emails",
        mode="before",
    )
    @classmethod
    def _split_csv(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("indexnow_key", mode="before")
    @classmethod
    def _empty_is_unset(cls, value: object) -> object:
        """INDEXNOW_KEY= (as in .env.example) means no key."""
        return None if isinstance(value, str) and not value.strip() else value


@lru_cache
def get_settings() -> Settings:
    return Settings()
