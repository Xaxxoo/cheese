'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { getMe } from '@/lib/api/auth'
import { Spinner } from '@/components/ui/Spinner'
import { AppHeader } from '@/components/app/AppHeader'
import { BottomNav } from '@/components/app/BottomNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, setAuth, updateUser, signOut, isBooting, setBooting } = useAuthStore()

  useEffect(() => {
    // Try to restore session using httpOnly refresh cookie.
    // If getMe succeeds, access token has been refreshed by the client interceptor.
    // If it fails (no valid session), redirect to login.
    async function boot() {
      try {
        const me = await getMe()
        updateUser(me)
      } catch {
        signOut()
        router.replace('/login')
      } finally {
        setBooting(false)
      }
    }

    if (!user) {
      // No persisted user — check the server for an active session
      boot()
    } else {
      // User exists in store — do a background refresh but don't block render
      setBooting(false)
      getMe().then(updateUser).catch(() => {
        // Refresh failed silently; token interceptor will catch 401s
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Listen for token expiry from the API client
  useEffect(() => {
    function onExpired() {
      signOut()
      router.replace('/login')
    }
    window.addEventListener('cheese:auth:expired', onExpired)
    return () => window.removeEventListener('cheese:auth:expired', onExpired)
  }, [signOut, router])

  if (isBooting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user) return null // Redirecting

  return (
    <div className="flex flex-col min-h-screen items-center">
      <div className="w-full max-w-[430px] min-h-screen flex flex-col">
        <AppHeader />
        <main className="flex-1 overflow-y-auto pb-24">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
