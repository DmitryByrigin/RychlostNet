/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: undefined,
    serverComponentsExternalPackages: ['@prisma/client', 'bcrypt'],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
        crypto: false,
        stream: false,
        path: false,
        process: false,
        buffer: false,
      };
    }
    return config;
  },
  transpilePackages: [
    '@mantine/core',
    '@mantine/hooks',
    '@mantine/form',
  ],
}

module.exports = nextConfig
