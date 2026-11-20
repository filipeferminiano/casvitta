"""Street and building names, building grouping and stable slugs (pure functions)."""

from __future__ import annotations

import re
from collections import Counter
from collections.abc import Iterable

from app.domains.market_data.locate import slugify
from app.integrations.itbi.layouts import normalize_text

STREET_TYPES = {
    "R": "Rua",
    "RUA": "Rua",
    "AV": "Avenida",
    "AVENIDA": "Avenida",
    "AL": "Alameda",
    "ALAMEDA": "Alameda",
    "PC": "Praça",
    "PCA": "Praça",
    "PRC": "Praça",
    "PRACA": "Praça",
    "TV": "Travessa",
    "TRAV": "Travessa",
    "EST": "Estrada",
    "ESTR": "Estrada",
    "LG": "Largo",
    "VD": "Viaduto",
    "PSG": "Passagem",
    "VIA": "Via",
}
TITLE_ABBREVIATIONS = {
    "DR": "Doutor",
    "PROF": "Professor",
    "PROFA": "Professora",
    "ENG": "Engenheiro",
    "GEN": "General",
    "CEL": "Coronel",
    "CAP": "Capitão",
    "MAL": "Marechal",
    "STA": "Santa",
    "STO": "Santo",
    "S": "São",
    "PE": "Padre",
    "DES": "Desembargador",
    "BRIG": "Brigadeiro",
    "CONS": "Conselheiro",
    "SEN": "Senador",
    "DEP": "Deputado",
    "MIN": "Ministro",
    "PRES": "Presidente",
    "VER": "Vereador",
}
SMALL_WORDS = {"DA", "DE", "DO", "DAS", "DOS", "E", "D"}
BUILDING_NAME_PREFIXES = {
    "COND": "Condomínio",
    "CONDOMINIO": "Condomínio",
    "CD": "Condomínio",
    "ED": "Edifício",
    "EDIF": "Edifício",
    "EDIFICIO": "Edifício",
    "RES": "Residencial",
    "RESIDENCIAL": "Residencial",
}


def _title(words: Iterable[str], *, after_prefix: bool = False) -> str:
    """Title case; particles stay lower unless they open the name."""
    out: list[str] = []
    for index, word in enumerate(words):
        if (index or after_prefix) and word in SMALL_WORDS:
            out.append(word.lower())
        elif word in TITLE_ABBREVIATIONS:
            out.append(TITLE_ABBREVIATIONS[word])
        else:
            out.append(word.capitalize())
    return " ".join(out)


def street_display_name(street_key: str) -> str:
    """'R DOMINGOS DE MORAIS' -> 'Rua Domingos de Morais'; 'AV PROF NOE AZEVEDO' -> 'Avenida
    Professor Noe Azevedo' (the source has no accents)."""
    words = re.sub(r"[^A-Z0-9 ]", " ", normalize_text(street_key)).split()
    if not words:
        return ""
    if words[0] in STREET_TYPES:
        return " ".join([STREET_TYPES[words[0]], _title(words[1:], after_prefix=True)]).strip()
    return _title(words)


def street_slug(name: str) -> str:
    return slugify(name)


def building_key(block: str, street_key: str, street_number: int) -> str:
    """setor + quadra + street + number: one building."""
    return f"{block}|{street_key}|{street_number}"


def clean_building_reference(raw: str) -> str | None:
    """'COND MAISON BLANCHE' -> 'Condomínio Maison Blanche'; None if not a building name."""
    words = re.sub(r"[^A-Z0-9 ]", " ", normalize_text(raw)).split()
    if len(words) < 2 or words[0] not in BUILDING_NAME_PREFIXES:
        return None
    rest = words[1:]
    if rest and rest[0] in BUILDING_NAME_PREFIXES:  # "COND ED POESIA"
        rest = rest[1:]
    if not rest:
        return None
    return f"{BUILDING_NAME_PREFIXES[words[0]]} {_title(rest, after_prefix=True)}"


def building_display_name(
    references: Counter[str], street_name: str, street_number: int
) -> tuple[str, bool]:
    """(name, from_reference). Most frequent building-like reference, else an address name."""
    named: Counter[str] = Counter()
    for raw, count in references.items():
        cleaned = clean_building_reference(raw)
        if cleaned:
            named[cleaned] += count
    if named:
        # Ties break alphabetically so the name is stable between runs.
        best = sorted(named.items(), key=lambda kv: (-kv[1], kv[0]))[0][0]
        return best, True
    return f"Edifício na {street_name}, {street_number}", False


def unique_slug(base: str, taken: set[str]) -> str:
    """base, base-2, base-3 … not in ``taken`` (``taken`` is updated)."""
    slug = base or "sem-nome"
    candidate, n = slug, 2
    while candidate in taken:
        candidate = f"{slug}-{n}"
        n += 1
    taken.add(candidate)
    return candidate


def mode(values: Iterable[int | None]) -> int | None:
    counter = Counter(v for v in values if v is not None)
    if not counter:
        return None
    return sorted(counter.items(), key=lambda kv: (-kv[1], kv[0]))[0][0]
