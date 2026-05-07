'use client';

import { useState, type CSSProperties } from 'react';
import {
  c,
  IcoChevDown, IcoArrowUp, IcoArrowDn,
  IcoUsers, IcoShield, IcoWallet, IcoFile, IcoBank, IcoAlert,
  Dot, FeedLabel, greeting,
} from './_shared';

// ─── Data ─────────────────────────────────────────────────────────────────────
const VOLUME_30D = [
  42, 38, 51, 67, 58, 72, 45, 39, 63, 79,
  84, 71, 55, 48, 92, 108, 95, 83, 76, 61,
  53, 87, 103, 118, 99, 112, 95, 78, 134, 142,
].map((v) => v * 1000);

const KPI = [
  {
    label: 'Total Users',   value: '12,481', change: '+8.2%',    up: true,
    sub: 'vs last month',  color: c.amber,  cls: 'kpi-amber',
    spark: [80, 85, 88, 92, 95, 98, 102, 105, 108, 112, 118, 124],
  },
  {
    label: 'USDC Volume',   value: '$847K',  change: '+14.1%',   up: true,
    sub: 'vs last month',  color: c.green,  cls: 'kpi-green',
    spark: [60, 65, 70, 62, 75, 80, 85, 78, 90, 95, 105, 110],
  },
  {
    label: 'Transactions',  value: '38,912', change: '+5.3%',    up: true,
    sub: 'vs last month',  color: c.blue,   cls: 'kpi-blue',
    spark: [200, 220, 210, 240, 250, 230, 270, 260, 290, 300, 320, 341],
  },
  {
    label: 'Flagged Items', value: '34',     change: '-2 today', up: false,
    sub: '14 fraud · 12 KYC',  color: c.red, cls: 'kpi-red',
    spark: [10, 15, 18, 22, 20, 28, 25, 30, 32, 30, 35, 34],
  },
];

const FEED = [
  { dot: c.red,   label: 'Critical', msg: 'Black tier doc submitted — needs admin sign-off', sub: '@adaeze · 2 min ago'         },
  { dot: c.red,   label: 'Critical', msg: 'Bank transfer failed — NGN reserve insufficient',  sub: '@emeka_fx · 4 min ago'      },
  { dot: c.amber, label: 'Warning',  msg: 'EVM wallet stuck — retry attempt 3/5',             sub: 'userId: a3f12b · 12 min ago' },
  { dot: c.green, label: 'Info',     msg: 'New user onboarded, Stellar wallet provisioned',   sub: '@chiamaka22 · 18 min ago'    },
  { dot: c.amber, label: 'Warning',  msg: 'PulseMFB webhook returning 503',                   sub: 'System · 24 min ago'         },
];

const MODULES = [
  { icon: IcoUsers,  label: 'Users',           value: '12,481', note: 'Registered',       alert: false, color: c.blue,  trend: [85,  90,  95, 100, 104, 110, 112] },
  { icon: IcoShield, label: 'KYC & Tiers',     value: '12',     note: 'Pending review',   alert: true,  color: c.red,   trend: [4,   7,   6,  10,  14,  11,  12 ] },
  { icon: IcoFile,   label: 'Transactions',    value: '38,912', note: 'All time',         alert: false, color: c.green, trend: [280, 295, 310, 290, 315, 330, 341] },
  { icon: IcoBank,   label: 'Bank Transfers',  value: '3',      note: 'Failed today',     alert: true,  color: c.red,   trend: [0,   1,   0,   2,   1,   0,   3 ] },
  { icon: IcoWallet, label: 'Stellar Wallets', value: '11,204', note: 'Active',           alert: false, color: c.amber, trend: [88,  91,  93,  96,  99, 102, 104] },
  { icon: IcoAlert,  label: 'Fraud',           value: '14',     note: 'Flagged accounts', alert: true,  color: c.red,   trend: [8,   10,  12,  11,  13,  12,  14 ] },
];

const CHART_META = {
  '7D': {
    total: '$278K', trend: '↑ 11.2% vs prev week', sub: 'Last 7 days',
    stats: [
      { label: 'Peak day',  value: 'Wed · $59K'  },
      { label: 'Daily avg', value: '$39.7K'       },
      { label: 'This week', value: '~$278K total' },
    ],
  },
  '30D': {
    total: '$849K', trend: '↑ 18.4% vs last month', sub: '30-day transaction volume',
    stats: [
      { label: 'Peak day',     value: 'Day 30 · $142K' },
      { label: 'Daily avg',    value: '$28.3K'          },
      { label: 'Transactions', value: '38,912 total'    },
    ],
  },
} as const;

// ─── SVG Components ───────────────────────────────────────────────────────────
function AreaChart({ data, range }: { data: number[]; range: '7D' | '30D' }) {
  const W = 600, H = 100;
  const p = { t: 6, r: 2, b: 2, l: 2 };
  const iW = W - p.l - p.r, iH = H - p.t - p.b;
  const min = Math.min(...data), max = Math.max(...data);
  const pts = data.map((v, i) => ({
    x: p.l + (i / (data.length - 1)) * iW,
    y: p.t + iH - ((v - min) / (max - min)) * iH,
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

  const chartData = chartRange === '7D' ? VOLUME_30D.slice(-7) : VOLUME_30D;
  const chartMeta = CHART_META[chartRange];

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
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '11px 18px',
          borderBottom: alertOpen ? `1px solid ${c.border}` : 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="pulse-red" style={{ width: 6, height: 6, borderRadius: '50%', background: c.red, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: c.text }}>Action Required</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: c.red, background: c.redDim, border: `1px solid rgba(239,68,68,0.2)`, padding: '1px 6px', borderRadius: 99 }}>5</span>
          </div>
          <button className="alert-toggle" onClick={() => setAlertOpen((v) => !v)} style={{ color: c.textDim }}>
            <span style={{ transform: alertOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-flex' }}>
              <IcoChevDown />
            </span>
          </button>
        </div>
        {alertOpen && [
          { msg: '12 Black tier KYC docs awaiting approval',   color: c.red   },
          { msg: '14 accounts flagged for fraud review',        color: c.red   },
          { msg: '7 EVM wallets stuck in pending',             color: c.amber },
          { msg: '3 bank transfers failed — reversal needed',  color: c.amber },
          { msg: 'PulseMFB API returning degraded responses',  color: c.amber },
        ].map((a, i, arr) => (
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

      {/* ── KPI cards ───────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {KPI.map((k) => (
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
            <span style={{ fontSize: 13, fontWeight: 700, color: c.text }}>Live Activity</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9.5, fontWeight: 600, color: c.green, background: c.greenDim, border: `1px solid rgba(34,197,94,0.18)`, padding: '2px 8px', borderRadius: 99 }}>
              <span className="pulse-green" style={{ width: 4, height: 4, borderRadius: '50%', background: c.green, display: 'inline-block' }} />
              LIVE
            </span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {FEED.map((f, i) => (
              <div key={i} className="row-hover"
                style={{
                  padding: '11px 14px',
                  borderBottom: i < FEED.length - 1 ? `1px solid ${c.border}` : 'none',
                  display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'default',
                }}
              >
                <div style={{ paddingTop: 3 }}><Dot color={f.dot} /></div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <FeedLabel label={f.label} />
                  </div>
                  <div style={{ fontSize: 12, color: c.text, lineHeight: 1.4 }}>{f.msg}</div>
                  <div style={{ fontSize: 10, color: c.textDim, marginTop: 2 }}>{f.sub}</div>
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
          <span style={{ fontSize: 11, color: c.textDim }}>3 need attention</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {MODULES.map((m) => (
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
