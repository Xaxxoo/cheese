'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, Zap } from 'lucide-react'

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

      <div className="flex flex-col items-center justify-center flex-1 px-6 mt-12 text-center">
        <div className="w-20 h-20 rounded-full bg-[#d4a843]/10 flex items-center justify-center mb-5">
          <Zap size={36} className="text-[#d4a843]" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Coming Soon</h2>
        <p className="text-sm text-white/45 leading-relaxed max-w-xs">
          Bill payments — airtime, data, cable TV, and electricity — are on their way. We&apos;ll let you know as soon as they&apos;re live.
        </p>
      </div>
    </div>
  )
}
