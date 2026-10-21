import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Photos are shrunk in the browser first (~100-300 KB), but leave headroom for big logos.
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
};

export default nextConfig;
