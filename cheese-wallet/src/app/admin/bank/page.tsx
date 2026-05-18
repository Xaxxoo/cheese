'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import { c, IcoSearch, Pill } from '../_shared';
import {
  listAdminTransfers,
  completeAdminTransfer,
  type AdminTransferItem,
} from '@/lib/api/admin';
import { useAdminAuthStore } from '@/store/adminAuthStore';

type StatusFilter = 'all' | 'pending' | 'processing' | 'completed' | 'failed' | 'reversed';

const LIMIT = 20;

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

const fmtAmount = (v: string) =>
  parseFloat(v).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function statusStyle(s: string) {
  if (s === 'completed')  return { color: c.green,   bg: c.greenDim, brd: 'rgba(34,197,94,0.2)'  };
  if (s === 'failed')     return { color: c.red,     bg: c.redDim,   brd: 'rgba(239,68,68,0.2)'  };
  if (s === 'processing') return { color: c.blue,    bg: c.blueDim,  brd: 'rgba(96,165,250,0.2)' };
  if (s === 'reversed')   return { color: c.textMid, bg: 'rgba(255,255,255,0.05)', brd: 'transparent' };
  return { color: c.amber, bg: c.amberDim, brd: c.amberBrd }; // pending
}

const STATUSES: { key: StatusFilter; label: string }[] = [
  { key: 'all',        label: 'All'        },
  { key: 'pending',    label: 'Pending'    },
  { key: 'processing', label: 'Processing' },
  { key: 'completed',  label: 'Completed'  },
  { key: 'failed',     label: 'Failed'     },
  { key: 'reversed',   label: 'Reversed'   },
];

const COLS     = ['User / Reference', 'Bank & Account', 'Amount NGN', 'Amount USDC', 'Status', 'Failure Reason', 'Date', 'Actions'];
const COL_GRID = '1.6fr 1.8fr 110px 110px 100px 1.4fr 100px 110px';

interface StatCounts {
  total:      number;
  processing: number;
  failed:     number;
}

