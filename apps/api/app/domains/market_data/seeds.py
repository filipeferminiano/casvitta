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
        "jardim-paulista",
        "Jardim Paulista",
        "oeste",
        ("JARDIM PAULISTA",),
        wave=2,
        preposition="no",
    ),
    NeighborhoodSeed(
        "cerqueira-cesar",
        "Cerqueira César",
        "oeste",
        ("CERQUEIRA CESAR",),
        wave=2,
        preposition="no",
    ),
    NeighborhoodSeed(
        "bosque-da-saude", "Bosque da Saúde", "sul", ("BOSQUE DA SAUDE",), preposition="no"
    ),
    NeighborhoodSeed(
        "jardim-da-saude", "Jardim da Saúde", "sul", ("JARDIM DA SAUDE",), preposition="no"
    ),
    NeighborhoodSeed("vila-da-saude", "Vila da Saúde", "sul", ("VILA DA SAUDE",), preposition="na"),
)

# Wave 2 (21/11/2026): neighborhoods with 300+ sales in 12 months. Names, prepositions and
# zones curated; aliases are the spellings seen in the source. No adjacency yet (valuation then
# skips the neighbors group).
WAVE_2: tuple[NeighborhoodSeed, ...] = (
    NeighborhoodSeed("tatuape", "Tatuapé", "leste", ("TATUAPE",), wave=2, preposition="no"),
    NeighborhoodSeed("perdizes", "Perdizes", "oeste", ("PERDIZES",), wave=2, preposition="em"),
    NeighborhoodSeed(
        "santo-amaro", "Santo Amaro", "sul", ("SANTO AMARO",), wave=2, preposition="em"
    ),
    NeighborhoodSeed("butanta", "Butantã", "oeste", ("BUTANTA",), wave=2, preposition="no"),
    NeighborhoodSeed("santana", "Santana", "norte", ("SANTANA",), wave=2, preposition="em"),
    NeighborhoodSeed("mooca", "Mooca", "leste", ("MOOCA",), wave=2, preposition="na"),
    NeighborhoodSeed(
        "bela-vista", "Bela Vista", "centro", ("BELA VISTA",), wave=2, preposition="na"
    ),
    NeighborhoodSeed(
        "santa-cecilia", "Santa Cecília", "centro", ("SANTA CECILIA",), wave=2, preposition="em"
    ),
    NeighborhoodSeed("pinheiros", "Pinheiros", "oeste", ("PINHEIROS",), wave=2, preposition="em"),
    NeighborhoodSeed(
        "vila-andrade", "Vila Andrade", "sul", ("VILA ANDRADE",), wave=2, preposition="na"
    ),
    NeighborhoodSeed(
        "vila-prudente", "Vila Prudente", "leste", ("VILA PRUDENTE",), wave=2, preposition="na"
    ),
    NeighborhoodSeed("pirituba", "Pirituba", "norte", ("PIRITUBA",), wave=2, preposition="em"),
    NeighborhoodSeed("itaquera", "Itaquera", "leste", ("ITAQUERA",), wave=2, preposition="em"),
    NeighborhoodSeed("lapa", "Lapa", "oeste", ("LAPA",), wave=2, preposition="na"),
    NeighborhoodSeed(
        "jardim-america", "Jardim América", "oeste", ("JARDIM AMERICA",), wave=2, preposition="no"
    ),
    NeighborhoodSeed(
        "belenzinho", "Belenzinho", "leste", ("BELENZINHO",), wave=2, preposition="no"
    ),
    NeighborhoodSeed(
        "vila-olimpia", "Vila Olímpia", "sul", ("VILA OLIMPIA",), wave=2, preposition="na"
    ),
    NeighborhoodSeed(
        "consolacao", "Consolação", "centro", ("CONSOLACAO",), wave=2, preposition="na"
    ),
    NeighborhoodSeed("liberdade", "Liberdade", "centro", ("LIBERDADE",), wave=2, preposition="na"),
    NeighborhoodSeed("tucuruvi", "Tucuruvi", "norte", ("TUCURUVI",), wave=2, preposition="no"),
    NeighborhoodSeed(
        "vila-matilde", "Vila Matilde", "leste", ("VILA MATILDE",), wave=2, preposition="na"
    ),
    NeighborhoodSeed("jabaquara", "Jabaquara", "sul", ("JABAQUARA",), wave=2, preposition="no"),
    NeighborhoodSeed("cambuci", "Cambuci", "centro", ("CAMBUCI",), wave=2, preposition="no"),
    NeighborhoodSeed("bras", "Brás", "centro", ("BRAS",), wave=2, preposition="no"),
    NeighborhoodSeed(
        "vila-formosa", "Vila Formosa", "leste", ("VILA FORMOSA",), wave=2, preposition="na"
    ),
    NeighborhoodSeed("brooklin", "Brooklin", "sul", ("BROOKLIN",), wave=2, preposition="no"),
    NeighborhoodSeed("paraiso", "Paraíso", "sul", ("PARAISO",), wave=2, preposition="no"),
    NeighborhoodSeed("centro", "Centro", "centro", ("CENTRO",), wave=2, preposition="no"),
    NeighborhoodSeed(
        "barra-funda", "Barra Funda", "oeste", ("BARRA FUNDA",), wave=2, preposition="na"
    ),
    NeighborhoodSeed(
        "chacara-santo-antonio",
        "Chácara Santo Antônio",
        "sul",
        ("CHACARA SANTO ANTONIO",),
        wave=2,
        preposition="na",
    ),
    NeighborhoodSeed(
        "vila-madalena", "Vila Madalena", "oeste", ("VILA MADALENA",), wave=2, preposition="na"
    ),
    NeighborhoodSeed(
        "itaim-bibi", "Itaim Bibi", "oeste", ("ITAIM BIBI",), wave=2, preposition="no"
    ),
    NeighborhoodSeed(
        "freguesia-do-o", "Freguesia do Ó", "norte", ("FREGUESIA DO O",), wave=2, preposition="na"
    ),
    NeighborhoodSeed(
        "higienopolis", "Higienópolis", "centro", ("HIGIENOPOLIS",), wave=2, preposition="em"
    ),
    NeighborhoodSeed(
        "vila-carrao", "Vila Carrão", "leste", ("VILA CARRAO",), wave=2, preposition="na"
    ),
    NeighborhoodSeed(
        "vila-maria", "Vila Maria", "norte", ("VILA MARIA",), wave=2, preposition="na"
    ),
    NeighborhoodSeed(
        "vila-guarani", "Vila Guarani", "sul", ("VILA GUARANI",), wave=2, preposition="na"
    ),
    NeighborhoodSeed(
        "sao-miguel-paulista",
        "São Miguel Paulista",
        "leste",
        ("SAO MIGUEL PAULISTA",),
        wave=2,
        preposition="em",
    ),
    NeighborhoodSeed(
        "vila-mascote", "Vila Mascote", "sul", ("VILA MASCOTE",), wave=2, preposition="na"
    ),
)

SEEDS: dict[str, tuple[NeighborhoodSeed, ...]] = {"sao-paulo": SAO_PAULO + WAVE_2}


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
