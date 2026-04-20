'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  ArrowLeft, Bell, DollarSign, Shield, Info, RefreshCw, CheckCheck,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { getNotifications, markNotificationsRead } from '@/lib/api/wallet'
import { QUERY_KEYS, STALE_TIMES } from '@/constants'
import type { Notification } from '@/lib/api/wallet'

// ── Skeleton ───────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-white/8 rounded-xl animate-pulse', className)} />
}

// ── Notification icon ──────────────────────────────────────
const TYPE_CFG = {
  money:    { icon: DollarSign, bg: 'bg-emerald-400/10', color: 'text-emerald-400' },
  security: { icon: Shield,     bg: 'bg-red-400/10',     color: 'text-red-400' },
  system:   { icon: Info,       bg: 'bg-sky-400/10',     color: 'text-sky-400' },
}

function NotifRow({ n }: { n: Notification }) {
  const cfg  = TYPE_CFG[n.type] ?? TYPE_CFG.system
  const Icon = cfg.icon

  return (
    <div className={cn(
      'flex items-start gap-3 px-4 py-4 rounded-2xl transition-colors',
      n.read ? 'opacity-60' : 'bg-white/4',
    )}>
      <div className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5', cfg.bg, cfg.color)}>
        <Icon size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-white font-medium leading-snug">{n.title}</p>
          {!n.read && (
            <span className="w-2 h-2 rounded-full bg-[#d4a843] shrink-0 mt-1.5" />
          )}
        </div>
        <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{n.body}</p>
        <p className="text-[10px] text-white/25 mt-1.5">
          {new Date(n.createdAt).toLocaleDateString('en-NG', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  )
}

function groupByDate(notifs: Notification[]): { date: string; items: Notification[] }[] {
  const groups: { date: string; items: Notification[] }[] = []
  for (const n of notifs) {
    const today     = new Date()
    const notifDate = new Date(n.createdAt)
    const diffDays  = Math.floor((today.getTime() - notifDate.getTime()) / 86_400_000)

    const label =
      diffDays === 0 ? 'Today' :
      diffDays === 1 ? 'Yesterday' :
      notifDate.toLocaleDateString('en-NG', { month: 'long', day: 'numeric', year: 'numeric' })

    const last = groups[groups.length - 1]
    if (last?.date === label) last.items.push(n)
    else groups.push({ date: label, items: [n] })
  }
  return groups
}

// ── Page ───────────────────────────────────────────────────
export default function NotificationsPage() {
  const qc = useQueryClient()

  const notifsQ = useQuery({
    queryKey: QUERY_KEYS.NOTIFICATIONS,
    queryFn:  getNotifications,
    staleTime: STALE_TIMES.NOTIFICATIONS,
    retry: 1,
  })

  const markReadMut = useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.NOTIFICATIONS })
    },
  })

  const notifs  = notifsQ.data ?? []
  const unread  = notifs.filter(n => !n.read).length
  const grouped = groupByDate(notifs)

  return (
    <div className="flex flex-col pb-8">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/12 transition-all"
          >
            <ArrowLeft size={16} />
          </Link>
          <h1 className="text-base font-semibold text-white">Notifications</h1>
          {unread > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-[#d4a843] text-black text-[10px] font-bold">
              {unread}
            </span>
          )}
        </div>

        {unread > 0 && (
          <button
            type="button"
            onClick={() => markReadMut.mutate()}
            disabled={markReadMut.isPending}
            className="flex items-center gap-1.5 text-xs text-[#d4a843]/70 hover:text-[#d4a843] transition-colors disabled:opacity-40"
          >
            <CheckCheck size={13} />
            Mark all read
          </button>
        )}
      </div>

      {/* Loading */}
      {notifsQ.isLoading && (
        <div className="flex flex-col gap-1 px-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-start gap-3 px-4 py-4">
              <Skeleton className="w-9 h-9 rounded-full shrink-0" />
              <div className="flex-1 flex flex-col gap-2">
                <Skeleton className="h-3.5 w-40 rounded" />
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-2.5 w-24 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {notifsQ.isError && (
        <div className="flex flex-col items-center gap-3 py-16 text-center px-6">
          <p className="text-sm text-white/30">Could not load notifications</p>
          <button
            type="button"
            onClick={() => notifsQ.refetch()}
            className="text-xs text-[#d4a843]/70 hover:text-[#d4a843] flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw size={12} />
            Try again
          </button>
        </div>
      )}

      {/* Empty */}
      {notifsQ.isSuccess && notifs.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center px-6">
          <div className="w-14 h-14 rounded-full bg-white/6 flex items-center justify-center">
            <Bell size={22} className="text-white/25" />
          </div>
          <div>
            <p className="text-sm text-white/40 font-medium">No notifications yet</p>
            <p className="text-xs text-white/25 mt-1">You're all caught up</p>
          </div>
        </div>
      )}

      {/* List */}
      {notifsQ.isSuccess && notifs.length > 0 && (
        <div className="flex flex-col px-2">
          {grouped.map(({ date, items }) => (
            <div key={date}>
              <p className="text-xs text-white/30 font-medium px-4 pt-4 pb-1.5">{date}</p>
              {items.map(n => <NotifRow key={n.id} n={n} />)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
