"""Transactional email (magic links, reports) and SMS (phone OTP)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class Email:
    to: str
    subject: str
    text: str
    html: str | None = None


class EmailPort(Protocol):
    async def send(self, email: Email) -> str: ...


class SmsPort(Protocol):
    async def send(self, to_e164: str, body: str) -> str: ...
