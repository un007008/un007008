/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true, // starts node-cron automation on boot
  },
  async redirects() {
    // no locale-routing middleware — send bare paths to the default locale
    return [
      { source: "/properties", destination: "/th/properties", permanent: false },
      { source: "/properties/:slug", destination: "/th/properties/:slug", permanent: false },
      { source: "/blog", destination: "/th/blog", permanent: false },
      { source: "/blog/:slug", destination: "/th/blog/:slug", permanent: false },
      // short entry point for the accounting team
      { source: "/accounting", destination: "/admin/accounting", permanent: false },
      { source: "/accounting/:path*", destination: "/admin/accounting/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
