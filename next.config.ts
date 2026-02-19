import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [process.env.DOMAIN ?? 'example.com'],
  // need to build for our domain
  experimental: {
    authInterrupts: true,
  },
};

export default nextConfig;
