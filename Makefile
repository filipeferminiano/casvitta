# Casvitta developer commands. Requires pnpm, uv and a Postgres (docker compose or local).
SHELL := /bin/bash
API := apps/api
UV := uv --directory $(API)

.PHONY: setup infra-up infra-down dev check test e2e lint typecheck format storybook api\:gen db\:migrate db\:seed

setup: ## Install JS and Python dependencies
	pnpm install
	$(UV) sync

infra-up: ## Start Postgres 16 and Redis
	docker compose -f infra/docker-compose.yml up -d --wait

infra-down:
	docker compose -f infra/docker-compose.yml down

dev: ## Run API (8000) and web (3000)
	@trap 'kill 0' EXIT; \
	$(UV) run uvicorn app.main:app --reload --port 8000 & \
	pnpm --filter @casvitta/web dev & \
	wait

lint:
	$(UV) run ruff check .
	$(UV) run ruff format --check .
	pnpm exec prettier --check .
	pnpm lint

typecheck:
	$(UV) run mypy app
	pnpm typecheck

test:
	$(UV) run pytest
	pnpm test

check: lint typecheck test ## ruff, mypy, pytest, prettier, eslint, tsc, vitest

e2e: ## Build the web app and run Playwright (needs `pnpm --filter @casvitta/web exec playwright install chromium` once)
	NEXT_TELEMETRY_DISABLED=1 pnpm --filter @casvitta/web build
	pnpm --filter @casvitta/web e2e

storybook: ## Component library on :6006
	pnpm storybook

format:
	$(UV) run ruff format .
	$(UV) run ruff check --fix .
	pnpm format

api\:gen: ## Export OpenAPI schema and regenerate the TS client
	$(UV) run python -m app.scripts.export_openapi ../../packages/api-client/openapi.json
	pnpm api:gen

db\:migrate:
	$(UV) run alembic upgrade head

db\:seed:
	$(UV) run python -m app.scripts.seed
