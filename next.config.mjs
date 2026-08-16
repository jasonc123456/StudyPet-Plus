/** Public origin the app is served from; drives the HSTS decision below. */
const siteOrigin = (process.env.NEXTAUTH_URL ?? '').replace(/\/+$/, '');
const isHttpsOrigin = siteOrigin.startsWith('https://');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Build output location. Deploys build into a throwaway dir (NEXT_DIST_DIR)
  // while the live server keeps serving the current `.next`, then swap the two
  // atomically — so a deploy costs a restart, not a whole build's downtime.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  experimental: {
    // Lets src/instrumentation.ts run at server boot, where it refuses to start
    // production on a plaintext NEXTAUTH_URL.
    instrumentationHook: true,
  },
  async headers() {
    // HSTS only when the canonical origin is actually HTTPS. Sending it from a
    // plain-HTTP dev server would pin localhost to https in the browser and
    // make the app unreachable until the header expired.
    if (!isHttpsOrigin) return [];

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            // Two years, subdomains included. No `preload` — that is a one-way
            // door and belongs to whoever owns the domain, not this config.
            value: 'max-age=63072000; includeSubDomains',
          },
        ],
      },
    ];
  },
  async redirects() {
    // /dashboard/assignments was renamed to /dashboard/tasks. Bookmarks and
    // links already shared with a study group should keep working.
    return [
      {
        source: '/dashboard/assignments',
        destination: '/dashboard/tasks',
        permanent: true,
      },
      {
        source: '/dashboard/assignments/:path*',
        destination: '/dashboard/tasks/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
