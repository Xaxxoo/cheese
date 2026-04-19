'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { Spinner } from '@/components/ui/Spinner'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, isBooting } = useAuthStore()

  // If already authenticated, send to dashboard
  useEffect(() => {
    if (!isBooting && user) {
      router.replace('/dashboard')
    }
  }, [isBooting, user, router])

  if (isBooting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (user) return null // Redirecting

  return (
    <div className="min-h-screen flex flex-col items-center justify-start pt-safe">
      <div className="w-full max-w-[430px] min-h-screen flex flex-col px-6 py-10">
        {/* Logo */}
        <div className="mb-8">
          <span className="text-[#d4a843] font-display text-2xl font-semibold tracking-tight">
            cheese
          </span>
        </div>
        {children}
      </div>
    </div>
  )
}
