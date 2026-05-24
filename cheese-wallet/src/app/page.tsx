import { HeroSection } from '@/components/landing/HeroSection'
import { MetricsSection } from '@/components/landing/MetricsSection'
import { HowItWorksSection } from '@/components/landing/HowItWorksSection'
import { FeaturesSection } from '@/components/landing/FeaturesSection'
import { DashboardSection } from '@/components/landing/DashboardSection'
import { NetworksSection } from '@/components/landing/NetworksSection'
import { SecuritySection } from '@/components/landing/SecuritySection'
import { CtaSection } from '@/components/landing/CtaSection'
import { FaqSection } from '@/components/landing/FaqSection'
import { LandingFooter } from '@/components/landing/LandingFooter'

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <MetricsSection />
      <HowItWorksSection />
      <FeaturesSection />
      <DashboardSection />
      <NetworksSection />
      <SecuritySection />
      <CtaSection />
      <FaqSection />
      <LandingFooter />
    </main>
  )
}
