"""Resend (resend.com) adapter for transactional email. Used when EMAIL_API_KEY is set."""

from __future__ import annotations

import httpx

from app.core.logging import get_logger
from app.integrations.base import IntegrationError
from app.integrations.messaging.port import Email

log = get_logger(__name__)

API_URL = "https://api.resend.com/emails"


class ResendEmail:
    def __init__(self, api_key: str, sender: str, client: httpx.AsyncClient | None = None) -> None:
        self._api_key = api_key
        self._sender = sender
        self._client = client or httpx.AsyncClient(timeout=10)

    async def send(self, email: Email) -> str:
        body: dict[str, object] = {
            "from": self._sender,
            "to": [email.to],
            "subject": email.subject,
            "text": email.text,
        }
        if email.html:
            body["html"] = email.html
        try:
            response = await self._client.post(
                API_URL, json=body, headers={"Authorization": f"Bearer {self._api_key}"}
            )
        except httpx.HTTPError as exc:
            raise IntegrationError("de e-mail", str(exc)) from exc
        if response.status_code >= 400:
            # Never log the recipient address (personal data); the status is enough to debug.
            log.error("email_send_failed", status=response.status_code)
            raise IntegrationError("de e-mail", f"status {response.status_code}")
        message_id: str = response.json().get("id", "")
        return message_id
