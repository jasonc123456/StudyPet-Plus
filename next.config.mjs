/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Build output location. Deploys build into a throwaway dir (NEXT_DIST_DIR)
  // while the live server keeps serving the current `.next`, then swap the two
  // atomically — so a deploy costs a restart, not a whole build's downtime.
  distDir: process.env.NEXT_DIST_DIR || '.next',
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
