import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["test.buildyourresume.in"],
  experimental: {
    authInterrupts: true,
  },
};

export default nextConfig;
