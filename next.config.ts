
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http', // Keep original one just in case
        hostname: 'tripath.colivingsoft.site',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https', // For API data
        hostname: 'tripath.colivingsoft.site',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https', // For images from the JSON feed
        hostname: 'tripath.subsys.colivingsoft.app',
        port: '',
        pathname: '/**',
      }
    ],
  },
};

export default nextConfig;
