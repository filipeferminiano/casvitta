"""Seed demo data (all is_demo=true). Milestone 0 seeds the demo workspace only.

Run: python -m app.scripts.seed
"""

from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.core.db import get_sessionmaker
from app.domains.accounts.models import Workspace, WorkspaceKind

DEMO_WORKSPACE_NAME = "Ana Ribeiro Imóveis"


async def seed() -> None:
    async with get_sessionmaker()() as session, session.begin():
        existing = await session.scalar(
            select(Workspace).where(Workspace.name == DEMO_WORKSPACE_NAME, Workspace.is_demo)
        )
        if existing:
            print(f"Demo workspace already exists: {existing.id}")
            return
        workspace = Workspace(name=DEMO_WORKSPACE_NAME, kind=WorkspaceKind.BROKER, is_demo=True)
        session.add(workspace)
        await session.flush()
        print(f"Created demo workspace {workspace.id}")


if __name__ == "__main__":
    asyncio.run(seed())
