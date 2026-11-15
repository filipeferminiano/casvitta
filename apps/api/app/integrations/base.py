"""Shared types for integration ports and adapters.

Every third-party service is reached only through a port (a Protocol) in this package. Each port
has a fake adapter used in development and tests; real adapters are added behind a feature flag.
Routers and services never call a third-party API directly.
"""

from __future__ import annotations

from app.core.errors import AppError


class IntegrationError(AppError):
    """A third-party call failed. ``integration`` names the service for the pt-BR message."""

    def __init__(self, integration: str, detail: str = "") -> None:
        super().__init__("integration_unavailable", status_code=503, integration=integration)
        self.detail = detail


class IntegrationNotConfigured(RuntimeError):
    """Real adapter requested but not available or missing credentials."""
