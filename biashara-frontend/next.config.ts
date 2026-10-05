import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/api/:path*",
      },
      {
        source: "/assistant/:path*",
        destination: "http://127.0.0.1:8000/assistant/:path*",
      },
    ];
  },
};

export default nextConfig;

