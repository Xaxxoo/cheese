'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { adminLogin, adminMe, adminLogout, adminChangePassword } from '@/lib/api/admin'
import type { AdminRole as AdminRoleType } from '@/lib/api/admin'
import { adminTokenStore } from '@/lib/api/adminClient'

// ─── Role types ───────────────────────────────────────────────────────────────

export type AdminRole = AdminRoleType

export interface AdminUser {
  id:                 string
  email:              string
  name:               string
  adminRole:          AdminRole
  mustChangePassword: boolean | undefined
}

// Nav hrefs each role is permitted to access
export const ROLE_NAV_PERMISSIONS: Record<AdminRole, string[] | '*'> = {
  super_admin: '*',
  operator:    ['/admin', '/admin/users', '/admin/kyc', '/admin/transactions', '/admin/transfers', '/admin/fraud'],
  treasurer:   ['/admin', '/admin/transactions', '/admin/transfers', '/admin/wallets', '/admin/blockchain'],
  support:     ['/admin', '/admin/users', '/admin/kyc', '/admin/transactions'],
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  operator:    'Operator',
  treasurer:   'Treasurer',
  support:     'Support',
}

export const ROLE_COLORS: Record<AdminRole, { bg: string; text: string; border: string }> = {
  super_admin: { bg: 'rgba(245,158,11,0.12)',  text: '#f59e0b', border: 'rgba(245,158,11,0.25)'  },
  operator:    { bg: 'rgba(96,165,250,0.12)',   text: '#60a5fa', border: 'rgba(96,165,250,0.25)'  },
  treasurer:   { bg: 'rgba(34,197,94,0.12)',    text: '#22c55e', border: 'rgba(34,197,94,0.25)'   },
  support:     { bg: 'rgba(167,139,250,0.12)',  text: '#a78bfa', border: 'rgba(167,139,250,0.25)' },
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface AdminAuthStore {
  admin:           AdminUser | null
  isAuthenticated: boolean

  login:          (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout:         () => Promise<void>
  restoreSession: () => Promise<void>
  canAccess:      (href: string) => boolean
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>
}

export const useAdminAuthStore = create<AdminAuthStore>()(
  persist(
    (set, get) => ({
      admin:           null,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        try {
          const { admin } = await adminLogin(email, password)
          set({ admin, isAuthenticated: true })
          return { ok: true }
        } catch (err) {
          return { ok: false, error: (err as Error).message ?? 'Login failed.' }
        }
      },

      logout: async () => {
        try { await adminLogout() } catch { /* ignore — clear state regardless */ }
        set({ admin: null, isAuthenticated: false })
      },

      // Called on layout mount to verify the stored session is still valid.
      // Only clears the session when the token was genuinely revoked (the
      // refresh interceptor sets the token to null on auth failure).
      // Network errors and 5xx responses do NOT log the user out — the
      // admin:auth:expired event handles genuine token expiry separately.
      restoreSession: async () => {
        try {
          const admin = await adminMe()
          set({ admin, isAuthenticated: true })
        } catch {
          if (!adminTokenStore.get()) {
            // Token was cleared by the interceptor — genuine auth failure.
            set({ admin: null, isAuthenticated: false })
          }
          // else: network/server error — keep existing session state.
        }
      },

      changePassword: async (currentPassword: string, newPassword: string) => {
        try {
          await adminChangePassword(currentPassword, newPassword)
          set(state => ({ admin: state.admin ? { ...state.admin, mustChangePassword: false } : null }))
          return { ok: true }
        } catch (err) {
          return { ok: false, error: (err as Error).message ?? 'Failed to change password.' }
        }
      },

      canAccess: (href: string) => {
        const { admin } = get()
        if (!admin) return false
        const perms = ROLE_NAV_PERMISSIONS[admin.adminRole]
        if (perms === '*') return true
        return perms.includes(href)
      },
    }),
    {
      name:    'admin-auth',
      storage: createJSONStorage(() => sessionStorage), // cleared on tab close
    },
  ),
)
