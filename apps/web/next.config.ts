import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  agentRules: false,
  async headers() {
    return [
      {
        source: '/reset-password',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Cache-Control', value: 'no-store' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
  async rewrites() {
    // Optional local preview against the existing API without changing its CORS policy.
    const api = process.env.DEV_API_PROXY;
    if (process.env.NODE_ENV !== 'development' || !api) return [];
    return [{ source: '/dev-api/:path*', destination: `${api.replace(/\/$/, '')}/:path*` }];
  },
};

export default nextConfig;
