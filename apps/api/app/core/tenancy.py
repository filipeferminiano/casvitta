"""Multi-tenant enforcement by workspace_id.

Every session that touches a tenant table (a model with ``WorkspaceScoped``) must be bound to a
workspace with :func:`bind_workspace`. Once bound:

* every ORM SELECT / UPDATE / DELETE gets ``WHERE workspace_id = :bound`` added automatically,
  including relationship and ``session.get`` loads;
* new tenant rows get the bound ``workspace_id`` (or fail if a different one was set);
* moving a row to another workspace fails.

Unbound sessions that touch tenant tables raise :class:`TenantContextMissing`. System jobs that
legitimately work across tenants must opt in explicitly with :func:`cross_tenant`.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from typing import Any

from sqlalchemy import event, inspect, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import ORMExecuteState, Session, UOWTransaction, with_loader_criteria

from app.core.errors import AppError
from app.core.models import WorkspaceScoped

_WORKSPACE_KEY = "workspace_id"
_BYPASS_KEY = "tenant_bypass"


class TenantContextMissing(AppError):
    def __init__(self) -> None:
        super().__init__("tenant_context_missing", status_code=500)


class CrossTenantWrite(AppError):
    def __init__(self) -> None:
        super().__init__("cross_tenant_write", status_code=403)


def _sync(session: AsyncSession | Session) -> Session:
    return session.sync_session if isinstance(session, AsyncSession) else session


def bind_workspace(session: AsyncSession | Session, workspace_id: uuid.UUID) -> None:
    sync = _sync(session)
    current = sync.info.get(_WORKSPACE_KEY)
    if current is not None and current != workspace_id:
        raise CrossTenantWrite
    sync.info[_WORKSPACE_KEY] = workspace_id


def current_workspace(session: AsyncSession | Session) -> uuid.UUID | None:
    value = _sync(session).info.get(_WORKSPACE_KEY)
    return value if isinstance(value, uuid.UUID) else None


@contextmanager
def cross_tenant(session: AsyncSession | Session) -> Iterator[None]:
    """Explicitly allow unscoped access (system jobs, staff tooling). Use sparingly and audit it."""
    sync = _sync(session)
    previous = sync.info.get(_BYPASS_KEY, False)
    sync.info[_BYPASS_KEY] = True
    try:
        yield
    finally:
        sync.info[_BYPASS_KEY] = previous


def _touches_tenant_table(state: ORMExecuteState) -> bool:
    return any(issubclass(m.class_, WorkspaceScoped) for m in state.all_mappers)


@event.listens_for(Session, "do_orm_execute")
def _scope_orm_statements(state: ORMExecuteState) -> None:
    if not (state.is_select or state.is_update or state.is_delete):
        return
    if state.session.info.get(_BYPASS_KEY):
        return
    workspace_id = state.session.info.get(_WORKSPACE_KEY)
    if workspace_id is None:
        if _touches_tenant_table(state):
            raise TenantContextMissing
        return
    state.statement = state.statement.options(
        with_loader_criteria(
            WorkspaceScoped,
            lambda cls: cls.workspace_id == workspace_id,
            include_aliases=True,
        )
    )


@event.listens_for(Session, "before_flush")
def _guard_tenant_writes(session: Session, _ctx: UOWTransaction, _instances: Any) -> None:
    if session.info.get(_BYPASS_KEY):
        return
    workspace_id = session.info.get(_WORKSPACE_KEY)
    for obj in session.new:
        if not isinstance(obj, WorkspaceScoped):
            continue
        if workspace_id is None:
            raise TenantContextMissing
        if obj.workspace_id is None:
            obj.workspace_id = workspace_id
        elif obj.workspace_id != workspace_id:
            raise CrossTenantWrite
    for obj in (*session.dirty, *session.deleted):
        if not isinstance(obj, WorkspaceScoped):
            continue
        if workspace_id is None:
            raise TenantContextMissing
        history = inspect(obj).attrs.workspace_id.history
        if history.has_changes() or obj.workspace_id != workspace_id:
            raise CrossTenantWrite


class TenantRepository[ModelT: WorkspaceScoped]:
    """Base repository for tenant tables. Requires a session bound to a workspace."""

    model: type[ModelT]

    def __init__(self, session: AsyncSession) -> None:
        if current_workspace(session) is None:
            raise TenantContextMissing
        self.session = session

    async def get(self, entity_id: uuid.UUID) -> ModelT | None:
        return await self.session.get(self.model, entity_id)

    async def list(self, limit: int = 100, offset: int = 0) -> Sequence[ModelT]:
        result = await self.session.scalars(select(self.model).limit(limit).offset(offset))
        return result.all()

    async def add(self, entity: ModelT) -> ModelT:
        self.session.add(entity)
        await self.session.flush()
        return entity
