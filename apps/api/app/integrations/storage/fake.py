from __future__ import annotations

from app.integrations.base import IntegrationError
from app.integrations.storage.port import StoredObject


class FakeStorage:
    def __init__(self, base_url: str = "/api/v1/dev/storage") -> None:
        # Served by /v1/dev/storage (in memory, development only) through each web host's /api.
        self.base_url = base_url.rstrip("/")
        self.objects: dict[str, tuple[bytes, str]] = {}

    def public_url(self, key: str) -> str:
        return f"{self.base_url}/{key}"

    async def put(self, key: str, data: bytes, content_type: str) -> StoredObject:
        self.objects[key] = (data, content_type)
        return StoredObject(key, self.public_url(key), content_type, len(data))

    async def get(self, key: str) -> bytes:
        try:
            return self.objects[key][0]
        except KeyError as exc:
            raise IntegrationError("de arquivos", f"missing {key}") from exc

    async def delete(self, key: str) -> None:
        self.objects.pop(key, None)
