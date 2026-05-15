'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'

const TRANSACTIONS = [
  { id: 'TXN-8821', amount: '+$2,400.00', fiat: '₦3,840,000', chain: 'Base', status: 'settled', time: '2m ago' },
  { id: 'TXN-8820', amount: '+$890.50', fiat: 'GHS 13,357', chain: 'Polygon', status: 'settled', time: '8m ago' },
  { id: 'TXN-8819', amount: '+$3,120.00', fiat: 'KES 504,720', chain: 'Arbitrum', status: 'processing', time: '15m ago' },
  { id: 'TXN-8818', amount: '+$540.00', fiat: 'ZAR 10,098', chain: 'Stellar', status: 'settled', time: '23m ago' },
  { id: 'TXN-8817', amount: '+$1,200.00', fiat: '₦1,920,000', chain: 'Base', status: 'settled', time: '41m ago' },
]

const BARS = [40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88]

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
          <div className="text-xs font-medium tracking-[0.2em] uppercase mb-4" style={{ color: '#D4AF37' }}>Dashboard</div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Your settlement command center
          </h2>
          <p className="text-[#B5B5B5] max-w-xl mx-auto">
            Real-time analytics, settlement tracking, and transaction history — all in one place.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="rounded-2xl border overflow-hidden"
          style={{ background: '#050505', borderColor: 'rgba(255,255,255,0.08)', boxShadow: '0 0 80px rgba(0,0,0,0.8), 0 0 40px rgba(212,175,55,0.04)' }}
        >
          {/* Dashboard header */}
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
            </div>
            <span className="text-[#555] text-xs font-mono">merchant.cheesepay.xyz/dashboard</span>
            <div className="w-16" />
          </div>

          <div className="p-6">
            {/* Metric cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Volume (30d)', value: '$148,290', change: '+23.4%' },
                { label: 'Settlements', value: '1,284', change: '+18.2%' },
                { label: 'Avg. Speed', value: '3.2s', change: '-0.4s' },
                { label: 'Success Rate', value: '99.97%', change: '+0.02%' },
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
                  <div className="text-emerald-400 text-[10px] mt-0.5">{m.change}</div>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Chart */}
              <div className="lg:col-span-3 rounded-lg border p-4" style={{ background: '#0B0B0B', borderColor: 'rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-white text-xs font-medium">Settlement Volume</span>
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
                  <span className="text-white text-xs font-medium">Recent Settlements</span>
                  <span className="text-[#D4AF37] text-[10px]">Live</span>
                </div>
                <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                  {TRANSACTIONS.map((tx, i) => (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={inView ? { opacity: 1, x: 0 } : {}}
                      transition={{ delay: 0.7 + i * 0.1 }}
                      className="px-4 py-2.5 flex items-center justify-between"
                      style={{ borderColor: 'rgba(255,255,255,0.04)' }}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white text-[10px] font-mono">{tx.id}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${tx.status === 'settled' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[#D4AF37]/10 text-[#D4AF37]'}`}>
                            {tx.status}
                          </span>
                        </div>
                        <div className="text-[#555] text-[9px] mt-0.5">{tx.chain} · {tx.time}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-white text-[10px] font-medium">{tx.amount}</div>
                        <div className="text-[#555] text-[9px]">{tx.fiat}</div>
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
