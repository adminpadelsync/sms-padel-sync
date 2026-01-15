import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    // Strict verification for non-development environments
    if (process.env.NODE_ENV !== 'development' && !apiUrl) {
      throw new Error('CRITICAL CONFIG ERROR: NEXT_PUBLIC_API_URL is not defined in this environment. Rewrites will fail.');
    }

    const rawUrl = process.env.NODE_ENV === 'development'
      ? 'http://localhost:8001'
      : apiUrl;

    const targetUrl = rawUrl?.replace(/\/$/, '');

    return [
      {
        source: '/api/matches/:path*',
        destination: `${targetUrl}/api/matches/:path*`,
      },
      {
        source: '/api/recommendations',
        destination: `${targetUrl}/api/recommendations`,
      },
      {
        source: '/api/outreach',
        destination: `${targetUrl}/api/outreach`,
      },
      {
        source: '/api/webhook/sms',
        destination: `${targetUrl}/api/webhook/sms`,
      },
      {
        source: '/api/sms-outbox/:path*',
        destination: `${targetUrl}/api/sms-outbox/:path*`,
      },
      {
        source: '/api/sms-inbox',
        destination: `${targetUrl}/api/sms-inbox`,
      },
      {
        source: '/api/players/:path*',
        destination: `${targetUrl}/api/players/:path*`,
      },
      {
        source: '/api/clubs/:path*',
        destination: `${targetUrl}/api/clubs/:path*`,
      },
      {
        source: '/api/clubs',
        destination: `${targetUrl}/api/clubs`,
      },

      {
        source: '/api/cron/:path*',
        destination: `${targetUrl}/api/cron/:path*`,
      },
      {
        source: '/api/groups/:path*',
        destination: `${targetUrl}/api/groups/:path*`,
      },
      {
        source: '/api/debug-routing',
        destination: `${targetUrl}/api/debug-routing`,
      },
      {
        source: '/api/insights/:path*',
        destination: `${targetUrl}/api/insights/:path*`,
      },
      {
        source: '/api/test/:path*',
        destination: `${targetUrl}/api/test/:path*`,
      },
      {
        source: '/api/debug-routes',
        destination: `${targetUrl}/api/debug-routes`,
      },
      {
        source: '/api/admin/:path*',
        destination: `${targetUrl}/api/admin/:path*`,
      },
      {
        source: '/api/assessment/:path*',
        destination: `${targetUrl}/api/assessment/:path*`,
      },
      {
        source: '/api/training/:path*',
        destination: `${targetUrl}/api/training/:path*`,
      },
    ]
  },
};

export default nextConfig;
