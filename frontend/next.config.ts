import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server.js + minimal node_modules for the Docker image
  output: "standalone",
  /* Crawlers on this list get the share tags in <head>. Everyone else gets them
     streamed in later, which a link preview can miss. Next's own list, plus the
     chat apps it leaves out; setting this replaces the list rather than adding. */
  htmlLimitedBots:
    /[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight|TelegramBot|Viber|Pinterest/i,
  images: {
    /* An allowlist, not a default: any image omitting `quality` is coerced up
       to 100 rather than falling back to Next's default of 75. AppImage always
       passes 100, so every image ships at full quality. AVIF/WebP output keeps
       the byte cost sane. */
    qualities: [100],
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      // Store logos and product images uploaded through the dashboard
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};

export default nextConfig;
