'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, PhoneCall, Wifi, Tv, Zap } from 'lucide-react'
import { cn } from '@/lib/cn'

const BILL_TYPES = [
  {
    id: 'airtime',
    label: 'Airtime',
    desc: 'Top up any Nigerian network',
    icon: PhoneCall,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    href: '/bills/airtime',
  },
  {
    id: 'data',
    label: 'Data',
    desc: 'Buy mobile data bundles',
    icon: Wifi,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    href: '/bills/data',
  },
  {
    id: 'tv',
    label: 'Cable TV',
    desc: 'Pay DSTV, GOTV & StarTimes',
    icon: Tv,
    color: 'text-violet-400',
    bg: 'bg-violet-400/10',
    href: '/bills/tv',
  },
  {
    id: 'electricity',
    label: 'Electricity',
    desc: 'Pay electricity bills & buy units',
    icon: Zap,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    href: '/bills/electricity',
  },
]

export default function BillsPage() {
  const router = useRouter()

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/12 transition-all"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-semibold text-white">Pay Bills</h1>
      </div>

      {/* Bill type cards */}
      <div className="px-4 flex flex-col gap-3 mt-2">
        {BILL_TYPES.map(({ id, label, desc, icon: Icon, color, bg, href }) => (
          <Link
            key={id}
            href={href}
            className="flex items-center gap-4 px-4 py-4 rounded-2xl border border-white/8 bg-white/4 hover:bg-white/7 active:bg-white/10 transition-colors"
          >
            <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center shrink-0', bg)}>
              <Icon size={22} className={color} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className="text-xs text-white/45 mt-0.5">{desc}</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-white/25 shrink-0">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  )
}
