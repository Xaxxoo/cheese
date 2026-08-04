'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import {
  Coins, Send, Building2, TrendingUp, Shield, Clock, Smartphone, Eye
} from 'lucide-react'

const FEATURES = [
  { icon: Coins,      title: 'Hold Stablecoins',         desc: 'Your balance stays in USDC or USDT — protected from Naira volatility, always ready to spend.' },
  { icon: Send,       title: 'Instant Local Transfers',  desc: 'Send money through local payment rails across Nigeria, Kenya, Rwanda, Ghana, and Ethiopia, straight from your stablecoin balance.' },
  { icon: Building2,  title: 'Familiar Transfer Flow',   desc: 'Bank name, account number, amount, send. The exact same flow you already know from Kuda, Opay, or your bank app.' },
  { icon: TrendingUp, title: 'Spend Without Converting', desc: 'No pre-conversion. No swap. Just enter an amount and send — CheesePay handles everything behind the scenes.' },
  { icon: Shield,     title: 'Device-Secured Wallet',    desc: 'Your funds are protected by cryptographic keys tied to your device. Only you can authorise a transfer.' },
  { icon: Clock,      title: 'Always Available',         desc: 'Send money at midnight on a public holiday. Your stablecoin balance never sleeps and neither does CheesePay.' },
  { icon: Smartphone, title: 'No App Download Needed',   desc: 'CheesePay works beautifully in your mobile browser from day one. Nothing to install.' },
  { icon: Eye,        title: 'Full Transparency',        desc: 'Every transfer, every rate applied, every timestamp — completely visible in your history. Nothing hidden.' },
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
            Your stablecoins, usable everywhere
          </h2>
          <p className="text-[#B5B5B5] max-w-xl mx-auto">
            Live your everyday financial life across five African markets directly from your USDC or USDT balance.
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
