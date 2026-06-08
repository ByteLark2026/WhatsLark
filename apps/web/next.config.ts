import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@whatslark/shared'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'ui-avatars.com' },
    ],
  },
};

export default nextConfig;
