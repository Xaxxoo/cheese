'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function CtaSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section ref={ref} className="py-40 px-6 relative overflow-hidden" style={{ background: '#050505' }}>
      {/* Ambient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 70%)' }} />
      </div>

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
        >
          <div className="text-xs font-medium tracking-[0.2em] uppercase mb-6" style={{ color: '#D4AF37' }}>Get Started</div>
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight leading-[0.95]">
            The future of global
            <br />
            <span style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060, #B8941F)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              settlement infrastructure
            </span>
          </h2>
          <p className="text-[#B5B5B5] text-lg max-w-xl mx-auto mb-12 leading-relaxed">
            Accept stablecoins globally. Settle fiat locally. Without complexity.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/merchant/sign-up"
              className="group flex items-center gap-2 px-8 py-4 rounded-lg text-black font-semibold transition-all hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg, #D4AF37, #B8941F)', boxShadow: '0 0 40px rgba(212,175,55,0.25)' }}>
              Start Building
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a href="mailto:hello@cheesepay.xyz"
              className="px-8 py-4 rounded-lg text-white text-sm font-medium border transition-all hover:bg-white/[0.04]"
              style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
              Contact Sales
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
