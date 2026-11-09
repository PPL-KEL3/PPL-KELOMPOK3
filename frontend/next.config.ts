import type { NextConfig } from 'next'

const backendUrl = (process.env.BACKEND_URL ?? 'http://localhost:4000').replace(
  /\/$/,
  ''
)

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  async rewrites() {
    // Local development proxies /api to Express so the browser sees one origin.
    // In production, NEXT_PUBLIC_API_URL points directly to the separate API.
    if (process.env.NODE_ENV !== 'development' || process.env.NEXT_PUBLIC_API_URL) {
      return []
    }

    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
