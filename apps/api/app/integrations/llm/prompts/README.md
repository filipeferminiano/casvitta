# Prompts

One folder per prompt id, one file per version: `<prompt_id>/v<n>.md`, with `## System` and
`## User` sections and `$placeholders`. Released versions are immutable; add a new version instead
of editing. See `app/integrations/llm/prompts.py`.
