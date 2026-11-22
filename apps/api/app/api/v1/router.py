from fastapi import APIRouter

from app.api.v1 import (
    admin_brokers,
    alerts,
    auth,
    billing,
    crm,
    dev,
    health,
    interest,
    market,
    me,
    pages,
    properties,
    staff,
    staff_ops,
)

api_router = APIRouter(prefix="/v1")
api_router.include_router(health.router)
api_router.include_router(interest.public_router)
api_router.include_router(interest.admin_router)
api_router.include_router(auth.router)
api_router.include_router(me.router)
api_router.include_router(admin_brokers.router)
api_router.include_router(market.router)
api_router.include_router(alerts.public_router)
api_router.include_router(alerts.admin_router)
api_router.include_router(staff.router)
api_router.include_router(staff_ops.router)
api_router.include_router(staff_ops.public_router)
api_router.include_router(properties.router)
api_router.include_router(properties.public_router)
api_router.include_router(billing.public_router)
api_router.include_router(billing.router)
api_router.include_router(billing.staff_router)
api_router.include_router(crm.router)
api_router.include_router(crm.public_router)
api_router.include_router(pages.router)
api_router.include_router(pages.public_router)
api_router.include_router(dev.router)
