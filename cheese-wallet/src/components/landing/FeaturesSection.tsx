'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import {
  Zap, TrendingUp, Send, Receipt, Shield, Clock, Smartphone, Eye
} from 'lucide-react'

const FEATURES = [
  { icon: Zap, title: 'Instant Conversion', desc: 'USDC converts to Naira the moment it hits your wallet. No waiting, no processing delays.' },
  { icon: TrendingUp, title: 'Live Exchange Rates', desc: 'We use real market rates with zero hidden markup. You always know what you\'re getting.' },
  { icon: Send, title: 'Send to Any Bank', desc: 'Transfer Naira directly to any Nigerian bank account in seconds. No charges, no friction.' },
  { icon: Receipt, title: 'Pay Bills & Airtime', desc: 'Top up your data, pay DSTV, NEPA, and more — straight from your CheesePay balance.' },
  { icon: Shield, title: 'Device-Secured', desc: 'Your wallet is locked to your device with cryptographic keys. Only you can access it.' },
  { icon: Clock, title: 'Available 24/7', desc: 'Send money at 2am on a Sunday. CheesePay never sleeps, never delays, never blocks you.' },
  { icon: Smartphone, title: 'Works on Any Phone', desc: 'No app download needed. CheesePay works beautifully in your mobile browser from day one.' },
  { icon: Eye, title: 'Full Transparency', desc: 'Every conversion, every transfer, every fee — visible in your history. Nothing hidden.' },
]

export function FeaturesSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section ref={ref} id="features" className="py-32 px-6" style={{ background: '#050505' }}>
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-20"
        >
          <div className="text-xs font-medium tracking-[0.2em] uppercase mb-4" style={{ color: '#D4AF37' }}>Features</div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Built for real life
          </h2>
          <p className="text-[#B5B5B5] max-w-xl mx-auto">
            Everything you need to turn your USDC into spending power — simply and immediately.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {FEATURES.map((f, i) => {
            const Icon = f.icon
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.06 }}
                className="group rounded-xl p-6 border transition-all cursor-default hover:-translate-y-1"
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
