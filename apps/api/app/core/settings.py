"""Application settings, read from environment variables (see .env.example at the repo root)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

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
    database_pool_size: int = 5
    database_max_overflow: int = 2
    redis_url: str = "redis://localhost:6379/0"
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://app.localhost:3000"]
    )
    jwt_secret: SecretStr = SecretStr("change-me-in-production")

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

    # Admin endpoints until real auth exists (Milestone 1). Unset = admin endpoints disabled.
    admin_token: SecretStr | None = None
    # Public interest form: requests per IP and kind per minute.
    interest_rate_limit_per_minute: int = 5

    # Business configuration. Money in integer cents, rates in basis points.
    plan_essencial_price_cents: int = 19_700
    plan_essencial_max_active_properties: int = 3
    plan_profissional_price_cents: int = 39_700
    plan_profissional_max_active_properties: int = 15
    min_daily_budget_cents: int = 2_000
    financing_illustrative_annual_rate_bps: int = 1_150

    @field_validator("database_url", "test_database_url", mode="before")
    @classmethod
    def _asyncpg_scheme(cls, value: object) -> object:
        """Accept the plain postgres:// URLs that hosting providers hand out."""
        if isinstance(value, str):
            for prefix in ("postgresql://", "postgres://"):
                if value.startswith(prefix):
                    return "postgresql+asyncpg://" + value.removeprefix(prefix)
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_csv(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
