# Casvitta developer commands. Requires pnpm, uv and a Postgres (docker compose or local).
SHELL := /bin/bash
API := apps/api
UV := uv --directory $(API)

.PHONY: deploy-web deploy-api setup infra-up infra-down dev check test e2e lint typecheck format storybook api\:gen db\:migrate db\:seed

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
	NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_GTM_ID= pnpm --filter @casvitta/web build
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

# Web on Cloud Run behind the casvitta.com.br load balancer (project roas-164016, São Paulo, mock data).
GCP_PROJECT ?= roas-164016
GCP_REGION ?= southamerica-east1
WEB_URL ?= https://casvitta.com.br
deploy-web: ## Build apps/web on Cloud Build and deploy it to Cloud Run (casvitta-web)
	$(eval TAG := $(shell git rev-parse --short HEAD))
	gcloud builds submit --project $(GCP_PROJECT) --region $(GCP_REGION) --config infra/cloudbuild/web.yaml --substitutions=_SITE_URL=$(WEB_URL),_TAG=$(TAG) .
	gcloud run deploy casvitta-web --project $(GCP_PROJECT) --region $(GCP_REGION) --image $(GCP_REGION)-docker.pkg.dev/$(GCP_PROJECT)/casvitta/web:$(TAG) --port 8080 --memory 512Mi --cpu 1 --min-instances 0 --max-instances 3 --allow-unauthenticated --set-env-vars ROOT_DOMAIN=$(subst https://,,$(WEB_URL)),APP_SUBDOMAIN=app

# API on Cloud Run next to the database (Supabase, AWS us-east-2 -> GCP us-east5, Ohio).
# Reached only through the load balancer at https://api.casvitta.com.br.
API_REGION ?= us-east5
API_CORS ?= https://casvitta.com.br,https://www.casvitta.com.br
deploy-api: ## Build apps/api, run migrations (Cloud Run job) and deploy casvitta-api
	$(eval TAG := $(shell git rev-parse --short HEAD))
	$(eval API_IMAGE := $(GCP_REGION)-docker.pkg.dev/$(GCP_PROJECT)/casvitta/api:$(TAG))
	gcloud builds submit --project $(GCP_PROJECT) --region $(GCP_REGION) --config infra/cloudbuild/api.yaml --substitutions=_TAG=$(TAG) apps/api
	gcloud run jobs deploy casvitta-migrate --project $(GCP_PROJECT) --region $(API_REGION) --image $(API_IMAGE) --command alembic --args upgrade,head --set-secrets DATABASE_URL=casvitta-database-url:latest --set-env-vars DATABASE_SSL_REQUIRE=true --max-retries 0 --execute-now --wait
	gcloud run deploy casvitta-api --project $(GCP_PROJECT) --region $(API_REGION) --image $(API_IMAGE) --port 8080 --memory 512Mi --cpu 1 --min-instances 0 --max-instances 2 --allow-unauthenticated --ingress internal-and-cloud-load-balancing --set-secrets DATABASE_URL=casvitta-database-url:latest,JWT_SECRET=casvitta-jwt-secret:latest --set-env-vars "^@^APP_ENV=production@DATABASE_SSL_REQUIRE=true@CORS_ORIGINS=$(API_CORS)"
