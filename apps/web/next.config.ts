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
  // Development: /api/v1/* goes to the local API so the browser stays same-origin (cookies).
  // In production the load balancer sends /api/v1/* to the API before it reaches Next.
  // Backoffice host (admin.*): never indexed, never framed, never cached, no referrer leaks.
  async headers() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'admin\\..*' }],
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Cache-Control', value: 'no-store' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },
  async rewrites() {
    const api = process.env.API_INTERNAL_URL ?? 'http://localhost:8000';
    return [{ source: '/api/v1/:path*', destination: `${api}/v1/:path*` }];
  },
};

export default withNextIntl(nextConfig);
