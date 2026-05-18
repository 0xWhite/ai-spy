import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  distDir: ".next-codex-ai-spy-mvp",
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
