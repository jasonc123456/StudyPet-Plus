/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
