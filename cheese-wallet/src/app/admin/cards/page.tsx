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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CardsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search,       setSearch]       = useState('');
  const [page,         setPage]         = useState(1);
  const [cards,        setCards]        = useState<AdminCardItem[]>([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [stats,        setStats]        = useState<StatCounts>({ total: 0, active: 0, frozen: 0, terminated: 0 });

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

  const card: CSSProperties = {
    background: c.surface, border: `1px solid ${c.border}`, borderRadius: 14,
  };

  const STAT_ITEMS = [
    { label: 'Total Cards',  value: n(stats.total),      color: c.text,  icon: <IcoCard /> },
    { label: 'Active',       value: n(stats.active),     color: c.green, icon: '✓'         },
    { label: 'Frozen',       value: n(stats.frozen),     color: c.blue,  icon: '❄'         },
    { label: 'Terminated',   value: n(stats.terminated), color: c.red,   icon: '✕'         },
  ] as const;

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h1 style={{ fontSize: 21, fontWeight: 700, color: c.text, margin: 0, letterSpacing: '-0.02em' }}>
          Virtual Cards
        </h1>
        <div style={{ fontSize: 12, color: c.textDim, marginTop: 4 }}>
          All issued virtual cards — balances, spend limits, and card status at a glance
        </div>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {STAT_ITEMS.map(({ label, value, color, icon }) => (
          <div key={label} style={{ ...card, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
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

      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>

        {/* Search */}
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

        {/* Status tabs */}
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

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div style={{ ...card, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

        {/* Column headers */}
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

        {/* Rows */}
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
              const ss = statusStyle(vc.status);
              return (
                <div
                  key={vc.id}
                  className="row-hover"
                  style={{
                    display: 'grid', gridTemplateColumns: COL_GRID,
                    padding: '11px 22px', alignItems: 'center',
                    borderBottom: i < cards.length - 1 ? `1px solid ${c.border}` : 'none',
                  }}
                >
                  {/* User */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: c.text }}>@{vc.username}</div>
                    <div style={{
                      fontSize: 11, color: c.textDim, marginTop: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {vc.email}
                    </div>
                  </div>

                  {/* Card number */}
                  <div style={{ fontSize: 12, fontFamily: 'monospace', color: c.textMid, letterSpacing: '0.06em' }}>
                    •••• {vc.last4}
                    <div style={{ fontSize: 10, color: c.textDim, marginTop: 1, letterSpacing: 0, fontFamily: 'inherit' }}>
                      {vc.expiryMonth}/{vc.expiryYear}
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

                  {/* Available balance */}
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

                  {/* Issued date */}
                  <div style={{ fontSize: 11.5, color: c.textDim }}>{fmtDate(vc.createdAt)}</div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
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
  );
}
