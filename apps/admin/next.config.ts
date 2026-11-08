import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Dev-only: allow tunneled origins (remote validation from a phone), the
  // loopback IP and the local network. Next blocks dev assets and the HMR
  // socket from unknown cross-origin hosts, which stops the client from
  // hydrating (the language switcher would render but never run; the same
  // happens when the phone opens the LAN address). Matched on the Origin hostname.
  allowedDevOrigins: ["127.0.0.1", "*.trycloudflare.com", "*.ngrok-free.app", "*.ngrok.io", "192.168.1.*", "027apps.local"],
  transpilePackages: ["@027apps/core", "@027apps/i18n"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        // Baseline hardening for every response (CSP lives in proxy.ts because
        // its nonce must rotate per request).
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        // An HTTP header overrides the page's `<meta name="referrer">`, so the
        // metadata alone would still leak the invitation token in the Referer
        // when the user follows an outbound link. Declared after the global
        // rule because Next applies the last matching entry: with
        // `no-referrer` the token never leaves the URL. `X-Robots-Tag` mirrors
        // `metadata.robots` for crawlers that ignore the meta tag.
        source: "/invite/:token",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
