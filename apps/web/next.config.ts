import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Включаем React Compiler для оптимизации
  reactCompiler: true,
  // Standalone output для Docker deployment
  output: "standalone",
};

export default nextConfig;
