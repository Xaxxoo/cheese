import type { Metadata } from 'next'
import { PlatformStatsSection } from '@/components/landing/PlatformStatsSection'

export const metadata: Metadata = {
  title: 'CheesePay — Platform Metrics',
  description:
    'Live aggregated platform statistics for CheesePay: users, transaction volume, Stellar wallets, and tier distribution.',
  openGraph: {
    title: 'CheesePay — Platform Metrics',
    description:
      'Live aggregated platform statistics for CheesePay: users, transaction volume, Stellar wallets, and tier distribution.',
    url: 'https://cheesepay.xyz/stats',
  },
}

export default function StatsPage() {
  return (
    <main className="min-h-screen bg-[#080808]">
      <PlatformStatsSection />
    </main>
  )
}
