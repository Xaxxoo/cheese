'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Wallet, Building2, CheckCircle2 } from 'lucide-react'

const STEPS = [
  {
    icon: Wallet,
    step: '01',
    title: 'Fund Your Wallet',
    description: 'Add USDC or USDT from any supported network. Your stablecoin balance is your spending power — no pre-conversion required.',
    detail: 'USDC & USDT supported',
  },
  {
    icon: Building2,
    step: '02',
    title: 'Enter Bank Details',
    description: 'Pick a bank, enter an account number, type an amount. Exactly like every Nigerian bank transfer you have ever made.',
    detail: 'GTBank, Zenith, Kuda, Opay & more',
  },
  {
    icon: CheckCircle2,
    step: '03',
    title: 'Recipient Gets Naira',
    description: 'Your stablecoins are quietly settled in the background. The recipient receives Naira in their bank account — instantly.',
    detail: 'Instant. No crypto knowledge needed.',
  },
]

export function HowItWorksSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section ref={ref} id="how-it-works" className="py-32 px-6" style={{ background: '#050505' }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <div className="text-xs font-medium tracking-[0.2em] uppercase mb-4" style={{ color: '#D4AF37' }}>How It Works</div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Feels exactly like banking
          </h2>
          <p className="text-[#B5B5B5] max-w-xl mx-auto">
            The transfer experience you already know — powered by stablecoins underneath.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="relative">
          {/* Connecting line */}
          <div className="hidden lg:block absolute top-16 left-[16.5%] right-[16.5%] h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.3), rgba(212,175,55,0.3), transparent)' }} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {STEPS.map((step, i) => {
              const Icon = step.icon
              return (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, y: 30 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: i * 0.2, duration: 0.7 }}
                  className="relative group"
                >
                  <div className="rounded-2xl p-8 border transition-all h-full"
                    style={{ background: '#0B0B0B', borderColor: 'rgba(255,255,255,0.06)' }}
                  >
                    <div className="flex items-center gap-4 mb-6">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center border"
                          style={{ background: 'rgba(212,175,55,0.08)', borderColor: 'rgba(212,175,55,0.2)' }}>
                          <Icon size={20} style={{ color: '#D4AF37' }} />
                        </div>
                        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-black"
                          style={{ background: 'linear-gradient(135deg, #D4AF37, #B8941F)' }}>
                          {i + 1}
                        </div>
                      </div>
                      <span className="text-[#333] font-bold text-3xl font-mono">{step.step}</span>
                    </div>

                    <h3 className="text-white font-semibold text-lg mb-3">{step.title}</h3>
                    <p className="text-[#B5B5B5] text-sm leading-relaxed mb-4">{step.description}</p>
                    <div className="text-xs px-3 py-1.5 rounded-full inline-block"
                      style={{ background: 'rgba(212,175,55,0.08)', color: '#D4AF37' }}>
                      {step.detail}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Behind the scenes note */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="mt-12 text-center"
        >
          <p className="text-xs text-[#444] max-w-md mx-auto leading-relaxed">
            Behind the scenes, CheesePay handles stablecoin deduction, conversion, and bank settlement — completely invisibly to the recipient.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
