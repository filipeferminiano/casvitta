/**
 * Screenshots every implemented screen into docs/mockups/_impl/ with the mockup's file name, so
 * implementation and mockup can be compared side by side.
 *
 *   pnpm screens:capture                 # against a running dev server on localhost:3000
 *   ROOT_DOMAIN=localhost:3100 pnpm screens:capture
 *   pnpm screens:capture 31 32           # only mockups starting with these numbers
 *   pnpm screens:capture landing-pages   # one sub-folder
 */
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

import { SCREENS, screenUrl } from '../src/dev/screens.ts';

const rootDomain = process.env.ROOT_DOMAIN ?? 'localhost:3000';
const outDir = fileURLToPath(new URL('../../../docs/mockups/_impl/', import.meta.url));
const only = process.argv.slice(2);

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
let failures = 0;

for (const entry of SCREENS) {
  if (only.length && !only.some((prefix) => entry.mockup.startsWith(prefix))) continue;
  const mobile = entry.viewport === 'mobile';
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    isMobile: mobile,
    hasTouch: mobile,
  });
  const page = await context.newPage();
  const url = screenUrl(entry, rootDomain);
  try {
    const response = await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const path = `${outDir}${entry.mockup}.png`;
    mkdirSync(dirname(path), { recursive: true }); // mockups in sub-folders (landing-pages/…)
    await page.screenshot({ path, fullPage: true });
    console.log(`${response?.status() ?? '???'}  ${entry.mockup}  ${url}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${entry.mockup}  ${url}\n  ${(error as Error).message}`);
  }
  await context.close();
}

await browser.close();
console.log(`\nScreenshots in ${outDir}`);
process.exit(failures ? 1 : 0);
