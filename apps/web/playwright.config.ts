import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const ROOT_DOMAIN = `localhost:${PORT}`;

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
  webServer: {
    command: `pnpm exec next start -p ${PORT}`,
    url: `http://${ROOT_DOMAIN}`,
    reuseExistingServer: !process.env.CI,
    env: { ROOT_DOMAIN, NEXT_TELEMETRY_DISABLED: '1' },
  },
});
