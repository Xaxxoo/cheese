import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const publicPages = [
    { path: '', priority: 1 },
    { path: '/waitlist', priority: 0.8 },
    { path: '/waitlist/leaderboard', priority: 0.6 },
    { path: '/stats', priority: 0.6 },
    { path: '/privacy', priority: 0.3 },
    { path: '/terms', priority: 0.3 },
  ]

  return [
    ...publicPages.map(({ path, priority }) => ({
      url: `https://cheesepay.xyz${path}`,
      lastModified: new Date(),
      changeFrequency: path === '/privacy' || path === '/terms' ? 'yearly' as const : 'weekly' as const,
      priority,
    })),
  ]
}
