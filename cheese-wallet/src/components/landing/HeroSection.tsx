'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

const CHAINS = ['Polygon', 'Base', 'Arbitrum', 'Stellar', 'Optimism', 'Celo']

const TRANSACTIONS = [
  { from: 'USDC', to: 'NGN', amount: '$2,400.00', status: 'Settled', time: '2s ago', network: 'Base' },
  { from: 'USDC', to: 'GHS', amount: '$890.50', status: 'Settled', time: '5s ago', network: 'Polygon' },
  { from: 'USDC', to: 'KES', amount: '$3,120.00', status: 'Processing', time: '8s ago', network: 'Arbitrum' },
  { from: 'USDC', to: 'ZAR', amount: '$540.00', status: 'Settled', time: '12s ago', network: 'Stellar' },
]

function FloatingCard({ tx, delay, x, y }: { tx: typeof TRANSACTIONS[0]; delay: number; x: string; y: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.8, ease: 'easeOut' }}
      style={{ position: 'absolute', left: x, top: y }}
      className="hidden lg:block"
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4 + delay, repeat: Infinity, ease: 'easeInOut' }}
        className="bg-[#0B0B0B] border border-white/[0.08] rounded-xl p-3 w-[200px] backdrop-blur-sm"
        style={{ boxShadow: '0 0 30px rgba(212,175,55,0.06)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-[#B5B5B5] font-mono">{tx.network}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tx.status === 'Settled' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[#D4AF37]/10 text-[#D4AF37]'}`}>
            {tx.status}
          </span>
        </div>
        <div className="text-white text-sm font-semibold">{tx.amount}</div>
        <div className="flex items-center gap-1 mt-1">
          <span className="text-[10px] text-[#B5B5B5]">{tx.from}</span>
          <ArrowRight size={8} className="text-[#D4AF37]" />
          <span className="text-[10px] text-[#B5B5B5]">{tx.to}</span>
          <span className="text-[10px] text-[#555] ml-auto">{tx.time}</span>
        </div>
      </motion.div>
    </motion.div>
  )
}

export function HeroSection() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '30%'])
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])

  return (
    <section ref={ref} className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#050505]">
      {/* Ambient gold glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.06) 0%, transparent 70%)' }} />
        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.04) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.03) 0%, transparent 70%)' }} />
      </div>

      {/* Grid overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      {/* Floating transaction cards */}
      <motion.div style={{ y, opacity }} className="absolute inset-0 pointer-events-none">
        <FloatingCard tx={TRANSACTIONS[0]} delay={0.8} x="8%" y="20%" />
        <FloatingCard tx={TRANSACTIONS[1]} delay={1.1} x="76%" y="15%" />
        <FloatingCard tx={TRANSACTIONS[2]} delay={1.4} x="72%" y="58%" />
        <FloatingCard tx={TRANSACTIONS[3]} delay={1.7} x="6%" y="62%" />
      </motion.div>

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-8 py-5"
        style={{ background: 'rgba(5,5,5,0.8)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #D4AF37, #B8941F)' }}>
            <span className="text-black text-xs font-bold">C</span>
          </div>
          <span className="text-white font-semibold text-sm tracking-tight">CheesePay</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          {['Products', 'Developers', 'Pricing', 'Company'].map(item => (
            <a key={item} href="#" className="text-[#B5B5B5] hover:text-white text-sm transition-colors">{item}</a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/merchant/sign-in" className="text-sm text-[#B5B5B5] hover:text-white transition-colors hidden sm:block">Sign in</Link>
          <Link href="/merchant/sign-up" className="text-sm font-medium px-4 py-2 rounded-lg text-black transition-all"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #B8941F)' }}>
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero content */}
      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto pt-24">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border mb-8"
          style={{ borderColor: 'rgba(212,175,55,0.3)', background: 'rgba(212,175,55,0.06)' }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-pulse" />
          <span className="text-xs text-[#D4AF37] font-medium tracking-wide">Settlement infrastructure for global commerce</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white leading-[0.9] tracking-tight mb-6"
        >
          Accept Crypto.
          <br />
          <span style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060, #B8941F)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Settle Fiat
          </span>
          <br />
          Instantly.
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-lg md:text-xl text-[#B5B5B5] max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          CheesePay enables businesses to accept USDC payments across multiple blockchain networks while receiving instant fiat settlements directly into their local bank accounts.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
        >
          <Link href="/merchant/sign-up"
            className="group flex items-center gap-2 px-7 py-3.5 rounded-lg text-black font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #B8941F)', boxShadow: '0 0 30px rgba(212,175,55,0.3)' }}>
            Start Accepting Payments
            <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <a href="#demo"
            className="flex items-center gap-2 px-7 py-3.5 rounded-lg text-white text-sm font-medium border transition-all hover:bg-white/[0.04]"
            style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
            Book a Demo
          </a>
        </motion.div>

        {/* Chain badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.9 }}
          className="flex items-center justify-center gap-2 flex-wrap"
        >
          <span className="text-xs text-[#555] mr-1">Supported networks:</span>
          {CHAINS.map((chain, i) => (
            <motion.span
              key={chain}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.9 + i * 0.1 }}
              className="text-xs px-3 py-1 rounded-full border text-[#B5B5B5]"
              style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
            >
              {chain}
            </motion.span>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
