import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server.js + minimal node_modules for the Docker image
  output: "standalone",
  images: {
    /* An allowlist, not a default: any image omitting `quality` is coerced up
       to 100 rather than falling back to Next's default of 75. AppImage always
       passes 100, so every image ships at full quality. AVIF/WebP output keeps
       the byte cost sane. */
    qualities: [100],
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
