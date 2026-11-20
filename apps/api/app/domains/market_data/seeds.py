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


SAO_PAULO: tuple[NeighborhoodSeed, ...] = (
    NeighborhoodSeed(
        "vila-mariana",
        "Vila Mariana",
        "sul",
        ("VILA MARIANA", "JARDIM VILA MARIANA"),
        wave=1,
        neighbors=("moema", "vila-clementino", "aclimacao", "saude"),
    ),
    NeighborhoodSeed(
        "moema",
        "Moema",
        "sul",
        ("MOEMA", "INDIANOPOLIS"),
        wave=1,
        neighbors=("vila-mariana", "vila-clementino", "campo-belo"),
    ),
    NeighborhoodSeed(
        "aclimacao",
        "Aclimação",
        "centro",
        ("ACLIMACAO",),
        wave=1,
        neighbors=("vila-mariana", "ipiranga"),
    ),
    NeighborhoodSeed(
        "vila-clementino",
        "Vila Clementino",
        "sul",
        ("VILA CLEMENTINO",),
        wave=1,
        neighbors=("vila-mariana", "moema", "saude"),
    ),
    # Bosque, Jardim and Vila da Saúde are separate neighborhoods, not aliases of Saúde.
    NeighborhoodSeed(
        "saude",
        "Saúde",
        "sul",
        ("SAUDE",),
        wave=1,
        neighbors=("vila-mariana", "vila-clementino", "ipiranga"),
    ),
    NeighborhoodSeed(
        "campo-belo",
        "Campo Belo",
        "sul",
        ("CAMPO BELO", "VILA CAMPO BELO"),
        wave=1,
        neighbors=("moema",),
    ),
    NeighborhoodSeed(
        "ipiranga",
        "Ipiranga",
        "sul",
        ("IPIRANGA",),
        wave=1,
        neighbors=("aclimacao", "saude"),
    ),
    # Separate neighborhoods ("Jardins" is only a display grouping).
    NeighborhoodSeed("jardim-paulista", "Jardim Paulista", "oeste", ("JARDIM PAULISTA",)),
    NeighborhoodSeed("cerqueira-cesar", "Cerqueira César", "oeste", ("CERQUEIRA CESAR",)),
    NeighborhoodSeed("bosque-da-saude", "Bosque da Saúde", "sul", ("BOSQUE DA SAUDE",)),
    NeighborhoodSeed("jardim-da-saude", "Jardim da Saúde", "sul", ("JARDIM DA SAUDE",)),
    NeighborhoodSeed("vila-da-saude", "Vila da Saúde", "sul", ("VILA DA SAUDE",)),
)

SEEDS: dict[str, tuple[NeighborhoodSeed, ...]] = {"sao-paulo": SAO_PAULO}
