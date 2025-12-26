import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async rewrites() {
    const apiUrl = process.env.API_URL;
    return [
      {
        source: '/api/matches/:path*',
        destination:
          process.env.NODE_ENV === 'development'
            ? 'http://localhost:8001/api/matches/:path*'
            : `${apiUrl || ''}/api/matches/:path*`,
      },
      {
        source: '/api/recommendations',
        destination:
          process.env.NODE_ENV === 'development'
            ? 'http://localhost:8001/api/recommendations'
            : `${apiUrl || ''}/api/recommendations`,
      },
      {
        source: '/api/outreach',
        destination:
          process.env.NODE_ENV === 'development'
            ? 'http://localhost:8001/api/outreach'
            : `${apiUrl || ''}/api/outreach`,
      },
      {
        source: '/api/webhook/sms',
        destination:
          process.env.NODE_ENV === 'development'
            ? 'http://localhost:8001/api/webhook/sms'
            : `${apiUrl || ''}/api/webhook/sms`,
      },
      {
        source: '/api/sms-outbox/:path*',
        destination:
          process.env.NODE_ENV === 'development'
            ? 'http://localhost:8001/api/sms-outbox/:path*'
            : `${apiUrl || ''}/api/sms-outbox/:path*`,
      },
      {
        source: '/api/sms-inbox',
        destination:
          process.env.NODE_ENV === 'development'
            ? 'http://localhost:8001/api/sms-inbox'
            : `${apiUrl || ''}/api/sms-inbox`,
      },
      {
        source: '/api/players/:path*',
        destination:
          process.env.NODE_ENV === 'development'
            ? 'http://localhost:8001/api/players/:path*'
            : `${apiUrl || ''}/api/players/:path*`,
      },
      {
        source: '/api/clubs/:path*',
        destination:
          process.env.NODE_ENV === 'development'
            ? 'http://localhost:8001/api/clubs/:path*'
            : `${apiUrl || ''}/api/clubs/:path*`,
      },
      {
        source: '/api/clubs',
        destination:
          process.env.NODE_ENV === 'development'
            ? 'http://localhost:8001/api/clubs'
            : `${apiUrl || ''}/api/clubs`,
      },

      {
        source: '/api/cron/:path*',
        destination:
          process.env.NODE_ENV === 'development'
            ? 'http://localhost:8001/api/cron/:path*'
            : `${apiUrl || ''}/api/cron/:path*`,
      },
      {
        source: '/api/groups/:path*',
        destination:
          process.env.NODE_ENV === 'development'
            ? 'http://localhost:8001/api/groups/:path*'
            : `${apiUrl || ''}/api/groups/:path*`,
      },
      {
        source: '/api/debug-routing',
        destination:
          process.env.NODE_ENV === 'development'
            ? 'http://localhost:8001/api/debug-routing'
            : `${apiUrl || ''}/api/debug-routing`,
      },
      {
        source: '/api/insights/:path*',
        destination:
          process.env.NODE_ENV === 'development'
            ? 'http://localhost:8001/api/insights/:path*'
            : `${apiUrl || ''}/api/insights/:path*`,
      },
      {
        source: '/api/test/:path*',
        destination:
          process.env.NODE_ENV === 'development'
            ? 'http://localhost:8001/api/test/:path*'
            : `${apiUrl || ''}/api/test/:path*`,
      },
      {
        source: '/api/debug-routes',
        destination:
          process.env.NODE_ENV === 'development'
            ? 'http://localhost:8001/api/debug-routes'
            : `${apiUrl || ''}/api/debug-routes`,
      },
      {
        source: '/api/admin/:path*',
        destination:
          process.env.NODE_ENV === 'development'
            ? 'http://localhost:8001/api/admin/:path*'
            : `${apiUrl || ''}/api/admin/:path*`,
      },
      {
        source: '/api/assessment/:path*',
        destination:
          process.env.NODE_ENV === 'development'
            ? 'http://localhost:8001/api/assessment/:path*'
            : `${process.env.API_URL || ''}/api/assessment/:path*`,
      },
    ]
  },
};

export default nextConfig;
