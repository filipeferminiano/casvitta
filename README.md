# Casvitta

Real-estate platform for Brazil: marketplace + Anúncios (Ads Studio) on one side, Broker OS on the
other, both on the same property core. Read [CLAUDE.md](CLAUDE.md) and
[docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) before contributing.

## Layout

```
apps/api            FastAPI backend (Python 3.12, uv)
apps/web            Next.js app: (marketplace), (landing), (app) route groups
packages/ui         React component library + Storybook
packages/config     design tokens, Tailwind theme, tsconfig, eslint
packages/api-client typed client generated from the API's OpenAPI schema
infra/              docker compose (Postgres 16, Redis 7)
design/             approved logo board, tokens.json, asset build script
```

## Getting started

Requirements: Node 22+, pnpm 11, uv, and Postgres 16 + Redis (via `make infra-up`, or local
services with a `casvitta` role and the `casvitta` / `casvitta_test` databases).

```sh
cp .env.example .env
make setup          # pnpm install + uv sync
make infra-up       # Postgres + Redis in Docker
make db:migrate
make db:seed        # demo workspace (is_demo=true)
make dev            # API on :8000, web on :3000
```

Hosts in development (browsers resolve `*.localhost` to 127.0.0.1):

| URL                                 | Surface                         |
| ----------------------------------- | ------------------------------- |
| http://localhost:3000               | Marketplace                     |
| http://app.localhost:3000           | Broker OS                       |
| http://anaribeiro.localhost:3000    | Broker landing page             |
| http://localhost:8000/docs          | API docs                        |

Integrations run on fake adapters by default (`FAKE_INTEGRATIONS=true`).

## Screens with demo data (Milestone 0.5)

With `NEXT_PUBLIC_USE_MOCKS=true` (default) every screen reads an in-memory demo store, so
actions (move a lead, take over a conversation, publish an ad, book a visit) really change state
during the session. Add `?state=loading|empty|error` to any Broker OS URL to review the other
states. `http://localhost:3000/dev/screens` lists every route with its mockup number.

## Everyday commands

```sh
make check          # ruff, mypy, pytest, prettier, eslint, tsc, vitest
make e2e            # Playwright (run `pnpm --filter @casvitta/web exec playwright install chromium` once)
make storybook      # component library on :6006
pnpm --filter @casvitta/web screens:capture   # screenshots of every route into docs/mockups/_impl (dev server running)
make api:gen        # after any API change: export OpenAPI + regenerate packages/api-client
pnpm --filter @casvitta/config build:css   # after changing tokens.ts
uv run design/scripts/build_logo_assets.py # rebuild logo assets and favicons
```
