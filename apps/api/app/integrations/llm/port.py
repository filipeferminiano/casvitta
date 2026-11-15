from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class CompletionRequest:
    prompt_id: str
    prompt_version: int
    system: str
    user: str
    model: str
    max_tokens: int = 1024


@dataclass(frozen=True, slots=True)
class Completion:
    text: str
    model: str
    input_tokens: int
    output_tokens: int


class LLMPort(Protocol):
    async def complete(self, request: CompletionRequest) -> Completion: ...
