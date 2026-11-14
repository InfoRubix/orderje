import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Photos are shrunk in the browser first (~100-300 KB), but leave headroom for big logos.
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  // The service worker must be re-checked on every load so a new deploy replaces it promptly.
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] }];
  },
};

export default nextConfig;
