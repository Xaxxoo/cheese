'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'

const TRANSACTIONS = [
  { id: 'Airtime top-up', amount: '-₦2,000', note: 'MTN · 08012345678', time: '2m ago', type: 'spend' },
  { id: 'USDC received', amount: '+$500.00', note: '→ ₦800,000', time: '8m ago', type: 'fund' },
  { id: 'Bank transfer', amount: '-₦50,000', note: 'To Zenith · Amara O.', time: '1h ago', type: 'spend' },
  { id: 'DSTV payment', amount: '-₦24,500', note: 'Compact Plus', time: '3h ago', type: 'spend' },
  { id: 'USDC received', amount: '+$200.00', note: '→ ₦320,000', time: '6h ago', type: 'fund' },
]

const BARS = [30, 50, 40, 75, 55, 85, 65, 90, 70, 95, 80, 100]

export function DashboardSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section ref={ref} className="py-32 px-6 overflow-hidden" style={{ background: '#0B0B0B' }}>
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-16"
        >
          <div className="text-xs font-medium tracking-[0.2em] uppercase mb-4" style={{ color: '#D4AF37' }}>Your Wallet</div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Everything at a glance
          </h2>
          <p className="text-[#B5B5B5] max-w-xl mx-auto">
            Your balance, spending history, and conversions — beautifully organised in one place.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="rounded-2xl border overflow-hidden"
          style={{ background: '#050505', borderColor: 'rgba(255,255,255,0.08)', boxShadow: '0 0 80px rgba(0,0,0,0.8), 0 0 40px rgba(212,175,55,0.04)' }}
        >
          {/* App header */}
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
            </div>
            <span className="text-[#555] text-xs font-mono">app.cheesepay.xyz</span>
            <div className="w-16" />
          </div>

          <div className="p-6">
            {/* Balance card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Naira Balance', value: '₦1,120,000', change: '+₦320,000 today' },
                { label: 'USDC Balance', value: '$200.00', change: 'Ready to convert' },
                { label: 'Spent this month', value: '₦76,500', change: '5 transactions' },
              ].map((m, i) => (
                <motion.div
                  key={m.label}
                  initial={{ opacity: 0 }}
                  animate={inView ? { opacity: 1 } : {}}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className="rounded-lg p-4 border"
                  style={{ background: '#0B0B0B', borderColor: 'rgba(255,255,255,0.06)' }}
                >
                  <div className="text-[#555] text-[10px] mb-1">{m.label}</div>
                  <div className="text-white font-bold text-lg">{m.value}</div>
                  <div className="text-[#D4AF37] text-[10px] mt-0.5">{m.change}</div>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Spending chart */}
              <div className="lg:col-span-3 rounded-lg border p-4" style={{ background: '#0B0B0B', borderColor: 'rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-white text-xs font-medium">Naira Spending</span>
                  <span className="text-[#555] text-[10px]">Last 12 weeks</span>
                </div>
                <div className="flex items-end gap-1.5 h-24">
                  {BARS.map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ scaleY: 0 }}
                      animate={inView ? { scaleY: 1 } : {}}
                      transition={{ delay: 0.6 + i * 0.05, duration: 0.4 }}
                      style={{ originY: 1, height: `${h}%`, background: i === BARS.length - 1 ? 'linear-gradient(180deg, #D4AF37, #B8941F)' : 'rgba(212,175,55,0.2)' }}
                      className="flex-1 rounded-sm"
                    />
                  ))}
                </div>
              </div>

              {/* Transaction list */}
              <div className="lg:col-span-2 rounded-lg border" style={{ background: '#0B0B0B', borderColor: 'rgba(255,255,255,0.06)' }}>
                <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <span className="text-white text-xs font-medium">Recent Activity</span>
                  <span className="text-[#D4AF37] text-[10px]">Live</span>
                </div>
                <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                  {TRANSACTIONS.map((tx, i) => (
                    <motion.div
                      key={tx.id + i}
                      initial={{ opacity: 0, x: 10 }}
                      animate={inView ? { opacity: 1, x: 0 } : {}}
                      transition={{ delay: 0.7 + i * 0.1 }}
                      className="px-4 py-2.5 flex items-center justify-between"
                      style={{ borderColor: 'rgba(255,255,255,0.04)' }}
                    >
                      <div>
                        <div className="text-white text-[10px] font-medium">{tx.id}</div>
                        <div className="text-[#555] text-[9px] mt-0.5">{tx.note} · {tx.time}</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-[10px] font-medium ${tx.type === 'fund' ? 'text-emerald-400' : 'text-white'}`}>
                          {tx.amount}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
