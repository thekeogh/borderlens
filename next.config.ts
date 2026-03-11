import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["dev.borderlens.tools", "*.borderlens.tools", "localhost", "127.0.0.1"],
};

export default nextConfig;
