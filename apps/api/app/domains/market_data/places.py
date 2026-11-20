"""Persists neighborhoods, streets and buildings with stable slugs, and the cleaned transactions.

Entities are never deleted by a refresh: a slug, once published, keeps resolving. When a building's
display name (and so its slug) or its neighborhood changes, the old slug is kept as a redirect.
"""

from __future__ import annotations

import uuid
from collections import Counter, defaultdict
from collections.abc import Sequence
from dataclasses import dataclass, field

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.market_data.clean import CleanRow
from app.domains.market_data.locate import (
    NeighborhoodResolver,
    canonical_neighborhood,
    looks_like_building,
)
from app.domains.market_data.models import (
    ItbiLocationReview,
    ItbiTransaction,
    MarketBuilding,
    MarketNeighborhood,
    MarketNeighborhoodAdjacency,
    MarketSlugRedirect,
    MarketStreet,
    PropertyKind,
    SlugEntity,
)
from app.domains.market_data.normalize import (
    building_display_name,
    building_key,
    mode,
    street_display_name,
    street_slug,
    unique_slug,
)
from app.domains.market_data.seeds import NeighborhoodSeed

BUILDING_KINDS = frozenset({PropertyKind.APARTMENT, PropertyKind.FLAT})
INSERT_BATCH = 1_000


@dataclass(slots=True)
class LocatedRow:
    row: CleanRow
    neighborhood_slug: str | None
    neighborhood_id: uuid.UUID | None = None
    street_id: uuid.UUID | None = None
    building_id: uuid.UUID | None = None


@dataclass(slots=True)
class PlaceIndex:
    neighborhoods: dict[str, MarketNeighborhood] = field(default_factory=dict)
    streets: dict[tuple[uuid.UUID, str], MarketStreet] = field(default_factory=dict)
    buildings: dict[str, MarketBuilding] = field(default_factory=dict)


async def sync_neighborhoods(
    session: AsyncSession,
    city_id: uuid.UUID,
    seeds: Sequence[NeighborhoodSeed],
    resolver: NeighborhoodResolver,
    used_slugs: set[str],
) -> dict[str, MarketNeighborhood]:
    """Curated seeds always; learned neighborhoods once they have cleaned rows."""
    existing = {
        n.slug: n
        for n in await session.scalars(
            select(MarketNeighborhood).where(MarketNeighborhood.city_id == city_id)
        )
    }
    aliases_by_slug: dict[str, set[str]] = defaultdict(set)
    for alias, slug in resolver.alias_to_slug.items():
        aliases_by_slug[slug].add(alias)
    seeded = {s.slug: s for s in seeds}
    for slug in sorted(set(seeded) | (used_slugs & resolver.learned)):
        seed = seeded.get(slug)
        neighborhood = existing.get(slug)
        if neighborhood is None:
            neighborhood = MarketNeighborhood(
                city_id=city_id,
                slug=slug,
                name=seed.name if seed else resolver.names[slug],
                zone=seed.zone if seed else None,
                wave=seed.wave if seed else None,
                # Wave 1 starts indexable; everything else waits for a person to flip it.
                is_indexable=bool(seed and seed.wave == 1),
                is_auto=seed is None,
                aliases=[],
            )
            session.add(neighborhood)
            existing[slug] = neighborhood
        elif seed:  # keep curated fields current; never touch is_indexable after creation
            neighborhood.name = seed.name
            neighborhood.zone = seed.zone
            neighborhood.wave = seed.wave
        neighborhood.aliases = sorted(aliases_by_slug.get(slug, set()))
    await session.flush()

    for seed in seeds:
        for neighbor in seed.neighbors:
            a, b = existing[seed.slug].id, existing[neighbor].id
            for left, right in ((a, b), (b, a)):
                await session.execute(
                    insert(MarketNeighborhoodAdjacency)
                    .values(neighborhood_id=left, neighbor_id=right)
                    .on_conflict_do_nothing()
                )
    return existing


async def sync_streets(
    session: AsyncSession,
    city_id: uuid.UUID,
    neighborhoods: dict[str, MarketNeighborhood],
    rows: Sequence[LocatedRow],
) -> dict[tuple[uuid.UUID, str], MarketStreet]:
    existing: dict[tuple[uuid.UUID, str], MarketStreet] = {
        (s.neighborhood_id, s.name_key): s
        for s in await session.scalars(select(MarketStreet).where(MarketStreet.city_id == city_id))
    }
    taken: dict[uuid.UUID, set[str]] = defaultdict(set)
    for street in existing.values():
        taken[street.neighborhood_id].add(street.slug)
    needed = sorted(
        {
            (neighborhoods[r.neighborhood_slug].id, r.row.street_key)
            for r in rows
            if r.neighborhood_slug and r.row.street_key
        },
        key=lambda pair: (str(pair[0]), pair[1]),
    )
    for neighborhood_id, key in needed:
        if (neighborhood_id, key) in existing:
            continue
        name = street_display_name(key)
        street = MarketStreet(
            city_id=city_id,
            neighborhood_id=neighborhood_id,
            name_key=key,
            name=name,
            slug=unique_slug(street_slug(name), taken[neighborhood_id]),
        )
        session.add(street)
        existing[(neighborhood_id, key)] = street
    await session.flush()
    return existing


