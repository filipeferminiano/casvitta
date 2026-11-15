"""CLAUDE.md §3: multi-tenant by workspace_id, enforced and tested.

Cross-tenant reads must be impossible through every ORM path, and writes must not leak.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenancy import (
    CrossTenantWrite,
    TenantContextMissing,
    bind_workspace,
    cross_tenant,
)
from tests.factories import create_workspace
from tests.tenancy_probe import TenancyProbe, TenancyProbeRepository


@pytest.fixture
async def two_tenants(make_session):  # type: ignore[no-untyped-def]
    """Workspaces A and B, each with one probe row. Returns (a_id, b_id, row_a_id, row_b_id)."""
    async with make_session() as setup:
        a = await create_workspace(setup, name="A")
        b = await create_workspace(setup, name="B")
        with cross_tenant(setup):
            row_a = TenancyProbe(workspace_id=a.id, label="a")
            row_b = TenancyProbe(workspace_id=b.id, label="b")
            setup.add_all([row_a, row_b])
            await setup.commit()
        return a.id, b.id, row_a.id, row_b.id


async def test_list_returns_only_own_rows(make_session, two_tenants) -> None:  # type: ignore[no-untyped-def]
    a_id, _, row_a_id, _ = two_tenants
    async with make_session() as session:
        bind_workspace(session, a_id)
        rows = await TenancyProbeRepository(session).list()
        assert [r.id for r in rows] == [row_a_id]


async def test_get_by_id_of_other_tenant_returns_none(make_session, two_tenants) -> None:  # type: ignore[no-untyped-def]
    a_id, _, _, row_b_id = two_tenants
    async with make_session() as session:
        bind_workspace(session, a_id)
        assert await TenancyProbeRepository(session).get(row_b_id) is None
        assert await session.get(TenancyProbe, row_b_id) is None


async def test_explicit_filter_on_other_tenant_id_finds_nothing(make_session, two_tenants) -> None:  # type: ignore[no-untyped-def]
    a_id, b_id, _, row_b_id = two_tenants
    async with make_session() as session:
        bind_workspace(session, a_id)
        stmt = select(TenancyProbe).where(
            TenancyProbe.id == row_b_id, TenancyProbe.workspace_id == b_id
        )
        assert (await session.scalars(stmt)).all() == []


async def test_bulk_update_cannot_touch_other_tenant(make_session, two_tenants) -> None:  # type: ignore[no-untyped-def]
    a_id, _, _, row_b_id = two_tenants
    async with make_session() as session:
        bind_workspace(session, a_id)
        await session.execute(
            update(TenancyProbe).where(TenancyProbe.id == row_b_id).values(label="hacked")
        )
        await session.commit()
    async with make_session() as check:
        with cross_tenant(check):
            row_b = await check.get(TenancyProbe, row_b_id)
            assert row_b is not None
            assert row_b.label == "b"


async def test_insert_inherits_bound_workspace(make_session, two_tenants) -> None:  # type: ignore[no-untyped-def]
    a_id, *_ = two_tenants
    async with make_session() as session:
        bind_workspace(session, a_id)
        row = await TenancyProbeRepository(session).add(TenancyProbe(label="new"))
        assert row.workspace_id == a_id


async def test_insert_into_other_tenant_is_rejected(make_session, two_tenants) -> None:  # type: ignore[no-untyped-def]
    a_id, b_id, *_ = two_tenants
    async with make_session() as session:
        bind_workspace(session, a_id)
        session.add(TenancyProbe(workspace_id=b_id, label="sneaky"))
        with pytest.raises(CrossTenantWrite):
            await session.flush()


async def test_moving_row_to_other_tenant_is_rejected(make_session, two_tenants) -> None:  # type: ignore[no-untyped-def]
    a_id, b_id, row_a_id, _ = two_tenants
    async with make_session() as session:
        bind_workspace(session, a_id)
        row = await session.get(TenancyProbe, row_a_id)
        assert row is not None
        row.workspace_id = b_id
        with pytest.raises(CrossTenantWrite):
            await session.flush()


async def test_unbound_session_cannot_read_tenant_tables(
    session: AsyncSession, two_tenants
) -> None:  # type: ignore[no-untyped-def]
    with pytest.raises(TenantContextMissing):
        await session.scalars(select(TenancyProbe))


async def test_repository_requires_bound_session(session: AsyncSession) -> None:
    with pytest.raises(TenantContextMissing):
        TenancyProbeRepository(session)


async def test_session_cannot_be_rebound_to_another_workspace(make_session, two_tenants) -> None:  # type: ignore[no-untyped-def]
    a_id, b_id, *_ = two_tenants
    async with make_session() as session:
        bind_workspace(session, a_id)
        with pytest.raises(CrossTenantWrite):
            bind_workspace(session, b_id)


async def test_cross_tenant_requires_explicit_opt_in(make_session, two_tenants) -> None:  # type: ignore[no-untyped-def]
    async with make_session() as session:
        with cross_tenant(session):
            rows = (await session.scalars(select(TenancyProbe))).all()
        assert len(rows) == 2
        with pytest.raises(TenantContextMissing):
            await session.scalars(select(TenancyProbe))
