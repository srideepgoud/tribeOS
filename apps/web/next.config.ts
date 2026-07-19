import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Compile the workspace UI package from source.
  transpilePackages: ["@tribeos/ui"],
};

export default nextConfig;
