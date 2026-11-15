"""Server-side user messages. Error codes are English; messages shown to users are pt-BR."""

from __future__ import annotations

import json
from collections.abc import Mapping
from functools import lru_cache
from pathlib import Path

DEFAULT_LOCALE = "pt-BR"
_MESSAGES_DIR = Path(__file__).parent / "messages"


@lru_cache
def _catalog(locale: str) -> dict[str, str]:
    data: dict[str, str] = json.loads((_MESSAGES_DIR / f"{locale}.json").read_text("utf-8"))
    return data


def translate(
    key: str, params: Mapping[str, object] | None = None, locale: str = DEFAULT_LOCALE
) -> str:
    catalog = _catalog(locale)
    template = catalog.get(key) or catalog["internal_error"]
    try:
        return template.format(**(params or {}))
    except (KeyError, IndexError):
        return template
