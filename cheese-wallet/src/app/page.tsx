import { HeroSection } from '@/components/landing/HeroSection'
import { MetricsSection } from '@/components/landing/MetricsSection'
import { HowItWorksSection } from '@/components/landing/HowItWorksSection'
import { NetworksSection } from '@/components/landing/NetworksSection'
import { FeaturesSection } from '@/components/landing/FeaturesSection'
import { DashboardSection } from '@/components/landing/DashboardSection'
import { DeveloperSection } from '@/components/landing/DeveloperSection'
import { SecuritySection } from '@/components/landing/SecuritySection'
import { CtaSection } from '@/components/landing/CtaSection'
import { LandingFooter } from '@/components/landing/LandingFooter'

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <MetricsSection />
      <HowItWorksSection />
      <NetworksSection />
      <FeaturesSection />
      <DashboardSection />
      <DeveloperSection />
      <SecuritySection />
      <CtaSection />
      <LandingFooter />
    </main>
  )
}
