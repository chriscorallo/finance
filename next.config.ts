import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Content-Security-Policy is set per-request in proxy.ts, not here — it
 * needs a fresh nonce on every request (for Next.js's own inline hydration
 * scripts and next-themes' anti-FOUC script) which a static next.config.ts
 * header can't provide. See proxy.ts for the full policy and rationale.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=()",
  },
  // HSTS tells the browser to remember "always use HTTPS for this host" for
  // up to two years, checked before every future request. Correct in
  // production (behind TLS); actively breaks local HTTP dev the moment the
  // browser sees it once, since every following request/asset load gets
  // upgraded to https:// against a server that has no TLS listener — this
  // was caught by actually running `next dev` and screenshotting the result,
  // not by inspecting the config. Never send it outside production.
  ...(isDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