async def sync_buildings(
    session: AsyncSession,
    city_id: uuid.UUID,
    neighborhoods: dict[str, MarketNeighborhood],
    streets: dict[tuple[uuid.UUID, str], MarketStreet],
    rows: Sequence[LocatedRow],
) -> dict[str, MarketBuilding]:
    """Group apartment/flat rows by block + street + number; name, neighborhood and year by vote."""
    groups: dict[str, list[LocatedRow]] = defaultdict(list)
    for located in rows:
        r = located.row
        if r.kind in BUILDING_KINDS and r.street_number and r.street_key:
            groups[building_key(r.block, r.street_key, r.street_number)].append(located)

    existing = {
        b.building_key: b
        for b in await session.scalars(
            select(MarketBuilding).where(MarketBuilding.city_id == city_id)
        )
    }
    taken: dict[uuid.UUID, set[str]] = defaultdict(set)
    for known in existing.values():
        taken[known.neighborhood_id].add(known.slug)
    for key in sorted(groups):
        members = groups[key]
        votes = Counter(m.neighborhood_slug for m in members if m.neighborhood_slug)
        if not votes:
            continue
        slug_vote = sorted(votes.items(), key=lambda kv: (-kv[1], kv[0]))[0][0]
        neighborhood = neighborhoods[slug_vote]
        first = members[0].row
        if first.street_number is None:  # grouped only rows with a number; keeps mypy honest
            continue
        street = streets[(neighborhood.id, first.street_key)]
        references = Counter(m.row.reference_raw for m in members if m.row.reference_raw)
        # Building names that spilled over into the Bairro column count as references too.
        references.update(
            m.row.neighborhood_raw
            for m in members
            if m.row.neighborhood_raw
            and looks_like_building(canonical_neighborhood(m.row.neighborhood_raw))
        )
        name, named = building_display_name(references, street.name, first.street_number)
        year = mode(m.row.construction_year for m in members)
        building = existing.get(key)
        if building is None:
            building = MarketBuilding(
                city_id=city_id,
                neighborhood_id=neighborhood.id,
                street_id=street.id,
                building_key=key,
                street_number=first.street_number,
                name=name,
                has_named_reference=named,
                slug=unique_slug(street_slug(name), taken[neighborhood.id]),
                construction_year=year,
            )
            session.add(building)
            existing[key] = building
            continue
        moved = building.neighborhood_id != neighborhood.id
        renamed = building.name != name
        if moved or renamed:
            session.add(
                MarketSlugRedirect(
                    city_id=city_id,
                    entity_type=SlugEntity.BUILDING,
                    entity_id=building.id,
                    parent_id=building.neighborhood_id,
                    old_slug=building.slug,
                )
            )
            taken[building.neighborhood_id].discard(building.slug)
            building.neighborhood_id = neighborhood.id
            building.street_id = street.id
            building.name = name
            building.has_named_reference = named
            building.slug = unique_slug(street_slug(name), taken[neighborhood.id])
        building.construction_year = year
    await session.flush()
    return existing


def attach_ids(
    rows: Sequence[LocatedRow],
    neighborhoods: dict[str, MarketNeighborhood],
    streets: dict[tuple[uuid.UUID, str], MarketStreet],
    buildings: dict[str, MarketBuilding],
) -> None:
    for located in rows:
        r = located.row
        if not located.neighborhood_slug:
            continue
        neighborhood = neighborhoods[located.neighborhood_slug]
        located.neighborhood_id = neighborhood.id
        street = streets.get((neighborhood.id, r.street_key))
        located.street_id = street.id if street else None
        if r.kind in BUILDING_KINDS and r.street_number:
            building = buildings.get(building_key(r.block, r.street_key, r.street_number))
            located.building_id = building.id if building else None


async def replace_transactions(
    session: AsyncSession, city_id: uuid.UUID, rows: Sequence[LocatedRow]
) -> None:
    """Derived table: rebuilt on every run."""
    await session.execute(delete(ItbiTransaction).where(ItbiTransaction.city_id == city_id))
    for start in range(0, len(rows), INSERT_BATCH):
        batch = rows[start : start + INSERT_BATCH]
        await session.execute(
            insert(ItbiTransaction).values(
                [
                    {
                        "city_id": city_id,
                        "row_hash": located.row.row_hash,
                        "neighborhood_id": located.neighborhood_id,
                        "street_id": located.street_id,
                        "building_id": located.building_id,
                        "kind": located.row.kind,
                        "transaction_date": located.row.transaction_date,
                        "payment_month": located.row.payment_month,
                        "value_cents": located.row.value_cents,
                        "built_area_m2": located.row.built_area_m2,
                        "price_m2_cents": located.row.price_m2_cents,
                        "financing_type_code": located.row.financing_type_code,
                        "financed_value_cents": located.row.financed_value_cents,
                        "construction_year": located.row.construction_year,
                        "under_declared": located.row.under_declared,
                        "price_outlier": located.row.price_outlier,
                        "bundled_parking": located.row.bundled_parking,
                    }
                    for located in batch
                ]
            )
        )


async def store_review(
    session: AsyncSession, run_id: uuid.UUID, rows: Sequence[LocatedRow]
) -> list[tuple[str, str, int]]:
    counts = Counter((r.row.cep, r.row.street_key) for r in rows if not r.neighborhood_slug)
    ranked = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    for (cep, street), count in ranked:
        session.add(
            ItbiLocationReview(run_id=run_id, cep=cep, street=street[:120], row_count=count)
        )
    await session.flush()
    return [(cep, street, count) for (cep, street), count in ranked]
