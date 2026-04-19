'use client'

import Link from 'next/link'
import { Bell } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

interface AppHeaderProps {
  title?: string
}

export function AppHeader({ title }: AppHeaderProps) {
  const { user } = useAuthStore()

  return (
    <header className="sticky top-0 z-40 flex justify-center">
      <div className="w-full max-w-[430px] flex items-center justify-between px-6 py-4 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/6">
        {title ? (
          <h1 className="text-base font-semibold text-white">{title}</h1>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[#d4a843] font-display text-lg font-semibold">cheese</span>
            {user && (
              <span className="text-white/30 text-sm">·</span>
            )}
            {user && (
              <span className="text-white/50 text-sm">@{user.username}</span>
            )}
          </div>
        )}

        <Link
          href="/notifications"
          className="relative w-9 h-9 flex items-center justify-center rounded-full bg-white/6 hover:bg-white/10 transition-colors"
        >
          <Bell size={17} className="text-white/70" />
          {/* Unread dot — always shown until notifications are built */}
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#d4a843]" />
        </Link>
      </div>
    </header>
  )
}
