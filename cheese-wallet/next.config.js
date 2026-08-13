const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: false,
  skipWaiting: true,
  customWorkerDir: 'worker',
  buildExcludes: [/app-build-manifest\.json$/],
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
  async redirects() {
    return [
      // These routes were removed, but may still be present in old links or
      // Google's crawl history. Keep them out of the 404 report.
      {
        source: '/earn',
        destination: '/dashboard',
        permanent: true,
      },
      {
        source: '/admin/broadcast',
        destination: '/admin',
        permanent: true,
      },
      // Pay links used to expose only their token. The current page can still
      // resolve the token; the extra segments are legacy URL placeholders.
      {
        source: '/pay/:token',
        destination: '/pay/legacy/0/:token',
        permanent: true,
      },
    ]
  },
}

module.exports = withPWA(nextConfig)
