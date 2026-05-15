'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import {
  Zap, QrCode, Activity, BarChart3, LayoutDashboard,
  Webhook, Globe, Shield, Timer, Code
} from 'lucide-react'

const FEATURES = [
  { icon: Zap, title: 'Instant Fiat Settlement', desc: 'USDC received, fiat wired to your bank account in seconds. No delays, no volatility.' },
  { icon: QrCode, title: 'QR Payments', desc: 'Generate dynamic QR codes for any amount. Works with every major USDC wallet.' },
  { icon: Activity, title: 'Blockchain Monitoring', desc: 'Real-time confirmation tracking across all supported networks with automated retry.' },
  { icon: BarChart3, title: 'Automated Reconciliation', desc: 'Every payment, settlement, and conversion automatically reconciled and audit-ready.' },
  { icon: LayoutDashboard, title: 'Merchant Dashboard', desc: 'A powerful, clean dashboard for tracking volumes, settlements, and performance.' },
  { icon: Webhook, title: 'Webhooks & APIs', desc: 'Event-driven webhooks and a clean REST API. Build exactly what your business needs.' },
  { icon: Globe, title: 'Multi-Currency Support', desc: 'Settle in NGN, GHS, KES, ZAR, GBP, EUR, and 40+ more. Local currency always.' },
  { icon: Shield, title: 'Enterprise Security', desc: 'Multi-layer security, encrypted key management, and full regulatory compliance.' },
  { icon: Timer, title: 'Real-Time Tracking', desc: 'Live transaction status from blockchain confirmation to fiat settlement in your dashboard.' },
  { icon: Code, title: 'Developer SDKs', desc: 'TypeScript, Python, and Go SDKs. Comprehensive docs. Get live in hours, not weeks.' },
]

export function FeaturesSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section ref={ref} className="py-32 px-6" style={{ background: '#050505' }}>
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-20"
        >
          <div className="text-xs font-medium tracking-[0.2em] uppercase mb-4" style={{ color: '#D4AF37' }}>Platform</div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Everything you need to scale
          </h2>
          <p className="text-[#B5B5B5] max-w-xl mx-auto">
            Built for enterprises that need reliable, high-throughput global payment infrastructure.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {FEATURES.map((f, i) => {
            const Icon = f.icon
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.06 }}
                className={`group rounded-xl p-6 border transition-all cursor-default hover:-translate-y-1 ${i === 0 || i === 4 ? 'sm:col-span-2 lg:col-span-1 xl:col-span-2' : ''}`}
                style={{ background: '#0B0B0B', borderColor: 'rgba(255,255,255,0.06)' }}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-4 transition-all group-hover:scale-110"
                  style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.15)' }}>
                  <Icon size={16} style={{ color: '#D4AF37' }} />
                </div>
                <h3 className="text-white font-medium text-sm mb-2">{f.title}</h3>
                <p className="text-[#555] text-xs leading-relaxed">{f.desc}</p>
                <div className="mt-4 h-px w-0 group-hover:w-full transition-all duration-500"
                  style={{ background: 'linear-gradient(90deg, rgba(212,175,55,0.3), transparent)' }} />
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
