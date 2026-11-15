from __future__ import annotations

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel, Field

from app.core.errors import AppError
from app.main import create_app


async def test_health(client: AsyncClient) -> None:
    response = await client.get("/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_readiness_checks_database(client: AsyncClient) -> None:
    response = await client.get("/v1/health/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


async def test_not_found_has_code_and_pt_br_message(client: AsyncClient) -> None:
    response = await client.get("/v1/nao-existe")
    assert response.status_code == 404
    error = response.json()["error"]
    assert error["code"] == "not_found"
    assert error["message"].startswith("Não encontramos")


class _Payload(BaseModel):
    name: str = Field(min_length=3)
    rooms: int


def _app_with_test_routes() -> FastAPI:
    app = create_app()

    @app.post("/_test/validate")
    async def validate(payload: _Payload) -> dict[str, str]:
        return {"name": payload.name}

    @app.get("/_test/app-error")
    async def app_error() -> None:
        raise AppError("integration_unavailable", status_code=503, integration="WhatsApp")

    @app.get("/_test/boom")
    async def boom() -> None:
        raise RuntimeError("unexpected")

    return app


async def _client() -> AsyncClient:
    transport = ASGITransport(app=_app_with_test_routes(), raise_app_exceptions=False)
    return AsyncClient(transport=transport, base_url="http://test")


async def test_validation_errors_are_per_field_in_pt_br() -> None:
    async with await _client() as client:
        response = await client.post("/_test/validate", json={"name": "ab"})
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    by_path = {tuple(f["path"]): f for f in error["fields"]}
    assert by_path[("name",)]["message"] == "Use pelo menos 3 caracteres."
    assert by_path[("rooms",)]["message"] == "Preencha este campo."


async def test_app_error_interpolates_message() -> None:
    async with await _client() as client:
        response = await client.get("/_test/app-error")
    assert response.status_code == 503
    error = response.json()["error"]
    assert error["code"] == "integration_unavailable"
    assert "WhatsApp" in error["message"]


async def test_unhandled_error_hides_details() -> None:
    async with await _client() as client:
        response = await client.get("/_test/boom")
    assert response.status_code == 500
    error = response.json()["error"]
    assert error["code"] == "internal_error"
    assert "unexpected" not in error["message"]
