'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

const FLOATING_CARDS = [
  { label: 'Sent to Zenith Bank', amount: '₦150,000', sub: 'Amara Okafor · Just now', positive: true },
  { label: 'USDC Balance', amount: '$4,820.00', sub: 'Available to spend', positive: true },
  { label: 'Sent to GTBank', amount: '₦45,000', sub: 'Tunde Adewale · 3m ago', positive: false },
  { label: 'Transfer received', amount: '₦891,000', sub: 'From $540 USDC · 8m ago', positive: true },
]

function FloatingCard({ card, delay, x, y }: { card: typeof FLOATING_CARDS[0]; delay: number; x: string; y: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.8, ease: 'easeOut' }}
      style={{ position: 'absolute', left: x, top: y }}
      className="hidden lg:block"
    >
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 5 + delay, repeat: Infinity, ease: 'easeInOut' }}
        className="rounded-2xl p-4 w-[200px]"
        style={{ background: 'rgba(11,11,11,0.9)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)', boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 20px rgba(212,175,55,0.05)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] text-[#555]">{card.label}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>
        <div className="text-white font-bold text-base mb-1">{card.amount}</div>
        <div className="text-[11px]" style={{ color: card.positive ? '#D4AF37' : '#B5B5B5' }}>{card.sub}</div>
      </motion.div>
    </motion.div>
  )
}

export function HeroSection() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '25%'])
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])

  return (
    <section ref={ref} className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden" style={{ background: '#050505' }}>
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.05) 0%, transparent 65%)' }} />
        <div className="absolute -top-40 right-0 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.03) 0%, transparent 70%)' }} />
      </div>

      {/* Subtle grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '80px 80px' }} />

      {/* Floating cards */}
      <motion.div style={{ y, opacity }} className="absolute inset-0 pointer-events-none">
        <FloatingCard card={FLOATING_CARDS[0]} delay={0.8} x="7%" y="22%" />
        <FloatingCard card={FLOATING_CARDS[1]} delay={1.2} x="75%" y="18%" />
        <FloatingCard card={FLOATING_CARDS[2]} delay={1.5} x="73%" y="60%" />
        <FloatingCard card={FLOATING_CARDS[3]} delay={1.0} x="5%" y="64%" />
      </motion.div>

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 md:px-10 py-5"
        style={{ background: 'rgba(5,5,5,0.85)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Cheese Pay" className="w-7 h-7 rounded-lg object-contain" />
          <span className="text-white font-brand font-black uppercase tracking-wide">CheesePay</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          {['Features', 'How It Works', 'Security'].map(item => (
            <a key={item} href={`#${item.toLowerCase().replace(/\s+/g, '-')}`} className="text-sm text-[#666] hover:text-white transition-colors">{item}</a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden sm:block text-sm text-[#666] hover:text-white transition-colors">Sign in</Link>
          <Link href="/signup"
            className="text-sm font-semibold px-5 py-2 rounded-lg text-black transition-all hover:scale-[1.02]"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #B8941F)' }}>
            Get started
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto pt-24">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border mb-10"
          style={{ borderColor: 'rgba(212,175,55,0.25)', background: 'rgba(212,175,55,0.06)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-pulse" />
          <span className="text-xs text-[#D4AF37] font-medium tracking-wide">Nigeria · Kenya · Rwanda · Ghana · Ethiopia</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.2 }}
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white tracking-tight leading-[0.9] mb-6"
        >
          Hold USDC.
          <br />
          <span style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060, #B8941F)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Send Fiat.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-lg md:text-xl text-[#B5B5B5] max-w-xl mx-auto mb-10 leading-relaxed"
        >
          Keep your money in USDC or USDT. Access local payment rails across Nigeria, Kenya, Rwanda, Ghana, and Ethiopia — with the familiar transfer experience you already know.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
        >
          <Link href="/signup"
            className="group flex items-center gap-2 px-8 py-4 rounded-xl text-black font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #B8941F)', boxShadow: '0 0 40px rgba(212,175,55,0.25)' }}>
            Create free account
            <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link href="/login"
            className="px-8 py-4 rounded-xl text-white text-sm font-medium border transition-all hover:bg-white/[0.04]"
            style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            Sign in
          </Link>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0 }}
          className="text-xs text-[#333]"
        >
          No hidden fees · Instant bank transfers · Your stablecoins, usable everywhere
        </motion.p>
      </div>
    </section>
  )
}
