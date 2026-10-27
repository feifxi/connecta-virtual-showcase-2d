import path from 'node:path';
import type { NextConfig } from 'next';

// env comes from the repo-root .env (package scripts pass --env-file) or the container

const basePath = process.env.BASE_PATH || '';

const nextConfig: NextConfig = {
  basePath: basePath || undefined,
  output: 'standalone',
  outputFileTracingRoot: path.resolve(import.meta.dirname, '../..'),
  typedRoutes: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_REALTIME_URL: process.env.PUBLIC_REALTIME_URL ?? '',
  },
  // dev: the browser calls /api/v1 on the same origin (no CORS) · prod: nginx routes it to the api container
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${process.env.API_INTERNAL_URL ?? 'http://localhost:4000'}/api/v1/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), display-capture=(self), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
