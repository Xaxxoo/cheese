'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { User } from '@/types'
import { tokenStore } from '@/lib/api/client'

function clearUserQueries() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('cheese:query:clear'))
}

interface AuthStore {
  user: User | null
  deviceId: string
  isBooting: boolean

  setAuth: (user: User, accessToken: string) => void
  updateUser: (partial: Partial<User>) => void
  signOut: () => void
  setBooting: (v: boolean) => void
  ensureDeviceId: () => string
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      deviceId: '',
      isBooting: true,

      setAuth: (user, accessToken) => {
        tokenStore.set(accessToken)
        clearUserQueries()
        set({ user })
      },

      updateUser: (partial) => {
        const { user } = get()
        if (user) {
          set({ user: { ...user, ...partial } })
        } else {
          // Called during boot() when restoring a session from scratch
          set({ user: partial as User })
        }
      },

      signOut: () => {
        tokenStore.clear()
        clearUserQueries()
        set({ user: null })
      },

      setBooting: (v) => set({ isBooting: v }),

      ensureDeviceId: () => {
        const { deviceId } = get()
        if (deviceId) return deviceId
        const id = crypto.randomUUID()
        set({ deviceId: id })
        return id
      },
    }),
    {
      name: 'cheese-auth',
      storage: createJSONStorage(() => {
        // Guard for SSR — localStorage is undefined on the server
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          }
        }
        return localStorage
      }),
      // Only persist user profile and deviceId — never the access token
      partialize: (state) => ({
        user: state.user,
        deviceId: state.deviceId,
      }),
      // After localStorage is read, mark boot as complete so auth layouts
      // can render their children instead of showing the spinner forever.
      onRehydrateStorage: () => (state) => {
        state?.setBooting(false)
      },
    },
  ),
)
