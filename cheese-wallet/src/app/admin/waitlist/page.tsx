'use client'

import { useEffect, useState, useCallback } from 'react'
import { listAdminWaitlist, AdminWaitlistItem } from '@/lib/api/admin'

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { key: 'all',       label: 'All' },
  { key: 'pending',   label: 'Pending' },
  { key: 'notified',  label: 'Notified' },
  { key: 'converted', label: 'Converted' },
]

function statusPill(status: string) {
  const s = status.toLowerCase()
  const base = 'inline-block px-2 py-0.5 rounded text-xs font-semibold capitalize'
  if (s === 'converted') return `${base} bg-emerald-100 text-emerald-700`
  if (s === 'notified')  return `${base} bg-blue-100 text-blue-700`
  return `${base} bg-amber-100 text-amber-700`
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function WaitlistPage() {
  const [entries, setEntries] = useState<AdminWaitlistItem[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [status,  setStatus]  = useState('all')
  const [search,  setSearch]  = useState('')
  const [query,   setQuery]   = useState('')
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  // derived stats
  const [counts, setCounts] = useState({ pending: 0, notified: 0, converted: 0 })

  const LIMIT = 20

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listAdminWaitlist({
        page,
        limit: LIMIT,
        status: status === 'all' ? undefined : status,
        search: query || undefined,
      })
      setEntries(res.entries)
      setTotal(res.total)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(`Failed to load waitlist — ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [page, status, query])

  // Load summary counts (no filter) once on mount
  useEffect(() => {
    async function loadCounts() {
      try {
        const [all, notified, converted] = await Promise.all([
          listAdminWaitlist({ page: 1, limit: 1, status: 'pending' }),
          listAdminWaitlist({ page: 1, limit: 1, status: 'notified' }),
          listAdminWaitlist({ page: 1, limit: 1, status: 'converted' }),
        ])
        setCounts({ pending: all.total, notified: notified.total, converted: converted.total })
      } catch { /* best-effort */ }
    }
    void loadCounts()
  }, [])

  useEffect(() => { void load() }, [load])

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setQuery(search)
  }

  function changeStatus(s: string) {
    setStatus(s)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Waitlist</h1>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total" value={counts.pending + counts.notified + counts.converted} />
        <StatCard label="Pending"   value={counts.pending}   colour="amber" />
        <StatCard label="Notified"  value={counts.notified}  colour="blue" />
        <StatCard label="Converted" value={counts.converted} colour="emerald" />
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* search */}
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search username, email or referral code…"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-yellow-400 text-black text-sm font-semibold rounded-lg hover:bg-yellow-300 transition-colors"
          >
            Search
          </button>
        </form>

        {/* status tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 h-fit">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => changeStatus(f.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                status === f.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Error state ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <span className="text-red-700 text-sm">{error}</span>
          <button
            onClick={load}
            className="ml-4 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-gray-500 font-medium">#</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Username</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Email</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">Points</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Referral Code</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Joined</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Converted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    No waitlist entries found
                  </td>
                </tr>
              ) : (
                entries.map((w) => (
                  <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-400 tabular-nums">
                      {w.position ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      @{w.username}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{w.email}</td>
                    <td className="px-4 py-3">
                      <span className={statusPill(w.status)}>{w.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {w.points.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {w.referralCode ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {fmt(w.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {fmt(w.convertedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {!loading && !error && total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total.toLocaleString()}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-white transition-colors"
              >
                Prev
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-600">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-white transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  colour,
}: {
  label:   string
  value:   number
  colour?: 'amber' | 'blue' | 'emerald'
}) {
  const dot: Record<string, string> = {
    amber:   'bg-amber-400',
    blue:    'bg-blue-400',
    emerald: 'bg-emerald-400',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {colour && <span className={`w-2 h-2 rounded-full ${dot[colour]}`} />}
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 tabular-nums">{value.toLocaleString()}</p>
    </div>
  )
}
