import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Both workspace packages ship TypeScript source (JIT), so Next compiles them.
  transpilePackages: ["@ketryon/db", "@ketryon/jobs"],
};

export default nextConfig;
