'use client'

import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ComingSoonPage() {
  const router = useRouter()
  return (
    <div className="flex flex-col flex-1 px-6 py-8">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-10"
      >
        <ArrowLeft size={18} />
        <span className="text-sm">Back</span>
      </button>
      <div className="flex flex-col items-center gap-4 pt-16 text-center">
        <div className="w-16 h-16 rounded-full bg-[#d4a843]/10 border border-[#d4a843]/20 flex items-center justify-center">
          <span className="text-2xl">🧀</span>
        </div>
        <div>
          <p className="text-lg font-semibold text-white mb-1">Coming soon</p>
          <p className="text-sm text-white/40">This feature is being built. Check back soon.</p>
        </div>
      </div>
    </div>
  )
}
