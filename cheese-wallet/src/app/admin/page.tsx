'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import {
  c,
  IcoChevDown, IcoArrowUp, IcoArrowDn,
  IcoUsers, IcoShield, IcoWallet, IcoFile, IcoBank, IcoAlert,
  Dot, FeedLabel, greeting,
} from './_shared';
import { getAdminStats, type AdminStats } from '@/lib/api/admin';

// ─── SVG Components ───────────────────────────────────────────────────────────
function AreaChart({ data, range }: { data: number[]; range: '7D' | '30D' }) {
  const W = 600, H = 100;
  const p = { t: 6, r: 2, b: 2, l: 2 };
  const iW = W - p.l - p.r, iH = H - p.t - p.b;
  const min = Math.min(...data), max = Math.max(...data);
  const pts = data.map((v, i) => ({
    x: p.l + (i / (data.length - 1)) * iW,
    y: p.t + iH - ((v - min) / (max - min || 1)) * iH,
  }));
  let line = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1], cur = pts[i];
    const cx = (prev.x + cur.x) / 2;
    line += ` C${cx},${prev.y} ${cx},${cur.y} ${cur.x},${cur.y}`;
  }
  const area = `${line} L${p.l + iW},${p.t + iH} L${p.l},${p.t + iH} Z`;
  const labels = range === '7D'
    ? pts.map((pt, i) => ({ x: pt.x, label: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i] }))
    : [0, 7, 14, 21, 29].map((i) => ({ x: pts[i].x, label: `W${Math.floor(i / 7) + 1}` }));
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 16}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={c.amber} stopOpacity="0.2" />
          <stop offset="100%" stopColor={c.amber} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#ag)" />
      <path d={line} fill="none" stroke={c.amber} strokeWidth="1.6" />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3" fill={c.amber} />
      {labels.map((l) => (
        <text key={l.label} x={l.x} y={H + 14} fill="rgba(244,244,245,0.22)"
          fontSize="7" textAnchor="middle" fontFamily="system-ui">{l.label}</text>
      ))}
    </svg>
  );
}

function Spark({ data, color }: { data: number[]; color: string }) {
  const W = 60, H = 22;
  const min = Math.min(...data), max = Math.max(...data);
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - ((v - min) / (max - min || 1)) * H * 0.82 - H * 0.06,
  }));
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1], cur = pts[i];
    const cx = (prev.x + cur.x) / 2;
    d += ` C${cx},${prev.y} ${cx},${cur.y} ${cur.x},${cur.y}`;
  }
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

function BarMini({ data, color }: { data: number[]; color: string }) {
  const W = 56, H = 20, n = data.length;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const barW = 5, gap = (W - barW * n) / (n - 1);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {data.map((v, i) => {
        const h = Math.max(2, ((v - min) / range) * H * 0.85 + H * 0.1);
        return (
          <rect key={i} x={i * (barW + gap)} y={H - h} width={barW} height={h} rx={1.5}
            fill={color} opacity={i === n - 1 ? 0.85 : 0.22} />
        );
      })}
    </svg>
  );
}

