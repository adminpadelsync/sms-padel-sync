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
        source: '/webhook/sms',
        destination:
          process.env.NODE_ENV === 'development'
            ? 'http://localhost:8001/webhook/sms'
            : `${apiUrl || ''}/webhook/sms`,
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
    ]
  },
};

export default nextConfig;
