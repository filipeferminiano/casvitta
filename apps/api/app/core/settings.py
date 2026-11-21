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

    # Admin endpoints until real auth exists (Milestone 1). Unset = admin endpoints disabled.
    admin_token: SecretStr | None = None
    # Public interest form: requests per IP and kind per minute.
    interest_rate_limit_per_minute: int = 5

    # Business configuration. Money in integer cents, rates in basis points.
    # Offer catalog (hypotheses, nov/2026). Mirrors apps/web/src/config/site.ts OFFERS; nothing
    # in the API charges yet: these are for the ledger and backoffice. None = "sob consulta".
    offer_owner_30d_price_cents: int = 5_900
    offer_owner_90d_price_cents: int = 14_900
    offer_broker_price_cents: int = 9_900
    offer_broker_max_active_properties: int = 50
    offer_broker_max_users: int = 1
    offer_agency_essencial_price_cents: int = 29_900
    offer_agency_essencial_max_active_properties: int = 200
    offer_agency_essencial_max_users: int = 5
    offer_agency_equipe_price_cents: int = 49_900
    offer_agency_equipe_max_active_properties: int = 500
    offer_agency_equipe_max_users: int = 15
    # Highlight (destaque) price is not defined yet; never shown as a number while None.
    offer_highlight_price_cents: int | None = None
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
    market_min_street_36m: int = 10
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

    @field_validator("cors_origins", "itbi_source_urls", mode="before")
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
