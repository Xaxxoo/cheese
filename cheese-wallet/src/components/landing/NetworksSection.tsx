'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Zap, CheckCircle2 } from 'lucide-react'

const NETWORKS = [
  { name: 'Polygon', speed: '2s', color: '#8247E5', abbr: 'POL' },
  { name: 'Base',    speed: '2s', color: '#0052FF', abbr: 'BASE' },
  { name: 'Arbitrum',speed: '1s', color: '#28A0F0', abbr: 'ARB' },
  { name: 'Optimism',speed: '2s', color: '#FF0420', abbr: 'OP' },
  { name: 'Stellar', speed: '5s', color: '#7D00FF', abbr: 'XLM' },
  { name: 'Celo',    speed: '5s', color: '#35D07F', abbr: 'CELO' },
]

export function NetworksSection() {
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
          <div className="text-xs font-medium tracking-[0.2em] uppercase mb-4" style={{ color: '#D4AF37' }}>Supported Networks</div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Fund from any chain
          </h2>
          <p className="text-[#B5B5B5] max-w-xl mx-auto">
            Send USDC or USDT from whichever network you hold it on. Your wallet, your choice.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {NETWORKS.map((net, i) => (
            <motion.div
              key={net.name}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: i * 0.07, duration: 0.5 }}
              className="group relative rounded-xl p-5 border cursor-default transition-all hover:-translate-y-1"
              style={{ background: '#050505', borderColor: 'rgba(255,255,255,0.06)' }}
            >
              {/* Color accent */}
              <div className="absolute top-0 left-0 right-0 h-px rounded-t-xl transition-opacity opacity-0 group-hover:opacity-100"
                style={{ background: `linear-gradient(90deg, transparent, ${net.color}, transparent)` }} />

              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold"
                  style={{ background: `${net.color}20`, border: `1px solid ${net.color}30`, color: net.color }}>
                  {net.abbr.slice(0, 2)}
                </div>
                <span className="text-white text-sm font-medium">{net.name}</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[#555]">
                    <Zap size={10} />
                    <span className="text-[10px]">Arrives in</span>
                  </div>
                  <span className="text-[#D4AF37] text-[10px] font-mono">{net.speed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[#555]">
                    <CheckCircle2 size={10} />
                    <span className="text-[10px]">USDC & USDT</span>
                  </div>
                  <span className="text-emerald-400 text-[10px]">Supported</span>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-[#555]">Live</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
