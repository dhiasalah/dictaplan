import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // a stray package-lock.json in the user's home folder would otherwise be picked as the workspace root
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
