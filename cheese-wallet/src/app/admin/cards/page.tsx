'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import { c, IcoSearch, IcoCard, Pill } from '../_shared';
import { listAdminCards, type AdminCardItem } from '@/lib/api/admin';

// ── Helpers ────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'active' | 'frozen' | 'terminated';

const LIMIT = 20;

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

const fmtUsdc = (v: string) =>
  parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function statusStyle(s: string) {
  if (s === 'active')     return { color: c.green,   bg: c.greenDim,  brd: 'rgba(34,197,94,0.2)'  };
  if (s === 'frozen')     return { color: c.blue,    bg: c.blueDim,   brd: 'rgba(96,165,250,0.2)' };
  if (s === 'terminated') return { color: c.red,     bg: c.redDim,    brd: 'rgba(239,68,68,0.2)'  };
  return                         { color: c.textMid, bg: 'rgba(255,255,255,0.05)', brd: 'transparent' };
}

const STATUSES: { key: StatusFilter; label: string }[] = [
  { key: 'all',        label: 'All'        },
  { key: 'active',     label: 'Active'     },
  { key: 'frozen',     label: 'Frozen'     },
  { key: 'terminated', label: 'Terminated' },
];

const COLS     = ['User', 'Card', 'Network', 'Status', 'Balance', 'Spend Limit', 'Monthly Spend', 'Issued'];
const COL_GRID = '1.4fr 130px 90px 100px 110px 110px 120px 110px';

interface StatCounts { total: number; active: number; frozen: number; terminated: number }

// ── Card visual component ──────────────────────────────────────────────────────

function CardVisual({ vc }: { vc: AdminCardItem }) {
  const isFrozen     = vc.status === 'frozen';
  const isTerminated = vc.status === 'terminated';

  return (
    <div style={{
      width: 340, height: 200, borderRadius: 18, flexShrink: 0,
      background: 'linear-gradient(135deg, #0c0c0c 0%, #1e1e1e 45%, #080808 100%)',
      border: '1px solid rgba(255,255,255,0.1)',
      padding: '20px 22px',
      position: 'relative', overflow: 'hidden',
      boxShadow: '0 24px 64px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)',
      userSelect: 'none',
      opacity: isTerminated ? 0.5 : 1,
    }}>

      {/* Ambient glow — top-right gold */}
      <div style={{
        position: 'absolute', top: -70, right: -50, width: 200, height: 200, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(212,168,67,0.09) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />
      {/* Ambient glow — bottom-left blue */}
      <div style={{
        position: 'absolute', bottom: -60, left: -40, width: 160, height: 160, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(96,165,250,0.06) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      {/* Frozen overlay */}
      {isFrozen && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 18, zIndex: 2,
          background: 'rgba(96,165,250,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontSize: 10, color: c.blue, letterSpacing: '0.2em', fontWeight: 700,
            border: `1px solid ${c.blue}`, padding: '3px 10px', borderRadius: 4,
            opacity: 0.85,
          }}>
            FROZEN
          </span>
        </div>
      )}

      {/* Top row: branding + contactless icon */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
        <span style={{ fontSize: 11.5, fontWeight: 800, color: '#d4a843', letterSpacing: '0.14em' }}>
          CHEESE PAY
        </span>
        {/* Contactless waves */}
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ opacity: 0.45, marginTop: 1 }}>
          <path d="M10 3C6.8 4.9 4.8 8.2 4.8 12s2 7.1 5.2 9" stroke="white" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
          <path d="M13.2 5.8C11.6 7.1 10.6 9.4 10.6 12s1 4.9 2.6 6.2" stroke="white" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
          <path d="M16.4 8.6C15.7 9.7 15.3 10.8 15.3 12s.4 2.3 1.1 3.4" stroke="white" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
        </svg>
      </div>

      {/* EMV chip */}
      <div style={{
        width: 34, height: 24, borderRadius: 4, marginTop: 13,
        background: 'linear-gradient(135deg, #b8822a 0%, #e0aa46 35%, #c89038 65%, #9a6e20 100%)',
        border: '1px solid rgba(0,0,0,0.3)',
        position: 'relative', overflow: 'hidden',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
      }}>
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(0,0,0,0.18)', transform: 'translateY(-50%)' }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, background: 'rgba(0,0,0,0.14)', transform: 'translateX(-50%)' }} />
        <div style={{ position: 'absolute', top: '28%', left: '15%', right: '15%', height: 1, background: 'rgba(0,0,0,0.1)' }} />
        <div style={{ position: 'absolute', bottom: '28%', left: '15%', right: '15%', height: 1, background: 'rgba(0,0,0,0.1)' }} />
      </div>

      {/* Card number */}
      <div style={{
        marginTop: 13, fontSize: 15.5, letterSpacing: '0.2em',
        color: 'rgba(255,255,255,0.87)', fontFamily: 'monospace', fontWeight: 400,
        position: 'relative', zIndex: 1,
      }}>
        •••• •••• •••• {vc.last4}
      </div>

      {/* Bottom row: expiry | name | mastercard */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        marginTop: 13, position: 'relative', zIndex: 1,
      }}>
        <div>
          <div style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', marginBottom: 3 }}>
            VALID THRU
          </div>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.78)', letterSpacing: '0.06em', fontFamily: 'monospace' }}>
            {vc.expiryMonth.padStart(2, '0')}/{vc.expiryYear.slice(-2)}
          </div>
        </div>

        <div style={{
          fontSize: 10.5, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.05em',
          textTransform: 'uppercase', maxWidth: 110, textAlign: 'center',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {vc.holderName}
        </div>

        {/* Mastercard overlapping circles */}
        <div style={{ position: 'relative', width: 42, height: 26, flexShrink: 0 }}>
          <div style={{
            position: 'absolute', left: 0, top: 0,
            width: 26, height: 26, borderRadius: '50%',
            background: '#eb001b', opacity: 0.92,
          }} />
          <div style={{
            position: 'absolute', left: 16, top: 0,
            width: 26, height: 26, borderRadius: '50%',
            background: '#f79e1b', opacity: 0.88,
            mixBlendMode: 'screen',
          }} />
        </div>
      </div>
    </div>
  );
}

