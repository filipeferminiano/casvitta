import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  // Self-contained server for the Cloud Run image (apps/web/Dockerfile).
  output: 'standalone',
  // Monorepo: trace workspace packages from the repo root.
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
};

export default withNextIntl(nextConfig);
