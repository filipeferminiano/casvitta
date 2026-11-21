from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import client_key, get_rate_limiter, get_settings_dep
from app.api.v1.staff_deps import require_permission
from app.core.db import get_session
from app.core.errors import AppError
from app.core.rate_limit import RateLimiter
from app.core.settings import Settings
from app.domains.alerts import service
from app.domains.alerts.schemas import PropertyAlertAccepted, PropertyAlertIn, PropertyAlertOut
from app.domains.staff.audit import Actor, record
from app.domains.staff.permissions import Permission

public_router = APIRouter(prefix="/public", tags=["public"])
admin_router = APIRouter(prefix="/admin", tags=["admin"])


@public_router.post(
    "/property-alerts",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=PropertyAlertAccepted,
    operation_id="createPropertyAlert",
)
async def create_property_alert(
    payload: PropertyAlertIn,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
    limiter: Annotated[RateLimiter, Depends(get_rate_limiter)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> PropertyAlertAccepted:
    """Price pages: "avise-me" and "quanto vale o meu apartamento?". Stored only; no message."""
    await service.create_alert(
        session,
        payload,
        limiter=limiter,
        client_key=client_key(request),
        limit_per_minute=settings.interest_rate_limit_per_minute,
    )
    await session.commit()
    return PropertyAlertAccepted()


@admin_router.get(
    "/property-alerts",
    response_model=list[PropertyAlertOut],
    operation_id="listPropertyAlerts",
    responses={200: {"content": {"text/csv": {}}}},
)
async def list_property_alerts(
    actor: Annotated[Actor, Depends(require_permission(Permission.EXPORT_CONTACTS))],
    session: Annotated[AsyncSession, Depends(get_session)],
    format: Annotated[str, Query(pattern="^(json|csv)$")] = "json",
) -> list[PropertyAlertOut] | PlainTextResponse:
    """Scripts: full contacts, so it needs the export permission and is audited."""
    rows = await service.list_alerts(session)
    record(session, actor, "property_alert.exported", "property_alerts", None, count=len(rows))
    await session.commit()
    if format == "csv":
        return PlainTextResponse(
            service.to_csv(rows),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="property_alerts.csv"'},
        )
    return rows


@admin_router.delete(
    "/property-alerts/{alert_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="deletePropertyAlert",
)
async def delete_property_alert(
    alert_id: uuid.UUID,
    actor: Annotated[Actor, Depends(require_permission(Permission.HANDLE_CAPTURES))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Response:
    """LGPD: delete a person's alert on request."""
    if not await service.delete_alert(session, alert_id):
        raise AppError("not_found", status_code=404)
    record(session, actor, "property_alert.deleted", "property_alerts", alert_id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
