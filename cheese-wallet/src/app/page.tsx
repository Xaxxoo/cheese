import Link from 'next/link'
import { HeroSection } from '@/components/sections/HeroSection'
import { FeaturesSection } from '@/components/sections/FeaturesSection'
import { Footer } from '@/components/sections/Footer'

export default function HomePage() {
  return (
    <>
      <HeroSection />

      {/* Primary CTA */}
      <section className="px-6 pb-24 text-center">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-[#d4a843] hover:bg-[#c49535] text-[#0a0a0a] text-sm font-bold tracking-wide transition-colors"
          >
            Get started — it&apos;s free
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-8 py-4 rounded-full border border-white/10 hover:border-white/20 text-sm font-medium text-white/60 hover:text-white transition-colors"
          >
            Sign in
          </Link>
        </div>
      </section>

      <FeaturesSection />
      <Footer />
    </>
  )
}
