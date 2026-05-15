'use client'

import { motion, useInView } from 'framer-motion'
import { useRef, useEffect, useState } from 'react'

const METRICS = [
  { value: 7, suffix: '+', label: 'Blockchain Networks', sublabel: 'Polygon, Base, Arbitrum & more' },
  { value: 99.99, suffix: '%', label: 'Uptime SLA', sublabel: 'Enterprise-grade reliability' },
  { value: 5, suffix: 's', prefix: '<', label: 'Settlement Routing', sublabel: 'Average transaction speed' },
  { value: 40, suffix: '+', label: 'Fiat Currencies', sublabel: 'Local settlement worldwide' },
]

function CountUp({ value, suffix, prefix }: { value: number; suffix: string; prefix?: string }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })

  useEffect(() => {
    if (!inView) return
    const duration = 1500
    const start = Date.now()
    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setDisplay(parseFloat((value * ease).toFixed(value % 1 !== 0 ? 2 : 0)))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [inView, value])

  return (
    <span ref={ref} className="font-bold text-white">
      {prefix}{value % 1 !== 0 ? display.toFixed(2) : Math.floor(display)}{suffix}
    </span>
  )
}

export function MetricsSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section ref={ref} className="py-24 px-6 bg-[#050505] border-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px" style={{ background: 'rgba(255,255,255,0.04)' }}>
          {METRICS.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              className="bg-[#050505] p-8 group hover:bg-[#0B0B0B] transition-colors"
            >
              <div className="text-4xl md:text-5xl font-bold mb-2" style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                <CountUp value={m.value} suffix={m.suffix} prefix={m.prefix} />
              </div>
              <div className="text-white text-sm font-medium mb-1">{m.label}</div>
              <div className="text-[#555] text-xs">{m.sublabel}</div>
              <div className="mt-4 h-px w-8 transition-all group-hover:w-16" style={{ background: 'linear-gradient(90deg, #D4AF37, transparent)' }} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
