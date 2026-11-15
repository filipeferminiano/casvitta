from fastapi import APIRouter

from app.api.v1 import health, interest

api_router = APIRouter(prefix="/v1")
api_router.include_router(health.router)
api_router.include_router(interest.public_router)
api_router.include_router(interest.admin_router)
