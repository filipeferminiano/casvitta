"""Curated neighborhoods per city: names, aliases seen in the source, wave and adjacency.

Aliases are canonical spellings (see locate.canonical_neighborhood: no accents, VL -> VILA, …).
Everything not listed here is created from the data, with noindex until a person flips
``is_indexable``. Adjacency is hand-written for wave 1 (PostGIS later).
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class NeighborhoodSeed:
    slug: str
    name: str
    zone: str
    aliases: tuple[str, ...]
    wave: int | None = None
    neighbors: tuple[str, ...] = field(default_factory=tuple)
    preposition: str | None = None  # "na" / "no" / "em"; None: guessed from the name


SAO_PAULO: tuple[NeighborhoodSeed, ...] = (
    NeighborhoodSeed(
        "vila-mariana",
        "Vila Mariana",
        "sul",
        ("VILA MARIANA", "JARDIM VILA MARIANA"),
        wave=1,
        neighbors=("moema", "vila-clementino", "aclimacao", "saude"),
        preposition="na",
    ),
    NeighborhoodSeed(
        "moema",
        "Moema",
        "sul",
        ("MOEMA", "INDIANOPOLIS"),
        wave=1,
        neighbors=("vila-mariana", "vila-clementino", "campo-belo"),
        preposition="em",
    ),
    NeighborhoodSeed(
        "aclimacao",
        "Aclimação",
        "centro",
        ("ACLIMACAO",),
        wave=1,
        neighbors=("vila-mariana", "ipiranga"),
        preposition="na",
    ),
    NeighborhoodSeed(
        "vila-clementino",
        "Vila Clementino",
        "sul",
        ("VILA CLEMENTINO",),
        wave=1,
        neighbors=("vila-mariana", "moema", "saude"),
        preposition="na",
    ),
    # Bosque, Jardim and Vila da Saúde are separate neighborhoods, not aliases of Saúde.
    NeighborhoodSeed(
        "saude",
        "Saúde",
        "sul",
        ("SAUDE",),
        wave=1,
        neighbors=("vila-mariana", "vila-clementino", "ipiranga"),
        preposition="na",
    ),
    NeighborhoodSeed(
        "campo-belo",
        "Campo Belo",
        "sul",
        ("CAMPO BELO", "VILA CAMPO BELO"),
        wave=1,
        neighbors=("moema",),
        preposition="no",
    ),
    NeighborhoodSeed(
        "ipiranga",
        "Ipiranga",
        "sul",
        ("IPIRANGA",),
        wave=1,
        neighbors=("aclimacao", "saude"),
        preposition="no",
    ),
    # Separate neighborhoods ("Jardins" is only a display grouping).
    NeighborhoodSeed(
        "jardim-paulista", "Jardim Paulista", "oeste", ("JARDIM PAULISTA",), preposition="no"
    ),
    NeighborhoodSeed(
        "cerqueira-cesar", "Cerqueira César", "oeste", ("CERQUEIRA CESAR",), preposition="em"
    ),
    NeighborhoodSeed(
        "bosque-da-saude", "Bosque da Saúde", "sul", ("BOSQUE DA SAUDE",), preposition="no"
    ),
    NeighborhoodSeed(
        "jardim-da-saude", "Jardim da Saúde", "sul", ("JARDIM DA SAUDE",), preposition="no"
    ),
    NeighborhoodSeed("vila-da-saude", "Vila da Saúde", "sul", ("VILA DA SAUDE",), preposition="na"),
)

SEEDS: dict[str, tuple[NeighborhoodSeed, ...]] = {"sao-paulo": SAO_PAULO}


FEMININE_STARTS = (
    "Vila ",
    "Chácara ",
    "Chacara ",
    "Cidade ",
    "Água ",
    "Agua ",
    "Fazenda ",
    "Granja ",
)
MASCULINE_STARTS = ("Jardim ", "Parque ", "Conjunto ", "Sítio ", "Sitio ", "Alto ", "Bairro ")


def guess_preposition(name: str) -> str:
    """Conservative: "na"/"no" only for unambiguous first words, otherwise "em"."""
    if name.startswith(FEMININE_STARTS):
        return "na"
    if name.startswith(MASCULINE_STARTS):
        return "no"
    return "em"
