# Casvitta API image for Cloud Run. Build context: apps/api.
FROM python:3.12-slim AS build
COPY --from=ghcr.io/astral-sh/uv:0.12.15 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /srv
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-dev --no-install-project
COPY alembic.ini ./
COPY migrations ./migrations
COPY app ./app

FROM python:3.12-slim AS run
RUN useradd --create-home --uid 10001 casvitta
WORKDIR /srv
COPY --from=build --chown=casvitta /srv /srv
ENV PATH=/srv/.venv/bin:$PATH PYTHONUNBUFFERED=1 APP_ENV=production LOG_JSON=true PORT=8080
USER casvitta
EXPOSE 8080
# Cloud Run sends X-Forwarded-* from Google's front end; trust it for client IPs.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
