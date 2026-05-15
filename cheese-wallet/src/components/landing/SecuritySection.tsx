'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Shield, Lock, Eye, RefreshCw, Server, FileCheck } from 'lucide-react'

const ITEMS = [
  { icon: Shield, title: 'Automated Monitoring', desc: 'Every transaction monitored in real-time across all supported chains. Anomalies detected and flagged instantly.' },
  { icon: Lock, title: 'Secure Settlement Engine', desc: 'Multi-signature authorization with hardware security modules for all fiat disbursements.' },
  { icon: Eye, title: 'Confirmation Tracking', desc: 'Configurable confirmation thresholds per network. Accept risk-appropriate confirmation levels for your use case.' },
  { icon: RefreshCw, title: 'Automatic Retry Systems', desc: 'Failed transactions automatically retried with exponential backoff. No manual intervention required.' },
  { icon: Server, title: 'Enterprise Infrastructure', desc: '99.99% SLA with multi-region redundancy, automated failover, and zero-downtime deployments.' },
  { icon: FileCheck, title: 'Audit-Ready Ledger', desc: 'Immutable transaction ledger with cryptographic proofs. Every settlement reconciled and exportable.' },
]

export function SecuritySection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section ref={ref} className="py-32 px-6" style={{ background: '#0B0B0B' }}>
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-20"
        >
          <div className="text-xs font-medium tracking-[0.2em] uppercase mb-4" style={{ color: '#D4AF37' }}>Security</div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Resilient by architecture
          </h2>
          <p className="text-[#B5B5B5] max-w-xl mx-auto">
            Enterprise-grade security and reliability baked into every layer of the stack.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {ITEMS.map((item, i) => {
            const Icon = item.icon
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.1 }}
                className="group rounded-xl p-6 border transition-all hover:-translate-y-1"
                style={{ background: '#050505', borderColor: 'rgba(255,255,255,0.06)' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.12)' }}>
                  <Icon size={18} style={{ color: '#D4AF37' }} />
                </div>
                <h3 className="text-white font-medium text-sm mb-2">{item.title}</h3>
                <p className="text-[#555] text-xs leading-relaxed">{item.desc}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
