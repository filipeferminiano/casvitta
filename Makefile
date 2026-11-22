# Casvitta developer commands. Requires pnpm, uv and a Postgres (docker compose or local).
SHELL := /bin/bash
API := apps/api
UV := uv --directory $(API)
comma := ,

.PHONY: deploy-web deploy-api indexnow setup infra-up infra-down dev check test e2e lint typecheck format storybook api\:gen db\:migrate db\:seed

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
	NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_GTM_ID= NEXT_PUBLIC_LIVE=market API_INTERNAL_URL=http://127.0.0.1:8100 pnpm --filter @casvitta/web build
	pnpm --filter @casvitta/web e2e

storybook: ## Component library on :6006
	pnpm storybook

format:
	$(UV) run ruff format .
	$(UV) run ruff check --fix .
	pnpm format

api\:gen: ## Export OpenAPI schema and the plan catalog, regenerate the TS client
	$(UV) run python -m app.scripts.export_openapi ../../packages/api-client/openapi.json
	$(UV) run python -m app.scripts.export_catalog ../../packages/config/catalog.json
	pnpm api:gen

catalog\:gen: ## Export the plan catalog snapshot read by the web (packages/config/catalog.json)
	$(UV) run python -m app.scripts.export_catalog ../../packages/config/catalog.json

stripe\:sync: ## Create the Stripe products/prices of the paid plans from the catalog (test key; ARGS=--live)
	$(UV) run python -m app.scripts.stripe_sync $(ARGS)

db\:migrate:
	$(UV) run alembic upgrade head

db\:seed:
	$(UV) run python -m app.scripts.seed

# Web on Cloud Run behind the casvitta.com.br load balancer (project roas-164016, São Paulo, mock data).
GCP_PROJECT ?= roas-164016
GCP_REGION ?= southamerica-east1
WEB_URL ?= https://casvitta.com.br
APP_URL ?= $(subst https://,https://app.,$(WEB_URL))
API_URL ?= $(subst https://,https://api.,$(WEB_URL))
ADMIN_URL ?= $(subst https://,https://admin.,$(WEB_URL))
# Scripts only; turn on for a deploy that needs /v1/staff/bootstrap, then off again.
ADMIN_TOKEN_ENABLED ?= false
# Areas the web build reads from the API (apps/web/src/lib/live.ts), '+'-separated.
WEB_LIVE ?= interest+accounts
GOOGLE_SITE_VERIFICATION ?=
# IndexNow key (public by design, served at /indexnow-key.txt). Read from Secret Manager when it
# exists; deploys work without it. Create once: openssl rand -hex 16 | gcloud secrets create casvitta-indexnow-key --data-file=-
INDEXNOW_SECRET ?= casvitta-indexnow-key
indexnow-key = $(shell gcloud secrets versions access latest --secret=$(INDEXNOW_SECRET) --project $(GCP_PROJECT) 2>/dev/null)
deploy-web: ## Build apps/web on Cloud Build and deploy it to Cloud Run (casvitta-web)
	$(eval TAG := $(shell git rev-parse --short HEAD))
	$(eval INDEXNOW_KEY := $(indexnow-key))
	gcloud builds submit --project $(GCP_PROJECT) --region $(GCP_REGION) --config infra/cloudbuild/web.yaml --substitutions=_SITE_URL=$(WEB_URL),_TAG=$(TAG),_LIVE=$(WEB_LIVE),_GOOGLE_SITE_VERIFICATION=$(GOOGLE_SITE_VERIFICATION) .
	gcloud run deploy casvitta-web --project $(GCP_PROJECT) --region $(GCP_REGION) --image $(GCP_REGION)-docker.pkg.dev/$(GCP_PROJECT)/casvitta/web:$(TAG) --port 8080 --memory 512Mi --cpu 1 --min-instances 0 --max-instances 3 --allow-unauthenticated --set-env-vars ROOT_DOMAIN=$(subst https://,,$(WEB_URL)),APP_SUBDOMAIN=app,API_INTERNAL_URL=$(API_URL)$(if $(INDEXNOW_KEY),$(comma)INDEXNOW_KEY=$(INDEXNOW_KEY))

indexnow: ## Submit the live sitemap(s) to IndexNow (Bing and others): make indexnow [SITEMAPS="url ..."]
	$(eval INDEXNOW_KEY := $(indexnow-key))
	@test -n "$(INDEXNOW_KEY)" || (echo "No IndexNow key: create the $(INDEXNOW_SECRET) secret (see above)." && exit 1)
	INDEXNOW_ENABLED=true INDEXNOW_KEY=$(INDEXNOW_KEY) $(UV) run python -m app.scripts.indexnow_submit $(or $(SITEMAPS),$(WEB_URL)/sitemap.xml)

# API on Cloud Run next to the database (Supabase, AWS us-east-2 -> GCP us-east5, Ohio).
# Reached only through the load balancer at https://api.casvitta.com.br.
API_REGION ?= us-east5
API_CORS ?= https://casvitta.com.br,https://www.casvitta.com.br
deploy-api: ## Build apps/api, run migrations (Cloud Run job) and deploy casvitta-api
	$(eval TAG := $(shell git rev-parse --short HEAD))
	$(eval API_IMAGE := $(GCP_REGION)-docker.pkg.dev/$(GCP_PROJECT)/casvitta/api:$(TAG))
	$(eval EMAIL_SECRET := $(shell gcloud secrets describe casvitta-email-api-key --project $(GCP_PROJECT) --format='value(name)' >/dev/null 2>&1 && echo casvitta-email-api-key))
	gcloud builds submit --project $(GCP_PROJECT) --region $(GCP_REGION) --config infra/cloudbuild/api.yaml --substitutions=_TAG=$(TAG) apps/api
	gcloud run jobs deploy casvitta-migrate --project $(GCP_PROJECT) --region $(API_REGION) --image $(API_IMAGE) --command alembic --args upgrade,head --set-secrets DATABASE_URL=casvitta-database-url:latest,JWT_SECRET=casvitta-jwt-secret:latest --set-env-vars DATABASE_SSL_REQUIRE=true --max-retries 0 --execute-now --wait
	gcloud run deploy casvitta-api --project $(GCP_PROJECT) --region $(API_REGION) --image $(API_IMAGE) --port 8080 --memory 512Mi --cpu 1 --min-instances 0 --max-instances 2 --allow-unauthenticated --ingress internal-and-cloud-load-balancing --set-secrets DATABASE_URL=casvitta-database-url:latest,JWT_SECRET=casvitta-jwt-secret:latest,ADMIN_TOKEN=casvitta-admin-token:latest$(if $(EMAIL_SECRET),$(comma)EMAIL_API_KEY=$(EMAIL_SECRET):latest) --set-env-vars "^@^APP_ENV=production@DATABASE_SSL_REQUIRE=true@CORS_ORIGINS=$(API_CORS)@SITE_URL=$(WEB_URL)@APP_URL=$(APP_URL)@ADMIN_URL=$(ADMIN_URL)@BACKOFFICE_ENVIRONMENT=production@ADMIN_TOKEN_ENABLED=$(ADMIN_TOKEN_ENABLED)@COOKIE_SECURE=true@ITBI_SP_RULES_REVIEWED=true"
