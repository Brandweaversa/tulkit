import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // TypeScript errors now fail the build (all pre-existing errors fixed).
  reactStrictMode: false,
};

export default nextConfig;
