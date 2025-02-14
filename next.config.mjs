/** @type {import('next').NextConfig} */
const nextConfig = {
    compress: true,
    poweredByHeader: false,
    reactStrictMode: true,
    swcMinify: true,
    httpAgentOptions: {
        keepAlive: true,
    },
    headers: async () => [
        {
            source: '/:path*',
            headers: [
                {
                    key: 'Connection',
                    value: 'keep-alive',
                },
                {
                    key: 'Keep-Alive',
                    value: 'timeout=5, max=1000',
                },
            ],
        },
    ],
    experimental: {
        quic: false,
    },
};

export default nextConfig;