// ── Detail drawer ──────────────────────────────────────────────────────────────

function CardDrawer({ vc, onClose }: { vc: AdminCardItem; onClose: () => void }) {
  const ss = statusStyle(vc.status);

  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${c.border}` }}>
      <span style={{ fontSize: 12, color: c.textDim }}>{label}</span>
      <span style={{ fontSize: 12, color: c.text, fontWeight: 500, textAlign: 'right', maxWidth: 200, wordBreak: 'break-all' }}>{value}</span>
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 40,
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)',
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 400, zIndex: 41,
        background: c.sidebar, borderLeft: `1px solid ${c.border}`,
        overflowY: 'auto', display: 'flex', flexDirection: 'column',
      }}>

        {/* Drawer header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 24px', borderBottom: `1px solid ${c.border}`, flexShrink: 0,
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: c.text }}>Card Details</span>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)', border: `1px solid ${c.border}`,
              color: c.textMid, cursor: 'pointer', borderRadius: 7,
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Card visual */}
        <div style={{ padding: '28px 24px 20px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <CardVisual vc={vc} />
        </div>

        {/* Status + balance strip */}
        <div style={{ padding: '0 24px 20px', display: 'flex', gap: 10, flexShrink: 0 }}>
          <div style={{
            flex: 1, borderRadius: 10, padding: '12px 14px',
            background: 'rgba(255,255,255,0.03)', border: `1px solid ${c.border}`,
          }}>
            <div style={{ fontSize: 10, color: c.textDim, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 5 }}>Balance</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: c.text, fontVariantNumeric: 'tabular-nums' }}>${fmtUsdc(vc.availableBalance)}</div>
          </div>
          <div style={{
            flex: 1, borderRadius: 10, padding: '12px 14px',
            background: 'rgba(255,255,255,0.03)', border: `1px solid ${c.border}`,
          }}>
            <div style={{ fontSize: 10, color: c.textDim, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 5 }}>Monthly Spend</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: parseFloat(vc.monthlySpend) > 0 ? c.amber : c.textMid, fontVariantNumeric: 'tabular-nums' }}>
              ${fmtUsdc(vc.monthlySpend)}
            </div>
          </div>
        </div>

        {/* Details list */}
        <div style={{ padding: '0 24px 24px', flex: 1 }}>
          {row('Status',       <Pill label={vc.status.charAt(0).toUpperCase() + vc.status.slice(1)} color={ss.color} bg={ss.bg} brd={ss.brd} />)}
          {row('Cardholder',   vc.holderName)}
          {row('Username',     `@${vc.username}`)}
          {row('Email',        vc.email)}
          {row('Network',      vc.network.charAt(0).toUpperCase() + vc.network.slice(1))}
          {row('Last 4',       `•••• ${vc.last4}`)}
          {row('Expiry',       `${vc.expiryMonth.padStart(2, '0')} / ${vc.expiryYear}`)}
          {row('Spend Limit',  `$${fmtUsdc(vc.spendLimit)} / mo`)}
          {row('Issued',       fmtDate(vc.createdAt))}
        </div>
      </div>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CardsPage() {
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>('all');
  const [search,        setSearch]        = useState('');
  const [page,          setPage]          = useState(1);
  const [cards,         setCards]         = useState<AdminCardItem[]>([]);
  const [total,         setTotal]         = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [stats,         setStats]         = useState<StatCounts>({ total: 0, active: 0, frozen: 0, terminated: 0 });
  const [selectedCard,  setSelectedCard]  = useState<AdminCardItem | null>(null);

  // ── Summary counts ──────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      listAdminCards({ page: 1, limit: 1 }),
      listAdminCards({ page: 1, limit: 1, status: 'active'     }),
      listAdminCards({ page: 1, limit: 1, status: 'frozen'     }),
      listAdminCards({ page: 1, limit: 1, status: 'terminated' }),
    ])
      .then(([all, act, frz, term]) => {
        setStats({ total: all.total, active: act.total, frozen: frz.total, terminated: term.total });
      })
      .catch(console.error);
  }, []);

  // ── Table data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const delay = search ? 350 : 0;
    const timer = setTimeout(async () => {
      try {
        const result = await listAdminCards({
          page,
          limit:  LIMIT,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          search: search || undefined,
        });
        if (!cancelled) { setCards(result.cards); setTotal(result.total); }
      } catch (e) {
        if (!cancelled) {
          const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
            ?? (e instanceof Error ? e.message : 'Failed to load cards');
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, delay);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [page, search, statusFilter]);

  const handleStatus = (s: StatusFilter) => { setStatusFilter(s); setPage(1); };
  const handleSearch = (q: string)       => { setSearch(q);       setPage(1); };

  const n          = (v: number) => v.toLocaleString();
  const totalPages = Math.ceil(total / LIMIT);
  const from       = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to         = Math.min(page * LIMIT, total);

  const cardSurface: CSSProperties = {
    background: c.surface, border: `1px solid ${c.border}`, borderRadius: 14,
  };

  const STAT_ITEMS = [
    { label: 'Total Cards', value: n(stats.total),      color: c.text,  icon: <IcoCard /> },
    { label: 'Active',      value: n(stats.active),     color: c.green, icon: '✓'         },
    { label: 'Frozen',      value: n(stats.frozen),     color: c.blue,  icon: '❄'         },
    { label: 'Terminated',  value: n(stats.terminated), color: c.red,   icon: '✕'         },
  ] as const;

  return (
    <>
      <div style={{ height: '100%', overflowY: 'auto', padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 700, color: c.text, margin: 0, letterSpacing: '-0.02em' }}>
            Virtual Cards
          </h1>
          <div style={{ fontSize: 12, color: c.textDim, marginTop: 4 }}>
            All issued virtual cards — click any row to preview
          </div>
        </div>

        {/* ── Stats row ────────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {STAT_ITEMS.map(({ label, value, color, icon }) => (
            <div key={label} style={{ ...cardSurface, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'rgba(255,255,255,0.05)', border: `1px solid ${c.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, color,
              }}>
                {icon}
              </div>
              <div>
                <div style={{ fontSize: 11, color: c.textDim, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>
                  {label}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                  {value}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Toolbar ──────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '0 0 270px' }}>
            <span style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: c.textDim, display: 'flex', pointerEvents: 'none',
            }}>
              <IcoSearch />
            </span>
            <input
              type="text"
              className="user-search-input"
              placeholder="Search username, email, last 4…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          <div style={{ width: 1, height: 20, background: c.border, flexShrink: 0 }} />

          <div style={{ display: 'flex', gap: 4 }}>
            {STATUSES.map(({ key, label }) => (
              <button
                key={key}
                className="filter-btn"
                onClick={() => handleStatus(key)}
                style={{
                  background: statusFilter === key ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color:      statusFilter === key ? c.text                  : c.textDim,
                  border:     statusFilter === key ? `1px solid rgba(255,255,255,0.15)` : `1px solid transparent`,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ marginLeft: 'auto' }}>
            <span style={{ fontSize: 11.5, color: c.textDim }}>
              {loading ? 'Loading…' : `${n(total)} result${total !== 1 ? 's' : ''}`}
            </span>
          </div>
        </div>

        {/* ── Table ────────────────────────────────────────────────────────── */}
        <div style={{ ...cardSurface, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: COL_GRID,
            padding: '9px 22px', borderBottom: `1px solid ${c.border}`, flexShrink: 0,
          }}>
            {COLS.map((h) => (
              <div key={h} style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: c.textDim }}>
                {h}
              </div>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && cards.length === 0 ? (
              <div style={{ padding: '60px 22px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: c.textDim }}>Loading cards…</div>
              </div>
            ) : error ? (
              <div style={{ padding: '60px 22px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, color: c.red, fontWeight: 500, marginBottom: 6 }}>Failed to load cards</div>
                <div style={{ fontSize: 12, color: c.textDim, marginBottom: 16 }}>{error}</div>
                <button
                  onClick={() => { setPage(1); setStatusFilter('all'); setSearch(''); }}
                  style={{
                    fontSize: 12, color: c.textMid, background: 'rgba(255,255,255,0.05)',
                    border: `1px solid ${c.border}`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                  }}
                >
                  Retry
                </button>
              </div>
            ) : cards.length === 0 ? (
              <div style={{ padding: '60px 22px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, color: c.textMid, fontWeight: 500, marginBottom: 6 }}>No virtual cards found</div>
                <div style={{ fontSize: 12, color: c.textDim }}>Try adjusting your search or status filter.</div>
              </div>
            ) : (
              cards.map((vc, i) => {
                const ss       = statusStyle(vc.status);
                const isActive = selectedCard?.id === vc.id;
                return (
                  <div
                    key={vc.id}
                    className="row-hover"
                    onClick={() => setSelectedCard(isActive ? null : vc)}
                    style={{
                      display: 'grid', gridTemplateColumns: COL_GRID,
                      padding: '11px 22px', alignItems: 'center', cursor: 'pointer',
                      borderBottom: i < cards.length - 1 ? `1px solid ${c.border}` : 'none',
                      background: isActive ? 'rgba(255,255,255,0.04)' : 'transparent',
                    }}
                  >
                    {/* User */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: c.text }}>@{vc.username}</div>
                      <div style={{ fontSize: 11, color: c.textDim, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {vc.email}
                      </div>
                    </div>

                    {/* Card number */}
                    <div style={{ fontSize: 12, fontFamily: 'monospace', color: c.textMid, letterSpacing: '0.06em' }}>
                      •••• {vc.last4}
                      <div style={{ fontSize: 10, color: c.textDim, marginTop: 1, letterSpacing: 0, fontFamily: 'inherit' }}>
                        {vc.expiryMonth.padStart(2, '0')}/{vc.expiryYear.slice(-2)}
                      </div>
                    </div>

                    {/* Network */}
                    <div style={{ fontSize: 11.5, color: c.textMid, textTransform: 'capitalize' }}>
                      {vc.network}
                    </div>

                    {/* Status */}
                    <Pill
                      label={vc.status.charAt(0).toUpperCase() + vc.status.slice(1)}
                      color={ss.color} bg={ss.bg} brd={ss.brd}
                    />

                    {/* Balance */}
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: c.text, fontVariantNumeric: 'tabular-nums' }}>
                      ${fmtUsdc(vc.availableBalance)}
                    </div>

                    {/* Spend limit */}
                    <div style={{ fontSize: 12, color: c.textMid, fontVariantNumeric: 'tabular-nums' }}>
                      ${fmtUsdc(vc.spendLimit)}
                    </div>

                    {/* Monthly spend */}
                    <div style={{ fontSize: 12, color: parseFloat(vc.monthlySpend) > 0 ? c.amber : c.textDim, fontVariantNumeric: 'tabular-nums' }}>
                      ${fmtUsdc(vc.monthlySpend)}
                    </div>

                    {/* Issued */}
                    <div style={{ fontSize: 11.5, color: c.textDim }}>{fmtDate(vc.createdAt)}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Pagination ───────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 4px', flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, color: c.textDim }}>
            {total === 0 ? 'No cards' : (
              <>
                Showing <span style={{ color: c.text, fontWeight: 500 }}>{from}–{to}</span> of{' '}
                <span style={{ color: c.text, fontWeight: 500 }}>{n(total)}</span> cards
              </>
            )}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="action-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              style={{
                minWidth: 30, height: 30, padding: '0 8px', fontSize: 12,
                color: page <= 1 ? c.textDim : c.textMid, borderRadius: 7,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid transparent`, opacity: page <= 1 ? 0.4 : 1,
                cursor: page <= 1 ? 'default' : 'pointer',
              }}
            >
              ← Prev
            </button>
            <button
              className="action-btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              style={{
                minWidth: 30, height: 30, padding: '0 8px', fontSize: 12,
                color: page >= totalPages ? c.textDim : c.textMid, borderRadius: 7,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid transparent`, opacity: page >= totalPages ? 0.4 : 1,
                cursor: page >= totalPages ? 'default' : 'pointer',
              }}
            >
              Next →
            </button>
          </div>
        </div>

      </div>

      {/* ── Card detail drawer (portal-style, outside scroll container) ─────── */}
      {selectedCard && (
        <CardDrawer vc={selectedCard} onClose={() => setSelectedCard(null)} />
      )}
    </>
  );
}
