'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, SendHorizonal, Clock, User } from 'lucide-react'
import { cn } from '@/lib/cn'

const NAV = [
  { href: '/dashboard', icon: Home,          label: 'Home'    },
  { href: '/send',      icon: SendHorizonal,  label: 'Send'    },
  { href: '/history',   icon: Clock,          label: 'History' },
  { href: '/profile',   icon: User,           label: 'Profile' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-center">
      <div className="w-full max-w-[430px] border-t border-white/8 bg-[#0a0a0a]/95 backdrop-blur-xl">
        <div className="flex items-center justify-around px-2 pb-safe pt-2">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all duration-150',
                  active
                    ? 'text-[#d4a843]'
                    : 'text-white/35 hover:text-white/60',
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                <span className="text-[10px] font-medium tracking-wide">{label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
