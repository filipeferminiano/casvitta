from __future__ import annotations

import uuid
from dataclasses import dataclass

from app.core.time import utcnow
from app.integrations.whatsapp.port import OutboundReceipt, TemplateMessage


@dataclass(frozen=True, slots=True)
class SentWhatsApp:
    to_e164: str
    body: str | None
    template: TemplateMessage | None
    receipt: OutboundReceipt


class FakeWhatsApp:
    """Records outbound messages instead of sending them.

    `delivers_messages=True` makes it stand in for a real adapter in tests.
    """

    def __init__(self, *, delivers_messages: bool = False) -> None:
        self.outbox: list[SentWhatsApp] = []
        self.delivers_messages = delivers_messages

    def _receipt(self) -> OutboundReceipt:
        return OutboundReceipt(external_id=f"wamid.fake.{uuid.uuid4().hex}", sent_at=utcnow())

    async def send_text(self, to_e164: str, body: str) -> OutboundReceipt:
        receipt = self._receipt()
        self.outbox.append(SentWhatsApp(to_e164, body, None, receipt))
        return receipt

    async def send_template(self, to_e164: str, template: TemplateMessage) -> OutboundReceipt:
        receipt = self._receipt()
        self.outbox.append(SentWhatsApp(to_e164, None, template, receipt))
        return receipt
