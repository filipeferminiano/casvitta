# Next.js web app (marketplace, Broker OS, landing pages) for Cloud Run.
# Build from the repo root:  docker build -f apps/web/Dockerfile .
# NEXT_PUBLIC_* values are inlined at build time, so they are build args.

FROM node:22-slim AS build
WORKDIR /repo
RUN npm install -g pnpm@11.2.2
COPY . .
RUN pnpm install --frozen-lockfile
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_USE_MOCKS=true
ARG NEXT_PUBLIC_API_URL=
ARG NEXT_PUBLIC_LIVE=
ARG NEXT_PUBLIC_GTM_ID=GTM-KT3NQN2G
ARG NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_USE_MOCKS=$NEXT_PUBLIC_USE_MOCKS \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_GTM_ID=$NEXT_PUBLIC_GTM_ID \
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=$NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
ENV NEXT_PUBLIC_LIVE=$NEXT_PUBLIC_LIVE
RUN pnpm --filter @casvitta/web build

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080 HOSTNAME=0.0.0.0
# Standalone output: server.js plus only the node_modules it traces.
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 8080
CMD ["node", "apps/web/server.js"]
