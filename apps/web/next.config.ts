import path from 'node:path';
import type { NextConfig } from 'next';
import { buildSecurityHeaders } from './security-headers';

// Origin of the NestJS API (e.g. http://localhost:4000), derived from the public API URL
const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').origin;

const isProduction = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  // Self-contained server bundle for deployment (Task 69): .next/standalone/apps/web/server.js
  output: 'standalone',
  // Trace dependencies from the pnpm workspace root so the bundle includes hoisted packages
  outputFileTracingRoot: path.join(__dirname, '../..'),
  poweredByHeader: false,
  // Uploaded files (course covers) are stored as `/uploads/...` paths and served
  // by the API. Proxy them so they load from the web origin and work with next/image.
  async rewrites() {
    return [{ source: '/uploads/:path*', destination: `${apiOrigin}/uploads/:path*` }];
  },
  // The service worker must always be revalidated so updates reach installed apps (Task 63)
  async headers() {
    return [
      { source: '/:path*', headers: buildSecurityHeaders(apiOrigin, isProduction) },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
