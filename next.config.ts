import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "playwright", "pdfjs-dist"],
  poweredByHeader: false,
  devIndicators: false,
  // The landing is a static page built with the design kit in public/ (public/index.html, public/assets).
  async rewrites() {
    return { beforeFiles: [{ source: "/", destination: "/index.html" }], afterFiles: [], fallback: [] };
  },
};

export default nextConfig;
