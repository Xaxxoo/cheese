'use client'

import { motion, useInView } from 'framer-motion'
import { useRef, useState } from 'react'

const CODE_EXAMPLES = [
  {
    label: 'Create Payment',
    lang: 'typescript',
    code: `import { CheesePay } from '@cheesepay/sdk'

const client = new CheesePay({ apiKey: process.env.CHEESEPAY_KEY })

const payment = await client.payments.create({
  amount: 250.00,
  currency: 'USDC',
  settlementCurrency: 'NGN',
  networks: ['base', 'polygon', 'arbitrum'],
  webhookUrl: 'https://yourapp.com/webhooks',
  metadata: { orderId: 'ORD-9821', customerId: 'C-4422' }
})

// Returns QR code + payment address
console.log(payment.qrCode)     // data:image/png;base64,...
console.log(payment.address)    // 0x742d35Cc...
console.log(payment.expiresAt)  // 2024-01-15T12:30:00Z`,
  },
  {
    label: 'Settlement Webhook',
    lang: 'typescript',
    code: `// POST https://yourapp.com/webhooks

{
  "event": "payment.settled",
  "paymentId": "pay_8Kx9mN2pQ",
  "amount": { "usdc": 250.00, "fiat": 400000, "currency": "NGN" },
  "settlement": {
    "status": "completed",
    "bank": "First Bank Nigeria",
    "reference": "SET-882-NGN",
    "settledAt": "2024-01-15T12:30:04Z",
    "processingTime": "3.8s"
  },
  "blockchain": {
    "network": "base",
    "txHash": "0xabc123...",
    "confirmations": 12,
    "gasUsed": "21000"
  }
}`,
  },
]

function highlightCode(code: string): string {
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/(\/\/.*)/g, '<span style="color:#555">$1</span>')
    .replace(/'([^']*)'/g, '<span style="color:#D4AF37">\'$1\'</span>')
    .replace(/\b(const|import|from|await|async|return)\b/g, '<span style="color:#C792EA">$1</span>')
    .replace(/\b(new|console)\b/g, '<span style="color:#82AAFF">$1</span>')
}

export function DeveloperSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })
  const [activeTab, setActiveTab] = useState(0)

  return (
    <section ref={ref} className="py-32 px-6" style={{ background: '#050505' }}>
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={inView ? { opacity: 1, x: 0 } : {}}>
            <div className="text-xs font-medium tracking-[0.2em] uppercase mb-4" style={{ color: '#D4AF37' }}>Developer Experience</div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
              Built for engineers who care about quality
            </h2>
            <p className="text-[#B5B5B5] leading-relaxed mb-8">
              Clean REST APIs, typed SDKs, real-time webhooks, and comprehensive documentation. Integrate CheesePay in hours, not weeks.
            </p>
            <div className="space-y-3">
              {['TypeScript SDK with full type safety', 'Idempotent API design', 'Real-time webhook events', 'OpenAPI specification', 'Sandbox environment'].map((item, i) => (
                <motion.div
                  key={item}
                  initial={{ opacity: 0, x: -10 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className="flex items-center gap-3 text-sm text-[#B5B5B5]"
                >
                  <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: '#D4AF37' }} />
                  {item}
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right - Code window */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.2 }}
          >
            <div className="rounded-xl border overflow-hidden"
              style={{ background: '#0B0B0B', borderColor: 'rgba(255,255,255,0.08)', boxShadow: '0 0 40px rgba(0,0,0,0.6)' }}>
              {/* Tabs */}
              <div className="flex border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-1.5 px-4 py-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
                </div>
                {CODE_EXAMPLES.map((ex, i) => (
                  <button
                    key={ex.label}
                    onClick={() => setActiveTab(i)}
                    className="px-4 py-3 text-xs border-b-2 transition-colors"
                    style={{
                      borderColor: activeTab === i ? '#D4AF37' : 'transparent',
                      color: activeTab === i ? '#D4AF37' : '#555'
                    }}
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
              {/* Code */}
              <pre className="p-5 text-[11px] leading-relaxed overflow-x-auto font-mono"
                style={{ color: '#B5B5B5' }}>
                <code dangerouslySetInnerHTML={{
                  __html: highlightCode(CODE_EXAMPLES[activeTab].code)
                }} />
              </pre>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
