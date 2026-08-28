import type { NextConfig } from "next";

const pagesExport = process.env.GITHUB_PAGES === "true";
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: pagesExport ? "export" : undefined,
  assetPrefix: basePath || undefined,
  trailingSlash: pagesExport,
};

export default nextConfig;
