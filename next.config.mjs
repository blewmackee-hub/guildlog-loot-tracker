/** @type {import('next').NextConfig} */

// Low-risk hardening headers. Deliberately no full Content-Security-Policy:
// the app pulls Google Fonts and item icons from external hosts and Next
// injects inline scripts, so a CSP needs testing in a browser first -
// only the framing directive is set here.
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
];

const nextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
