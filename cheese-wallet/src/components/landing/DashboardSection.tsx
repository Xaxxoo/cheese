'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { ChevronDown, ArrowUpRight } from 'lucide-react'

const RECENT_TRANSFERS = [
  { name: 'Amara Okafor',  bank: 'Zenith Bank',  amount: '₦150,000', usdc: '$93.75',  time: '2m ago',  initials: 'AO' },
  { name: 'Tunde Adewale', bank: 'GTBank',        amount: '₦45,000',  usdc: '$28.13',  time: '1h ago',  initials: 'TA' },
  { name: 'Ngozi Eze',     bank: 'Access Bank',   amount: '₦200,000', usdc: '$125.00', time: '3h ago',  initials: 'NE' },
  { name: 'Seun Lawal',    bank: 'Kuda',          amount: '₦80,000',  usdc: '$50.00',  time: '5h ago',  initials: 'SL' },
]

const BANKS = ['GTBank', 'Zenith Bank', 'Access Bank', 'First Bank', 'Kuda', 'Opay', 'Moniepoint', 'UBA']

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
          <div className="text-xs font-medium tracking-[0.2em] uppercase mb-4" style={{ color: '#D4AF37' }}>The Experience</div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Feels like banking.<br />Powered by crypto.
          </h2>
          <p className="text-[#B5B5B5] max-w-xl mx-auto">
            A transfer experience so familiar, you won&apos;t think twice about the stablecoins underneath.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="rounded-2xl border overflow-hidden"
          style={{ background: '#050505', borderColor: 'rgba(255,255,255,0.08)', boxShadow: '0 0 80px rgba(0,0,0,0.8), 0 0 40px rgba(212,175,55,0.04)' }}
        >
          {/* Browser chrome */}
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
            </div>
            <span className="text-[#555] text-xs font-mono">app.cheesepay.xyz</span>
            <div className="w-16" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">

            {/* LEFT — Balance + recent transfers */}
            <div className="p-6 border-r" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              {/* Balance */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 1 } : {}}
                transition={{ delay: 0.4 }}
                className="rounded-xl p-5 mb-5 border"
                style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.06), rgba(212,175,55,0.02))', borderColor: 'rgba(212,175,55,0.12)' }}
              >
                <div className="text-[#555] text-[10px] mb-1 uppercase tracking-wider">Total Balance</div>
                <div className="text-white text-3xl font-bold mb-1">$4,820.00</div>
                <div className="text-[#D4AF37] text-xs">USDC · ≈ ₦7,712,000 at current rate</div>
              </motion.div>

              {/* Recent transfers */}
              <div className="mb-2 flex items-center justify-between">
                <span className="text-white text-xs font-medium">Recent Transfers</span>
                <span className="text-[#D4AF37] text-[10px]">Live</span>
              </div>

              <div className="space-y-1">
                {RECENT_TRANSFERS.map((tx, i) => (
                  <motion.div
                    key={tx.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={inView ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: 0.5 + i * 0.08 }}
                    className="flex items-center gap-3 py-2.5 px-3 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.02)' }}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-black flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #D4AF37, #B8941F)' }}>
                      {tx.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-[11px] font-medium truncate">{tx.name}</div>
                      <div className="text-[#555] text-[9px]">{tx.bank} · {tx.time}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-white text-[11px] font-medium">{tx.amount}</div>
                      <div className="text-[#555] text-[9px]">{tx.usdc} USDC</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* RIGHT — Transfer form */}
            <div className="p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 1 } : {}}
                transition={{ delay: 0.5 }}
              >
                <div className="text-white text-sm font-semibold mb-5">Send Money</div>

                {/* Bank picker */}
                <div className="mb-3">
                  <div className="text-[#555] text-[10px] mb-1.5 uppercase tracking-wider">Bank</div>
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border cursor-default"
                    style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
                    <span className="text-white text-xs">Zenith Bank</span>
                    <ChevronDown size={13} className="text-[#555]" />
                  </div>
                  {/* Bank chips */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {BANKS.slice(0, 5).map((bank, i) => (
                      <motion.div
                        key={bank}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={inView ? { opacity: 1, scale: 1 } : {}}
                        transition={{ delay: 0.6 + i * 0.05 }}
                        className="px-2 py-1 rounded-md text-[9px] cursor-default"
                        style={{
                          background: bank === 'Zenith Bank' ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.04)',
                          color: bank === 'Zenith Bank' ? '#D4AF37' : '#555',
                          border: `1px solid ${bank === 'Zenith Bank' ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.06)'}`,
                        }}
                      >
                        {bank}
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Account number */}
                <div className="mb-3">
                  <div className="text-[#555] text-[10px] mb-1.5 uppercase tracking-wider">Account Number</div>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border"
                    style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
                    <span className="text-white text-xs font-mono tracking-widest">0123456789</span>
                  </div>
                  <div className="mt-1.5 px-3 py-1.5 rounded-md flex items-center gap-2"
                    style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.1)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                    <span className="text-[10px] text-[#B5B5B5]">Amara Okafor</span>
                  </div>
                </div>

                {/* Amount */}
                <div className="mb-5">
                  <div className="text-[#555] text-[10px] mb-1.5 uppercase tracking-wider">Amount (Fiat)</div>
                  <div className="px-3 py-2.5 rounded-lg border"
                    style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
                    <div className="text-white text-lg font-bold">₦150,000</div>
                    <div className="text-[#555] text-[10px] mt-0.5">≈ $93.75 USDC will be deducted</div>
                  </div>
                </div>

                {/* Send button */}
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={inView ? { opacity: 1 } : {}}
                  transition={{ delay: 0.9 }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-black text-sm font-bold cursor-default"
                  style={{ background: 'linear-gradient(135deg, #D4AF37, #B8941F)', boxShadow: '0 0 20px rgba(212,175,55,0.2)' }}
                >
                  Send ₦150,000
                  <ArrowUpRight size={14} />
                </motion.button>

                <p className="text-center text-[#333] text-[9px] mt-3">
                  Recipient gets Fiat · You spend USDC
                </p>
              </motion.div>
            </div>

          </div>
        </motion.div>
      </div>
    </section>
  )
}
