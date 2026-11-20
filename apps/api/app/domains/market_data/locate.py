"""Neighborhood of each cleaned row (pure functions).

The source "Bairro" is empty in ~40 % of rows and sometimes holds building names. So:
1. canonicalize the raw value and resolve it through curated aliases, then through neighborhoods
   learned from the data (a spelling becomes a neighborhood once it is seen often enough);
2. vote: for each CEP, the neighborhood most rows with a resolved Bairro point to;
3. rows without a resolvable Bairro take their CEP's winner; the rest go to a review report.
"""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from collections.abc import Iterable
from dataclasses import dataclass, field

from app.domains.market_data.seeds import NeighborhoodSeed
from app.integrations.itbi.layouts import normalize_text

ABBREVIATIONS = {
    "VL": "VILA",
    "V": "VILA",
    "JD": "JARDIM",
    "JDM": "JARDIM",
    "JAR": "JARDIM",
    "PQ": "PARQUE",
    "PQUE": "PARQUE",
    "CHAC": "CHACARA",
    "CH": "CHACARA",
    "STA": "SANTA",
    "STO": "SANTO",
    "S": "SAO",
    "N": "NOSSA",
    "SRA": "SENHORA",
    "CID": "CIDADE",
    "CJ": "CONJUNTO",
    "CONJ": "CONJUNTO",
    "SAO": "SAO",
}
# A value that starts like this is a building or unit, not a neighborhood.
BUILDING_PREFIXES = (
    "COND",
    "CONDOMINIO",
    "CD",
    "ED",
    "EDIF",
    "EDIFICIO",
    "RES",
    "RESIDENCIAL",
    "BLOCO",
    "BL",
    "TORRE",
    "SETOR",
    "PISO",
    "AP",
    "APTO",
    "LOJA",
    "SALA",
    "CASA",
    "LOTE",
    "QUADRA",
    "PREDIO",
)
MIN_LEARNED_ROWS = 20  # a spelling seen at least this often becomes a neighborhood


def canonical_neighborhood(raw: str) -> str:
    """'VL. MARIANA' -> 'VILA MARIANA'; 'JD DA SAUDE' -> 'JARDIM DA SAUDE'."""
    text = re.sub(r"[^A-Z0-9 ]", " ", normalize_text(raw))
    words = text.split()
    return " ".join(ABBREVIATIONS.get(w, w) for w in words)


def looks_like_building(canonical: str) -> bool:
    words = canonical.split()
    if not words:
        return True
    return words[0] in BUILDING_PREFIXES or any(ch.isdigit() for ch in canonical)


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", normalize_text(text).lower()).strip("-")


def display_name(canonical: str) -> str:
    """'VILA DA SAUDE' -> 'Vila da Saude' (the source has no accents; curated names do)."""
    small = {"DA", "DE", "DO", "DAS", "DOS", "E"}
    words = canonical.split()
    return " ".join(w.lower() if i and w in small else w.capitalize() for i, w in enumerate(words))


@dataclass(slots=True)
class NeighborhoodResolver:
    """Maps canonical spellings to neighborhood slugs; learns new ones from the data."""

    alias_to_slug: dict[str, str]
    names: dict[str, str]  # slug -> display name
    learned: set[str] = field(default_factory=set)

    @classmethod
    def from_seeds(cls, seeds: Iterable[NeighborhoodSeed]) -> NeighborhoodResolver:
        aliases: dict[str, str] = {}
        names: dict[str, str] = {}
        for seed in seeds:
            names[seed.slug] = seed.name
            for alias in seed.aliases:
                aliases[canonical_neighborhood(alias)] = seed.slug
        return cls(aliases, names)

    def learn(self, spelling_counts: Counter[str]) -> None:
        """Turn frequent, non-building spellings into neighborhoods."""
        for canonical, count in spelling_counts.items():
            if canonical in self.alias_to_slug or count < MIN_LEARNED_ROWS:
                continue
            if looks_like_building(canonical) or len(canonical) < 3:
                continue
            slug = slugify(canonical)
            if slug in self.names and self.names[slug] != display_name(canonical):
                continue  # would collide with a curated neighborhood under another spelling
            self.alias_to_slug[canonical] = slug
            self.names.setdefault(slug, display_name(canonical))
            self.learned.add(slug)

    def resolve(self, raw: str) -> str | None:
        return self.alias_to_slug.get(canonical_neighborhood(raw)) if raw.strip() else None


def cep_majority(votes: dict[str, Counter[str]]) -> dict[str, str]:
    """CEP -> neighborhood with the most votes; ties are left unresolved."""
    result: dict[str, str] = {}
    for cep, counter in votes.items():
        ranked = counter.most_common(2)
        if not ranked:
            continue
        if len(ranked) == 2 and ranked[0][1] == ranked[1][1]:
            continue
        result[cep] = ranked[0][0]
    return result


@dataclass(slots=True)
class LocationIndex:
    """Collects votes while streaming, then resolves rows."""

    resolver: NeighborhoodResolver
    spellings: Counter[str] = field(default_factory=Counter)
    _raw_votes: dict[str, Counter[str]] = field(default_factory=lambda: defaultdict(Counter))
    _cep_map: dict[str, str] = field(default_factory=dict)

    def observe(self, cep: str, neighborhood_raw: str) -> None:
        """Any source row with a CEP and a Bairro (any nature) is evidence for the CEP vote."""
        canonical = canonical_neighborhood(neighborhood_raw)
        if not canonical or not cep:
            return
        self.spellings[canonical] += 1
        self._raw_votes[cep][canonical] += 1

    def build(self) -> None:
        self.resolver.learn(self.spellings)
        votes: dict[str, Counter[str]] = defaultdict(Counter)
        for cep, counter in self._raw_votes.items():
            for canonical, count in counter.items():
                slug = self.resolver.alias_to_slug.get(canonical)
                if slug:
                    votes[cep][slug] += count
        self._cep_map = cep_majority(votes)

    def locate(self, cep: str, neighborhood_raw: str) -> str | None:
        return self.resolver.resolve(neighborhood_raw) or self._cep_map.get(cep)

    @property
    def cep_map(self) -> dict[str, str]:
        return dict(self._cep_map)
