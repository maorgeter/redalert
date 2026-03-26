import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Tell Next.js file-tracer the workspace root so it includes hoisted
  // node_modules and produces a predictable standalone directory structure:
  //   .next/standalone/
  //   ├── server.js          ← entry point (always at root)
  //   ├── node_modules/
  //   └── packages/frontend/ ← app chunks + .next/server/
  outputFileTracingRoot: path.join(__dirname, '../../'),

  reactStrictMode: true,
  transpilePackages: ['maplibre-gl'],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
    }
    return config
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ]
  },
}

export default nextConfig
