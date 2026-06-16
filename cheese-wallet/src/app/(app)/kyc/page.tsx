'use client'

import Link from 'next/link'
import { ArrowLeft, Clock } from 'lucide-react'

export default function KycPage() {
  return (
    <div className="flex flex-col pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <Link
          href="/profile"
          className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/12 transition-all"
        >
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-base font-semibold text-white">Verify Identity</h1>
      </div>

      <div className="flex flex-col items-center justify-center flex-1 px-6 mt-16 text-center">
        <div className="w-20 h-20 rounded-full bg-[#d4a843]/10 flex items-center justify-center mb-5">
          <Clock size={36} className="text-[#d4a843]" />
        </div>

        <h2 className="text-xl font-semibold text-white mb-2">
          KYC Not Open Yet
        </h2>
        <p className="text-sm text-white/45 leading-relaxed max-w-xs mb-8">
          We are currently in a closed testing phase and KYC verification is not open to the general public yet.
          {'\n\n'}
          If you personally know the founder you can reach out directly to get verified early.
        </p>

        <a
          href="https://t.me/Xaxxoo23"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-[#d4a843] text-black text-sm font-semibold"
        >
          Message on Telegram
        </a>
      </div>
    </div>
  )
}
