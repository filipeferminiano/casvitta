from __future__ import annotations

from collections.abc import Callable

from app.integrations.llm.port import Completion, CompletionRequest

Responder = str | Callable[[CompletionRequest], str]


class FakeLLM:
    """Deterministic LLM. Register a canned response (or a function) per prompt id."""

    def __init__(self, responses: dict[str, Responder] | None = None) -> None:
        self.responses: dict[str, Responder] = dict(responses or {})
        self.requests: list[CompletionRequest] = []

    def respond(self, prompt_id: str, response: Responder) -> None:
        self.responses[prompt_id] = response

    async def complete(self, request: CompletionRequest) -> Completion:
        self.requests.append(request)
        responder = self.responses.get(request.prompt_id, "{}")
        text = responder(request) if callable(responder) else responder
        return Completion(
            text=text,
            model=f"fake:{request.model}",
            input_tokens=len(request.system.split()) + len(request.user.split()),
            output_tokens=len(text.split()),
        )
