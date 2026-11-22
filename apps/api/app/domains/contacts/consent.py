"""Consent rules (CLAUDE.md rule 8, PROMPT_CRM_BUILD product rules). Pure where possible.

- Per channel × purpose; the newest record wins; never pre-checked (callers only send ticked).
- "SAIR" (and variants) revokes marketing on that channel at once, and contact about properties
  too: the person asked to stop.
- Quiet hours and the weekly cap for marketing are enforced at send time (CRM-2 delivery).
"""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Iterable
from dataclasses import dataclass

from app.domains.contacts.models import Channel, Consent, ConsentPurpose, ConsentStatus

_OPT_OUT = re.compile(r"^\s*(sair|parar|pare|cancelar|descadastrar|stop)\s*[.!]*\s*$")


def is_opt_out(text: str) -> bool:
    folded = unicodedata.normalize("NFD", text).encode("ascii", "ignore").decode().lower()
    return bool(_OPT_OUT.match(folded))


@dataclass(frozen=True, slots=True)
class Current:
    status: ConsentStatus | None
    record: Consent | None


def current(records: Iterable[Consent], channel: Channel, purpose: ConsentPurpose) -> Current:
    mine = [r for r in records if r.channel == channel and r.purpose == purpose]
    latest = max(mine, key=lambda r: r.occurred_at, default=None)
    return Current(latest.status if latest else None, latest)


def allows(records: Iterable[Consent], channel: Channel, purpose: ConsentPurpose) -> bool:
    return current(list(records), channel, purpose).status == ConsentStatus.GRANTED


def summary(records: Iterable[Consent], channel: Channel) -> str:
    """'granted' when any purpose is granted, 'revoked' when the last word was no, else 'none'."""
    items = list(records)
    states = [current(items, channel, p).status for p in ConsentPurpose]
    if ConsentStatus.GRANTED in states:
        return "granted"
    if ConsentStatus.REVOKED in states:
        return "revoked"
    return "none"
