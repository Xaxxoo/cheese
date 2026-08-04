'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'

const COUNTRIES = [
  { name: 'Kenya', flag: '🇰🇪' },
  { name: 'Rwanda', flag: '🇷🇼' },
  { name: 'Ghana', flag: '🇬🇭' },
  { name: 'Ethiopia', flag: '🇪🇹' },
  { name: 'Nigeria', flag: '🇳🇬' },
]

export function CoverageSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section
      ref={ref}
      className="py-24 px-6 border-y"
      style={{ background: '#080808', borderColor: 'rgba(255,255,255,0.04)' }}
      aria-label="CheesePay coverage areas"
    >
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-12"
        >
          <div className="text-xs font-medium tracking-[0.2em] uppercase mb-4" style={{ color: '#D4AF37' }}>
            Areas of coverage
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">
            One wallet. Five African markets.
          </h2>
          <p className="text-[#B5B5B5] max-w-2xl mx-auto">
            Hold stablecoins and access local payment rails across Nigeria, Kenya, Rwanda, Ghana, and Ethiopia.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {COUNTRIES.map((country, i) => (
            <motion.div
              key={country.name}
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="rounded-xl p-5 text-center border"
              style={{ background: '#050505', borderColor: 'rgba(212,175,55,0.16)' }}
            >
              <div className="text-3xl mb-3" aria-hidden="true">{country.flag}</div>
              <div className="text-white text-sm font-medium">{country.name}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
