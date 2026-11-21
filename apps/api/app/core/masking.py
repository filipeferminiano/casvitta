"""Masked personal data for staff lists (LGPD). The full value is a separate, audited request."""

from __future__ import annotations

_DOT = "·"  # middle dot, as in the backoffice mockups: "(11) 9····-··12"


def mask_phone(e164: str | None) -> str | None:
    """'+5511927408912' -> '(11) 9····-··12'. Keeps area code, first and last two digits."""
    if not e164:
        return None
    digits = e164.removeprefix("+55") if e164.startswith("+55") else e164.lstrip("+")
    if len(digits) < 6:
        return _DOT * 4
    area, number = digits[:2], digits[2:]
    hidden = len(number) - 3
    middle = _DOT * max(hidden - 2, 1) + "-" + _DOT * 2
    return f"({area}) {number[0]}{middle}{number[-2:]}"


def mask_email(email: str | None) -> str | None:
    """'ana.ribeiro@exemplo.com' -> 'ana.ribeiro@…' (the mailbox name is not the secret part)."""
    if not email:
        return None
    local, _, _domain = email.partition("@")
    return f"{local[:12]}@…"