export default function BankPayoutsPage() {
  const { admin } = useAdminAuthStore();
  const canComplete =
    admin?.adminRole === 'super_admin' || admin?.adminRole === 'operator';

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search,       setSearch]       = useState('');
  const [page,         setPage]         = useState(1);
  const [transfers,    setTransfers]    = useState<AdminTransferItem[]>([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [completing,   setCompleting]   = useState<string | null>(null);
  const [stats,        setStats]        = useState<StatCounts>({ total: 0, processing: 0, failed: 0 });

  // ── Summary counts ────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      listAdminTransfers({ page: 1, limit: 1 }),
      listAdminTransfers({ page: 1, limit: 1, status: 'processing' }),
      listAdminTransfers({ page: 1, limit: 1, status: 'failed' }),
    ])
      .then(([all, proc, fail]) => {
        setStats({ total: all.total, processing: proc.total, failed: fail.total });
      })
      .catch(console.error);
  }, []);

  // ── Table data ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const delay = search ? 350 : 0;
    const timer = setTimeout(async () => {
      try {
        const result = await listAdminTransfers({
          page,
          limit:  LIMIT,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          search: search || undefined,
        });
        if (!cancelled) { setTransfers(result.transfers); setTotal(result.total); }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, delay);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [page, search, statusFilter]);

  const handleStatus = (s: StatusFilter) => { setStatusFilter(s); setPage(1); };
  const handleSearch = (q: string)       => { setSearch(q);       setPage(1); };

  async function handleComplete(id: string) {
    setCompleting(id);
    try {
      await completeAdminTransfer(id);
      setTransfers((prev) =>
        prev.map((t) => t.id === id ? { ...t, status: 'completed' } : t),
      );
      // Refresh summary counts
      listAdminTransfers({ page: 1, limit: 1, status: 'processing' })
        .then((r) => setStats((s) => ({ ...s, processing: r.total })))
        .catch(console.error);
    } catch (e) {
      console.error(e);
    } finally {
      setCompleting(null);
    }
  }

  const n          = (v: number) => v.toLocaleString();
  const totalPages = Math.ceil(total / LIMIT);
  const from       = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to         = Math.min(page * LIMIT, total);

  const card: CSSProperties = {
    background: c.surface, border: `1px solid ${c.border}`, borderRadius: 14,
  };

  const STAT_ITEMS = [
    { label: 'Total Payouts',  value: n(stats.total),      color: c.text,  icon: '₦' },
    { label: 'Processing',     value: n(stats.processing), color: c.blue,  icon: '⟳' },
    { label: 'Failed',         value: n(stats.failed),     color: c.red,   icon: '✕' },
  ] as const;

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div>
        <h1 style={{ fontSize: 21, fontWeight: 700, color: c.text, margin: 0, letterSpacing: '-0.02em' }}>
          Bank Payouts
        </h1>
        <div style={{ fontSize: 12, color: c.textDim, marginTop: 4 }}>
          Monitor NGN bank transfer payouts — manually settle or review failed transfers
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
            placeholder="Search reference, account, username…"
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
          {loading && transfers.length === 0 ? (
            <div style={{ padding: '60px 22px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: c.textDim }}>Loading payouts…</div>
            </div>
          ) : transfers.length === 0 ? (
            <div style={{ padding: '60px 22px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: c.textMid, fontWeight: 500, marginBottom: 6 }}>No payouts found</div>
              <div style={{ fontSize: 12, color: c.textDim }}>Try adjusting your search or status filter.</div>
            </div>
          ) : (
            transfers.map((t, i) => {
              const ss           = statusStyle(t.status);
              const isActionable = canComplete && (t.status === 'pending' || t.status === 'processing');
              const isCompleting = completing === t.id;

              return (
                <div
                  key={t.id}
                  className="row-hover"
                  style={{
                    display: 'grid', gridTemplateColumns: COL_GRID,
                    padding: '11px 22px', alignItems: 'center',
                    borderBottom: i < transfers.length - 1 ? `1px solid ${c.border}` : 'none',
                  }}
                >
                  {/* User / Reference */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: c.text }}>@{t.username}</div>
                    <div style={{ fontSize: 10.5, color: c.textDim, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.reference}
                    </div>
                  </div>

                  {/* Bank & Account */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.accountName}
                    </div>
                    <div style={{ fontSize: 10.5, color: c.textDim, marginTop: 1 }}>
                      {t.bankName} · {t.accountNumber}
                    </div>
                  </div>

                  {/* NGN */}
                  <div style={{ fontSize: 12.5, color: c.text, fontVariantNumeric: 'tabular-nums' }}>
                    ₦{fmtAmount(t.amountNgn)}
                  </div>

                  {/* USDC */}
                  <div style={{ fontSize: 12.5, color: c.textMid, fontVariantNumeric: 'tabular-nums' }}>
                    ${fmtAmount(t.amountUsdc)}
                  </div>

                  {/* Status */}
                  <Pill
                    label={t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                    color={ss.color} bg={ss.bg} brd={ss.brd}
                  />

                  {/* Failure Reason */}
                  <div style={{
                    fontSize: 11.5,
                    color: t.failureReason ? c.red : c.textDim,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    paddingRight: 8,
                  }}>
                    {t.failureReason ?? '—'}
                  </div>

                  {/* Date */}
                  <div style={{ fontSize: 11.5, color: c.textDim }}>{fmtDate(t.createdAt)}</div>

                  {/* Actions */}
                  <div>
                    {isActionable ? (
                      <button
                        onClick={() => void handleComplete(t.id)}
                        disabled={isCompleting}
                        style={{
                          fontSize: 11, fontWeight: 600,
                          color: isCompleting ? c.green : '#000',
                          background: isCompleting ? c.greenDim : c.green,
                          border: `1px solid rgba(34,197,94,0.3)`,
                          borderRadius: 7, padding: '4px 10px',
                          cursor: isCompleting ? 'default' : 'pointer',
                          opacity: isCompleting ? 0.7 : 1,
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s',
                        }}
                      >
                        {isCompleting ? 'Settling…' : 'Mark Done'}
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, color: c.textDim }}>—</span>
                    )}
                  </div>
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
          {total === 0 ? 'No payouts' : (
            <>
              Showing <span style={{ color: c.text, fontWeight: 500 }}>{from}–{to}</span> of{' '}
              <span style={{ color: c.text, fontWeight: 500 }}>{n(total)}</span> payouts
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
