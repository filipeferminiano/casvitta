import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const ROOT_DOMAIN = `localhost:${PORT}`;
export const E2E_API_PORT = Number(process.env.E2E_API_PORT ?? 8100);

/**
 * End-to-end tests. Hosts use *.localhost, which Chromium resolves to 127.0.0.1:
 *   http://localhost:PORT (marketplace), http://app.localhost:PORT (Broker OS),
 *   http://{slug}.localhost:PORT (landing pages).
 * The anchor flows (CLAUDE.md §6) land here in later milestones.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://${ROOT_DOMAIN}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      // Price pages read the real API (NEXT_PUBLIC_LIVE=market at build time, see make e2e):
      // a separate casvitta_e2e database with the fabricated demo seed.
      command: `uv --directory ../api run python -m app.scripts.e2e_market_api --port ${E2E_API_PORT}`,
      url: `http://127.0.0.1:${E2E_API_PORT}/v1/health`,
      // Backoffice flow: hosts on this port, the script token to create the first Admin, and the
      // fake email outbox so the browser can open sign-in links (never in production).
      env: {
        SITE_URL: `http://${ROOT_DOMAIN}`,
        APP_URL: `http://app.${ROOT_DOMAIN}`,
        ADMIN_URL: `http://admin.${ROOT_DOMAIN}`,
        ADMIN_TOKEN_ENABLED: 'true',
        DEV_OUTBOX_ENABLED: 'true',
        AUTH_RATE_LIMIT_PER_MINUTE: '1000',
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `pnpm exec next start -p ${PORT}`,
      url: `http://${ROOT_DOMAIN}`,
      reuseExistingServer: !process.env.CI,
      env: {
        ROOT_DOMAIN,
        NEXT_TELEMETRY_DISABLED: '1',
        API_INTERNAL_URL: `http://127.0.0.1:${E2E_API_PORT}`,
      },
    },
  ],
});
