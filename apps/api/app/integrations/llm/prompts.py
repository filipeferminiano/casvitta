"""Versioned prompt files.

Prompts live in ``app/integrations/llm/prompts/<prompt_id>/v<version>.md`` with two sections::

    ## System
    ...
    ## User
    ... $placeholders ...

Placeholders use ``$name`` (string.Template) so JSON examples with braces stay literal.
Never edit a released version: add ``v<n+1>.md`` so logs keep pointing at the exact text used.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from string import Template

PROMPTS_DIR = Path(__file__).parent / "prompts"
_SECTION = re.compile(r"^##\s+(System|User)\s*$", re.IGNORECASE | re.MULTILINE)


class PromptNotFound(LookupError):
    pass


@dataclass(frozen=True, slots=True)
class Prompt:
    id: str
    version: int
    system: str
    user: str

    def render(self, variables: dict[str, str]) -> tuple[str, str]:
        return (
            Template(self.system).substitute(variables),
            Template(self.user).substitute(variables),
        )


def parse_prompt(prompt_id: str, version: int, text: str) -> Prompt:
    parts = _SECTION.split(text)
    sections = {parts[i].lower(): parts[i + 1].strip() for i in range(1, len(parts) - 1, 2)}
    if "system" not in sections or "user" not in sections:
        raise ValueError(f"prompt {prompt_id} v{version} needs '## System' and '## User' sections")
    return Prompt(prompt_id, version, sections["system"], sections["user"])


def load_prompt(prompt_id: str, version: int, base_dir: Path = PROMPTS_DIR) -> Prompt:
    path = base_dir / prompt_id / f"v{version}.md"
    if not path.is_file():
        raise PromptNotFound(f"{prompt_id} v{version}")
    return parse_prompt(prompt_id, version, path.read_text("utf-8"))
