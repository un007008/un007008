/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true, // starts node-cron automation on boot
  },
};

export default nextConfig;
