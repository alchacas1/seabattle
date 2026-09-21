import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@sea-battle/shared-types", "@sea-battle/game-engine"],
};

export default nextConfig;
