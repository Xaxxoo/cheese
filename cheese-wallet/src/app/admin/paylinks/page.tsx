'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import { c, IcoSearch, IcoLink, Pill, IcoClock, IcoCheck, IcoChevron, IcoChevLeft } from '../_shared';
import { listAdminPaylinks, type AdminPayLinkItem } from '@/lib/api/admin';

type StatusFilter = 'all' | 'pending' | 'paid' | 'expired' | 'cancelled';

const LIMIT = 20;

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

const fmtUsdc = (v: string) =>
  parseFloat(v).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function statusStyle(s: string) {
  if (s === 'paid')      return { color: c.green,   bg: c.greenDim,  brd: 'rgba(34,197,94,0.2)'  };
  if (s === 'expired')   return { color: c.red,     bg: c.redDim,    brd: 'rgba(239,68,68,0.2)'  };
  if (s === 'cancelled') return { color: c.textMid, bg: 'rgba(255,255,255,0.05)', brd: 'transparent' };
  return { color: c.amber, bg: c.amberDim, brd: c.amberBrd }; // pending
}

const STATUSES: { key: StatusFilter; label: string }[] = [
  { key: 'all',       label: 'All'       },
  { key: 'pending',   label: 'Pending'   },
  { key: 'paid',      label: 'Paid'      },
  { key: 'expired',   label: 'Expired'   },
  { key: 'cancelled', label: 'Cancelled' },
];

const COLS     = ['Creator', 'Amount', 'Note', 'Status', 'Paid By', 'Expires', 'Created'];
const COL_GRID = '1.4fr 100px 1.6fr 100px 1.2fr 110px 110px';

interface StatCounts {
  total:   number;
  pending: number;
  paid:    number;
}

export default function PayLinksPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search,       setSearch]       = useState('');
  const [page,         setPage]         = useState(1);
  const [paylinks,     setPaylinks]     = useState<AdminPayLinkItem[]>([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [stats,        setStats]        = useState<StatCounts>({ total: 0, pending: 0, paid: 0 });

  // ── Summary counts ────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      listAdminPaylinks({ page: 1, limit: 1 }),
      listAdminPaylinks({ page: 1, limit: 1, status: 'pending' }),
      listAdminPaylinks({ page: 1, limit: 1, status: 'paid' }),
    ])
      .then(([all, pend, paid]) => {
        setStats({ total: all.total, pending: pend.total, paid: paid.total });
      })
      .catch(console.error);
  }, []);

  // ── Table data ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const delay = search ? 350 : 0;
    const timer = setTimeout(async () => {
      try {
        const result = await listAdminPaylinks({
          page,
          limit:  LIMIT,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          search: search || undefined,
        });
        if (!cancelled) { setPaylinks(result.paylinks); setTotal(result.total); }
      } catch (e) {
        if (!cancelled) {
          const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
            ?? (e instanceof Error ? e.message : 'Failed to load pay links');
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
    { label: 'Total Pay Links', value: n(stats.total),   color: c.text,  icon: <IcoLink /> },
    { label: 'Pending',         value: n(stats.pending), color: c.amber, icon: <IcoClock /> },
    { label: 'Paid',            value: n(stats.paid),    color: c.green, icon: <IcoCheck /> },
  ] as const;

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div>
        <h1 style={{ fontSize: 21, fontWeight: 700, color: c.text, margin: 0, letterSpacing: '-0.02em' }}>
          Pay Links
        </h1>
        <div style={{ fontSize: 12, color: c.textDim, marginTop: 4 }}>
          All platform payment requests — track paid, pending, and expired links
        </div>
      </div>

      {/* ── Stats row ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
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

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
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
            placeholder="Search creator, payer, note…"
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

      {/* ── Table ────────────────────────────────────────────────────────── */}
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
          {loading && paylinks.length === 0 ? (
            <div style={{ padding: '60px 22px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: c.textDim }}>Loading pay links…</div>
            </div>
          ) : error ? (
            <div style={{ padding: '60px 22px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: c.red, fontWeight: 500, marginBottom: 6 }}>Failed to load pay links</div>
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
          ) : paylinks.length === 0 ? (
            <div style={{ padding: '60px 22px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: c.textMid, fontWeight: 500, marginBottom: 6 }}>No pay links found</div>
              <div style={{ fontSize: 12, color: c.textDim }}>Try adjusting your search or status filter.</div>
            </div>
          ) : (
            paylinks.map((pl, i) => {
              const ss = statusStyle(pl.status);
              return (
                <div
                  key={pl.id}
                  className="row-hover"
                  style={{
                    display: 'grid', gridTemplateColumns: COL_GRID,
                    padding: '11px 22px', alignItems: 'center',
                    borderBottom: i < paylinks.length - 1 ? `1px solid ${c.border}` : 'none',
                  }}
                >
                  {/* Creator */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: c.text }}>@{pl.creatorUsername}</div>
                    <div style={{
                      fontSize: 10, color: c.textDim, marginTop: 1,
                      fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {pl.token.slice(0, 12)}…
                    </div>
                  </div>

                  {/* Amount */}
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: c.text, fontVariantNumeric: 'tabular-nums' }}>
                    ${fmtUsdc(pl.amountUsdc)}
                  </div>

                  {/* Note */}
                  <div style={{
                    fontSize: 12, color: pl.note ? c.textMid : c.textDim,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    paddingRight: 8,
                    fontStyle: pl.note ? 'normal' : 'italic',
                  }}>
                    {pl.note ?? 'No note'}
                  </div>

                  {/* Status */}
                  <Pill
                    label={pl.status.charAt(0).toUpperCase() + pl.status.slice(1)}
                    color={ss.color} bg={ss.bg} brd={ss.brd}
                  />

                  {/* Paid by */}
                  <div style={{ fontSize: 12, color: pl.payerUsername ? c.green : c.textDim }}>
                    {pl.payerUsername ? `@${pl.payerUsername}` : '—'}
                  </div>

                  {/* Expires */}
                  <div style={{ fontSize: 11.5, color: c.textDim }}>{fmtDate(pl.expiresAt)}</div>

                  {/* Created */}
                  <div style={{ fontSize: 11.5, color: c.textDim }}>{fmtDate(pl.createdAt)}</div>
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
          {total === 0 ? 'No pay links' : (
            <>
              Showing <span style={{ color: c.text, fontWeight: 500 }}>{from}–{to}</span> of{' '}
              <span style={{ color: c.text, fontWeight: 500 }}>{n(total)}</span> pay links
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
              cursor: page <= 1 ? 'default' : 'pointer', gap: 4,
            }}
          >
            <IcoChevLeft />{' '}Prev
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
              cursor: page >= totalPages ? 'default' : 'pointer', gap: 4,
            }}
          >
            Next{' '}<IcoChevron />
          </button>
        </div>
      </div>

    </div>
  );
}
