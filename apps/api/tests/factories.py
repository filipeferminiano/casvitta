"""Async factories for test data."""

from __future__ import annotations

import itertools

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenancy import cross_tenant
from app.domains.accounts.models import Workspace, WorkspaceKind

_seq = itertools.count(1)


async def create_workspace(session: AsyncSession, **overrides: object) -> Workspace:
    fields: dict[str, object] = {"name": f"Workspace {next(_seq)}", "kind": WorkspaceKind.BROKER}
    fields.update(overrides)
    workspace = Workspace(**fields)
    with cross_tenant(session):
        session.add(workspace)
        await session.flush()
    return workspace
