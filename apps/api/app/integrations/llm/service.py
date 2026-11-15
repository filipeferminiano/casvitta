"""The only entry point services use for AI generation.

Renders a versioned prompt, calls the LLM port, validates the output against a Pydantic schema,
and logs every call (prompt id/version, model, tokens, latency, outcome) for review.
"""

from __future__ import annotations

import time
from dataclasses import dataclass

from pydantic import BaseModel, ValidationError

from app.core.logging import get_logger
from app.integrations.base import IntegrationError
from app.integrations.llm.port import CompletionRequest, LLMPort
from app.integrations.llm.prompts import Prompt

log = get_logger("ai")


class InvalidAIOutput(IntegrationError):
    def __init__(self, prompt_id: str, detail: str) -> None:
        super().__init__("de IA", detail)
        self.prompt_id = prompt_id


@dataclass(frozen=True, slots=True)
class AIResult[OutputT: BaseModel]:
    output: OutputT
    prompt_id: str
    prompt_version: int
    model: str
    input_tokens: int
    output_tokens: int
    latency_ms: int


class LLMService:
    def __init__(self, port: LLMPort, model: str) -> None:
        self.port = port
        self.model = model

    async def generate[OutputT: BaseModel](
        self,
        prompt: Prompt,
        variables: dict[str, str],
        output_schema: type[OutputT],
        max_tokens: int = 1024,
    ) -> AIResult[OutputT]:
        system, user = prompt.render(variables)
        request = CompletionRequest(prompt.id, prompt.version, system, user, self.model, max_tokens)
        started = time.perf_counter()
        fields = {"prompt_id": prompt.id, "prompt_version": prompt.version, "model": self.model}
        try:
            completion = await self.port.complete(request)
        except Exception:
            log.warning("ai_call", outcome="error", latency_ms=_ms(started), **fields)
            raise
        fields.update(
            model=completion.model,
            input_tokens=completion.input_tokens,
            output_tokens=completion.output_tokens,
            latency_ms=_ms(started),
        )
        try:
            output = output_schema.model_validate_json(completion.text)
        except ValidationError as exc:
            log.warning("ai_call", outcome="invalid_output", errors=exc.error_count(), **fields)
            raise InvalidAIOutput(prompt.id, str(exc)) from exc
        log.info("ai_call", outcome="ok", **fields)
        return AIResult(
            output=output,
            prompt_id=prompt.id,
            prompt_version=prompt.version,
            model=completion.model,
            input_tokens=completion.input_tokens,
            output_tokens=completion.output_tokens,
            latency_ms=_ms(started),
        )


def _ms(started: float) -> int:
    return round((time.perf_counter() - started) * 1000)
