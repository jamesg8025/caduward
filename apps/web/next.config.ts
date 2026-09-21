import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@caduward/shared"],
  serverExternalPackages: ["@caduward/db"],
};

export default nextConfig;
