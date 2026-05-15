'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Shield, Lock, Fingerprint, Bell, Eye, Key } from 'lucide-react'

const ITEMS = [
  { icon: Key, title: 'Your Keys, Your Wallet', desc: 'Each device generates its own cryptographic key pair. Only your device can authorise transactions — not us.' },
  { icon: Lock, title: 'No Passwords Stored', desc: 'We never store your password. Authentication is handled by your device\'s secure hardware, the same way your phone unlocks.' },
  { icon: Fingerprint, title: 'Biometric Lock', desc: 'Tie your wallet to Face ID or fingerprint. Your funds can\'t be accessed without you physically present.' },
  { icon: Bell, title: 'Instant Alerts', desc: 'Every conversion, transfer, and login attempt triggers a real-time notification. You\'re always in the know.' },
  { icon: Eye, title: 'Full Audit Trail', desc: 'Every action in your wallet is logged and visible to you. Cryptographic receipts for every transaction.' },
  { icon: Shield, title: 'Always Monitored', desc: 'Our systems watch for unusual activity 24/7. Suspicious actions are flagged and blocked before they reach you.' },
]

export function SecuritySection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section ref={ref} id="security" className="py-32 px-6" style={{ background: '#0B0B0B' }}>
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-20"
        >
          <div className="text-xs font-medium tracking-[0.2em] uppercase mb-4" style={{ color: '#D4AF37' }}>Security</div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Your money is yours
          </h2>
          <p className="text-[#B5B5B5] max-w-xl mx-auto">
            Built with the same security principles used by the world&apos;s most trusted financial institutions — for everyone.
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
