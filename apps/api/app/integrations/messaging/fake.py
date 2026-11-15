from __future__ import annotations

import uuid

from app.integrations.messaging.port import Email


class FakeEmail:
    def __init__(self) -> None:
        self.outbox: list[Email] = []

    async def send(self, email: Email) -> str:
        self.outbox.append(email)
        return f"email-fake-{uuid.uuid4().hex[:12]}"


class FakeSms:
    def __init__(self) -> None:
        self.outbox: list[tuple[str, str]] = []

    async def send(self, to_e164: str, body: str) -> str:
        self.outbox.append((to_e164, body))
        return f"sms-fake-{uuid.uuid4().hex[:12]}"
