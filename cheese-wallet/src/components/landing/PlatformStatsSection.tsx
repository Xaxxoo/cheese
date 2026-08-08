'use client'

import { useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/constants'
import { fetchPublicStats, fetchPublicChart } from '@/lib/api/stats'
import type { PublicStats, ChartPoint } from '@/lib/api/stats'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(2)}`
}

function shortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

const PLATFORM_WALLET = 'GBOGVS7QHKU2HJUWIEKFOXJD5ZHXHI5OZJWX2Y4YKOK7PZ6NLBL3RO2G'

// ── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, delay, inView }: { label: string; value: string; sub?: string; delay: number; inView: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay, duration: 0.6 }}
      className="rounded-xl p-5 border transition-colors hover:bg-[#0B0B0B]"
      style={{ background: '#050505', borderColor: 'rgba(255,255,255,0.06)' }}
    >
      <div className="text-[10px] uppercase tracking-[0.2em] text-[#555] font-medium mb-2">{label}</div>
      <div className="text-3xl md:text-4xl font-bold mb-1" style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-[#444]">{sub}</div>}
    </motion.div>
  )
}

function AreaChart({ data, days }: { data: ChartPoint[]; days: number }) {
  const W = 600, H = 100
  const p = { t: 6, r: 2, b: 2, l: 2 }
  const iW = W - p.l - p.r, iH = H - p.t - p.b

  const volumes = data.map((d) => d.volume)
  const hasData = volumes.some((v) => v > 0)
  const max = Math.max(...volumes, 1)

  const xForIndex = (i: number) => p.l + (i / (data.length - 1 || 1)) * iW

  const pts = volumes.map((v, i) => ({
    x: xForIndex(i),
    y: p.t + iH - (v / max) * iH,
  }))

  const labels = days === 7
    ? data.map((d, i) => ({ x: xForIndex(i), label: shortDate(d.date) }))
    : [0, 7, 14, 21, Math.min(29, data.length - 1)].filter(i => i < data.length).map((i) => ({
        x: xForIndex(i),
        label: shortDate(data[i].date),
      }))

  if (!hasData) {
    return (
      <svg width="100%" viewBox={`0 0 ${W} ${H + 16}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <text x={W / 2} y={H / 2 + 4} fill="rgba(255,255,255,0.18)" fontSize="10"
          textAnchor="middle" fontFamily="system-ui">No transaction volume in this period</text>
        {labels.map((l) => (
          <text key={l.label} x={l.x} y={H + 14} fill="rgba(255,255,255,0.22)"
            fontSize="7" textAnchor="middle" fontFamily="system-ui">{l.label}</text>
        ))}
      </svg>
    )
  }

  let line = `M${pts[0].x},${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1], cur = pts[i]
    const cx = (prev.x + cur.x) / 2
    line += ` C${cx},${prev.y} ${cx},${cur.y} ${cur.x},${cur.y}`
  }
  const area = `${line} L${p.l + iW},${p.t + iH} L${p.l},${p.t + iH} Z`

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 16}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="pub-area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#D4AF37" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#pub-area-grad)" />
      <path d={line} fill="none" stroke="#D4AF37" strokeWidth="1.6" />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3" fill="#D4AF37" />
      {labels.map((l) => (
        <text key={l.label} x={l.x} y={H + 14} fill="rgba(255,255,255,0.22)"
          fontSize="7" textAnchor="middle" fontFamily="system-ui">{l.label}</text>
      ))}
    </svg>
  )
}

function TierBadge({ tier, count, color }: { tier: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-4 py-3 border" style={{ background: '#050505', borderColor: 'rgba(255,255,255,0.06)' }}>
      <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      <span className="text-xs font-semibold text-[#888] uppercase tracking-wider">{tier}</span>
      <span className="ml-auto text-lg font-bold text-white">{fmt(count)}</span>
    </div>
  )
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl ${className}`} style={{ background: '#111' }} />
}

// ── Main Section ─────────────────────────────────────────────────────────────

