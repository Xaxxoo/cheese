'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { getMe } from '@/lib/api/auth'
import { Spinner } from '@/components/ui/Spinner'
import { AppHeader } from '@/components/app/AppHeader'
import { BottomNav } from '@/components/app/BottomNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, setAuth, updateUser, signOut, isBooting, setBooting } = useAuthStore()
  // During the background boot refresh, suppress auth-expired events so a
  // stale cookie doesn't immediately log the user out — they'll be prompted
  // the next time they hit a protected endpoint instead.
  const suppressExpiredRef = useRef(false)

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
      // User exists in store — render immediately, refresh profile in the
      // background.  Suppress auth-expired during this window so a cold-start
      // cookie hiccup doesn't force an immediate logout.
      setBooting(false)
      suppressExpiredRef.current = true
      getMe()
        .then(updateUser)
        .catch(() => { /* session gone — next user action will trigger logout */ })
        .finally(() => { suppressExpiredRef.current = false })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Listen for token expiry from the API client
  useEffect(() => {
    function onExpired() {
      if (suppressExpiredRef.current) return
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

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  )

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
