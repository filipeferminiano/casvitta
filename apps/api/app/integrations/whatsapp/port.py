from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Protocol


@dataclass(frozen=True, slots=True)
class OutboundReceipt:
    external_id: str
    sent_at: datetime


@dataclass(frozen=True, slots=True)
class TemplateMessage:
    """Approved WhatsApp template, required outside the 24-hour customer service window."""

    name: str
    language: str = "pt_BR"
    parameters: tuple[str, ...] = field(default_factory=tuple)


class WhatsAppPort(Protocol):
    async def send_text(self, to_e164: str, body: str) -> OutboundReceipt: ...

    async def send_template(self, to_e164: str, template: TemplateMessage) -> OutboundReceipt: ...