// ─── Overview page ─────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [chartRange, setChartRange] = useState<'7D' | '30D'>('30D');
  const [alertOpen, setAlertOpen]   = useState(true);
  const [stats, setStats]           = useState<AdminStats | null>(null);

  useEffect(() => {
    getAdminStats().then(setStats).catch(console.error);
    const id = setInterval(() => getAdminStats().then(setStats).catch(console.error), 60_000);
    return () => clearInterval(id);
  }, []);

  const n = (v: number | undefined) => (v ?? 0).toLocaleString();

  const kpi = [
    {
      label: 'Total Users',   value: stats ? n(stats.totalUsers)        : '—',
      change: stats ? `${n(stats.verifiedUsers)} verified`              : '—',
      up: true,  sub: 'registered',  color: c.amber, cls: 'kpi-amber',
      spark: Array(12).fill(stats?.totalUsers ?? 1),
    },
    {
      label: 'USDC Volume',   value: stats ? `$${n(Math.floor(stats.totalVolumeUsdc))}` : '—',
      change: stats ? `${n(stats.totalTransactions)} transactions`      : '—',
      up: true,  sub: 'all time',    color: c.green, cls: 'kpi-green',
      spark: Array(12).fill(stats?.totalVolumeUsdc ?? 1),
    },
    {
      label: 'Transactions',  value: stats ? n(stats.totalTransactions) : '—',
      change: stats ? `${n(stats.activeWallets)} active wallets`        : '—',
      up: true,  sub: 'all time',    color: c.blue,  cls: 'kpi-blue',
      spark: Array(12).fill(stats?.totalTransactions ?? 1),
    },
    {
      label: 'Flagged Items', value: stats ? n((stats.flaggedUsers) + (stats.pendingKyc)) : '—',
      change: stats ? `${n(stats.flaggedUsers)} fraud · ${n(stats.pendingKyc)} KYC`       : '—',
      up: false, sub: 'need review',  color: c.red,   cls: 'kpi-red',
      spark: Array(12).fill(stats?.flaggedUsers ?? 1),
    },
  ];

  const modules = [
    { icon: IcoUsers,  label: 'Users',           value: stats ? n(stats.totalUsers)               : '—', note: 'Registered',       alert: false,                                    color: c.blue,  trend: Array(7).fill(stats?.totalUsers               ?? 0) },
    { icon: IcoShield, label: 'KYC & Tiers',     value: stats ? n(stats.pendingKyc)               : '—', note: 'Pending review',   alert: (stats?.pendingKyc               ?? 0) > 0, color: c.red,   trend: Array(7).fill(stats?.pendingKyc               ?? 0) },
    { icon: IcoFile,   label: 'Transactions',    value: stats ? n(stats.totalTransactions)         : '—', note: 'All time',         alert: false,                                    color: c.green, trend: Array(7).fill(stats?.totalTransactions         ?? 0) },
    { icon: IcoBank,   label: 'Bank Transfers',  value: stats ? n(stats.failedBankTransfersToday) : '—', note: 'Failed today',     alert: (stats?.failedBankTransfersToday ?? 0) > 0, color: c.red,   trend: Array(7).fill(stats?.failedBankTransfersToday ?? 0) },
    { icon: IcoWallet, label: 'Stellar Wallets', value: stats ? n(stats.activeWallets)            : '—', note: 'Active',           alert: false,                                    color: c.amber, trend: Array(7).fill(stats?.activeWallets            ?? 0) },
    { icon: IcoAlert,  label: 'Fraud',           value: stats ? n(stats.flaggedUsers)             : '—', note: 'Flagged accounts', alert: (stats?.flaggedUsers             ?? 0) > 0, color: c.red,   trend: Array(7).fill(stats?.flaggedUsers             ?? 0) },
  ];

  const alertItems = stats ? [
    stats.pendingKyc > 0              && { msg: `${n(stats.pendingKyc)} KYC submission${stats.pendingKyc > 1 ? 's' : ''} awaiting approval`,          color: c.red   },
    stats.flaggedUsers > 0            && { msg: `${n(stats.flaggedUsers)} account${stats.flaggedUsers > 1 ? 's' : ''} flagged for review`,             color: c.red   },
    stats.failedBankTransfersToday > 0 && { msg: `${n(stats.failedBankTransfersToday)} bank transfer${stats.failedBankTransfersToday > 1 ? 's' : ''} failed today`, color: c.amber },
  ].filter(Boolean) as { msg: string; color: string }[] : [];

  const chartData = Array(chartRange === '7D' ? 7 : 30).fill(Math.max(1, stats?.totalTransactions ?? 0));
  const chartMeta = {
    total: stats ? `$${n(Math.floor(stats.totalVolumeUsdc))}` : '—',
    trend: 'All time',
    sub:   chartRange === '7D' ? 'Last 7 days' : '30-day view',
    stats: [
      { label: 'Total users',    value: stats ? n(stats.totalUsers)        : '—' },
      { label: 'Active wallets', value: stats ? n(stats.activeWallets)     : '—' },
      { label: 'Transactions',   value: stats ? n(stats.totalTransactions) : '—' },
    ],
  };

  const card: CSSProperties = {
    background: c.surface, border: `1px solid ${c.border}`, borderRadius: 14,
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 style={{ fontSize: 21, fontWeight: 700, color: c.text, margin: 0, letterSpacing: '-0.02em' }}>
          {greeting()}, Admin
        </h1>
        <p style={{ fontSize: 12.5, color: c.textDim, margin: '5px 0 0' }}>
          {new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* ── Alert banner ────────────────────────────────────────────────── */}
      {alertItems.length > 0 && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '11px 18px',
            borderBottom: alertOpen ? `1px solid ${c.border}` : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="pulse-red" style={{ width: 6, height: 6, borderRadius: '50%', background: c.red, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: c.text }}>Action Required</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: c.red, background: c.redDim, border: `1px solid rgba(239,68,68,0.2)`, padding: '1px 6px', borderRadius: 99 }}>{alertItems.length}</span>
            </div>
            <button className="alert-toggle" onClick={() => setAlertOpen((v) => !v)} style={{ color: c.textDim }}>
              <span style={{ transform: alertOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-flex' }}>
                <IcoChevDown />
              </span>
            </button>
          </div>
          {alertOpen && alertItems.map((a, i, arr) => (
            <div key={i} className="row-hover"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 18px', gap: 12, cursor: 'pointer',
                borderBottom: i < arr.length - 1 ? `1px solid ${c.border}` : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 2.5, height: 14, borderRadius: 99, background: a.color, flexShrink: 0, display: 'inline-block' }} />
                <span style={{ fontSize: 12.5, color: c.text }}>{a.msg}</span>
              </div>
              <span style={{ fontSize: 11, color: c.textDim, flexShrink: 0 }}>Review →</span>
            </div>
          ))}
        </div>
      )}

      {/* ── KPI cards ───────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {kpi.map((k) => (
          <div key={k.label} className={`kpi-card ${k.cls}`} style={{ ...card, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 11, color: c.textMid, fontWeight: 500 }}>{k.label}</span>
              <Spark data={k.spark} color={k.color} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.text, letterSpacing: '-0.04em', lineHeight: 1 }}>{k.value}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 10 }}>
              <span style={{ color: k.up ? c.green : c.red, display: 'flex', alignItems: 'center' }}>
                {k.up ? <IcoArrowUp /> : <IcoArrowDn />}
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: k.up ? c.green : c.red }}>{k.change}</span>
              <span style={{ fontSize: 11, color: c.textDim }}>{k.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Chart + Feed ────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 12 }}>

        {/* Area chart */}
        <div style={{ ...card, padding: '22px 24px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: c.text }}>USDC Volume</div>
                <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 7, padding: 2 }}>
                  {(['7D', '30D'] as const).map((r) => (
                    <button key={r} className="range-btn" onClick={() => setChartRange(r)}
                      style={{ background: chartRange === r ? 'rgba(255,255,255,0.1)' : 'transparent', color: chartRange === r ? c.text : c.textDim }}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: c.textDim }}>{chartMeta.sub}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 23, fontWeight: 800, color: c.amber, letterSpacing: '-0.04em' }}>{chartMeta.total}</div>
              <div style={{ fontSize: 11, color: c.green, fontWeight: 600, marginTop: 2 }}>{chartMeta.trend}</div>
            </div>
          </div>
          <AreaChart data={chartData} range={chartRange} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTop: `1px solid ${c.border}` }}>
            {chartMeta.stats.map((stat) => (
              <div key={stat.label}>
                <div style={{ fontSize: 10, color: c.textDim, fontWeight: 500, marginBottom: 3 }}>{stat.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>{stat.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Live feed */}
        <div style={{ ...card, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: c.text }}>System Status</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {alertItems.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: c.green, fontWeight: 600, marginBottom: 4 }}>All clear</div>
                <div style={{ fontSize: 11, color: c.textDim }}>No items need attention</div>
              </div>
            ) : alertItems.map((f, i) => (
              <div key={i} className="row-hover"
                style={{
                  padding: '11px 14px',
                  borderBottom: i < alertItems.length - 1 ? `1px solid ${c.border}` : 'none',
                  display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'default',
                }}
              >
                <div style={{ paddingTop: 3 }}><Dot color={f.color} /></div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <FeedLabel label={f.color === c.red ? 'Critical' : 'Warning'} />
                  </div>
                  <div style={{ fontSize: 12, color: c.text, lineHeight: 1.4 }}>{f.msg}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Feature modules ─────────────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: c.text }}>Modules</span>
          {modules.filter((m) => m.alert).length > 0 && (
            <span style={{ fontSize: 11, color: c.textDim }}>{modules.filter((m) => m.alert).length} need attention</span>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {modules.map((m) => (
            <div key={m.label}
              className={m.alert ? 'mod-card mod-alert' : 'mod-card'}
              style={{
                ...card, padding: '16px 18px 14px', cursor: 'pointer', position: 'relative',
                background: m.alert ? 'rgba(239,68,68,0.04)' : c.surface,
                borderColor: m.alert ? 'rgba(239,68,68,0.12)' : c.border,
              }}
            >
              {m.alert && (
                <span className="pulse-red" style={{ position: 'absolute', top: 14, right: 14, width: 6, height: 6, borderRadius: '50%', background: c.red, display: 'inline-block' }} />
              )}
              <span className="mod-go" style={{ position: 'absolute', bottom: 13, right: 15, fontSize: 10.5, color: c.textDim }}>Open →</span>
              <div style={{ color: m.color, marginBottom: 8 }}><m.icon /></div>
              <div style={{ fontSize: 20, fontWeight: 800, color: m.alert ? c.red : c.text, letterSpacing: '-0.04em', lineHeight: 1 }}>
                {m.value}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: c.text, marginTop: 3 }}>{m.label}</div>
              <div style={{ fontSize: 10.5, color: c.textDim, marginTop: 1, marginBottom: 8 }}>{m.note}</div>
              <BarMini data={m.trend} color={m.alert ? c.red : m.color} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ height: 4 }} />
    </div>
  );
}