export function PlatformStatsSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })
  const [chartDays, setChartDays] = useState<7 | 30>(30)

  const { data: stats, isLoading: statsLoading } = useQuery<PublicStats>({
    queryKey: QUERY_KEYS.PUBLIC_STATS,
    queryFn: fetchPublicStats,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const { data: chart, isLoading: chartLoading } = useQuery<ChartPoint[]>({
    queryKey: QUERY_KEYS.PUBLIC_CHART(chartDays),
    queryFn: () => fetchPublicChart(chartDays),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  return (
    <section ref={ref} id="stats" className="py-32 px-6" style={{ background: '#080808' }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-16"
        >
          <div className="text-xs font-medium tracking-[0.2em] uppercase mb-4" style={{ color: '#D4AF37' }}>
            Live Verifiable Data
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Platform Metrics
          </h2>
          <p className="text-[#B5B5B5] max-w-xl mx-auto text-sm">
            Real-time aggregated statistics. Auto-refreshes every 60 seconds.
          </p>
        </motion.div>

        {/* Contract Address */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.05, duration: 0.6 }}
          className="rounded-xl p-6 border mb-6"
          style={{ background: '#050505', borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <div className="text-white text-sm font-semibold mb-1">Contract Address</div>
          <div className="text-[10px] text-[#444] mb-4">Stellar network contract</div>

          <div className="flex items-center gap-3 rounded-lg px-4 py-4 border" style={{ background: '#080808', borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="w-2 h-2 rounded-full" style={{ background: '#D4AF37' }} />
            <code className="text-[10px] sm:text-xs text-[#888] font-mono break-all select-all flex-1">
              {PLATFORM_WALLET}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(PLATFORM_WALLET)}
              className="flex-shrink-0 text-[#444] hover:text-[#D4AF37] transition-colors"
              title="Copy address"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          </div>

          <a
            href={`https://stellar.expert/explorer/public/account/${PLATFORM_WALLET}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-3 text-[10px] transition-colors"
            style={{ color: 'rgba(212,175,55,0.6)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#D4AF37')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(212,175,55,0.6)')}
          >
            View on Stellar Expert
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </motion.div>

        {/* KPI Cards */}
        {statsLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
            <KpiCard label="Total Users" value={fmt(stats.totalUsers)} sub={`${fmt(stats.verifiedUsers)} verified`} delay={0} inView={inView} />
            <KpiCard label="Total Volume" value={fmtUsd(stats.totalVolumeUsdc)} sub="USDC settled" delay={0.1} inView={inView} />
            <KpiCard label="Transactions" value={fmt(stats.totalTransactions)} delay={0.2} inView={inView} />
            <KpiCard label="Stellar Wallets" value={fmt(stats.activeWallets)} sub="Active on network" delay={0.3} inView={inView} />
          </div>
        ) : null}

        {/* Volume Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="rounded-xl p-6 border mb-6"
          style={{ background: '#050505', borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-white text-sm font-semibold">Daily Volume</div>
              <div className="text-[10px] text-[#444] mt-0.5">Completed USDC transaction volume</div>
            </div>
            <div className="flex rounded-lg p-0.5 border" style={{ background: '#080808', borderColor: 'rgba(255,255,255,0.06)' }}>
              {([7, 30] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setChartDays(d)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md transition-all"
                  style={chartDays === d
                    ? { background: '#D4AF37', color: '#000' }
                    : { color: '#555' }}
                >
                  {d}D
                </button>
              ))}
            </div>
          </div>

          {chartLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : chart && chart.length > 0 ? (
            <AreaChart data={chart} days={chartDays} />
          ) : (
            <div className="h-40 flex items-center justify-center text-[#333] text-sm">No chart data</div>
          )}
        </motion.div>

        {/* Tier Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="rounded-xl p-6 border"
          style={{ background: '#050505', borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <div className="text-white text-sm font-semibold mb-4">Tier Distribution</div>
          {statsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : stats ? (
            <div className="grid md:grid-cols-3 gap-3">
              <TierBadge tier="Silver" count={stats.tierDistribution.silver} color="#C0C0C0" />
              <TierBadge tier="Gold" count={stats.tierDistribution.gold} color="#D4AF37" />
              <TierBadge tier="Black" count={stats.tierDistribution.black} color="#F5EED8" />
            </div>
          ) : null}
        </motion.div>
      </div>
    </section>
  )
}
