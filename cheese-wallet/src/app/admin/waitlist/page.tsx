'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import { c, IcoSearch, Pill, IcoRefresh, IcoClock, IcoMail, IcoCheck, IcoChevron, IcoChevLeft } from '../_shared';
import { listAdminWaitlist, type AdminWaitlistItem } from '@/lib/api/admin';

// ── Helpers ───────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'pending' | 'notified' | 'converted';

const LIMIT = 20;

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function statusStyle(s: string) {
  if (s === 'converted') return { color: c.green,   bg: c.greenDim,  brd: 'rgba(34,197,94,0.2)'  };
  if (s === 'notified')  return { color: c.blue,    bg: c.blueDim,   brd: 'rgba(96,165,250,0.2)' };
  return                        { color: c.amber,   bg: c.amberDim,  brd: c.amberBrd              };
}

const STATUSES: { key: StatusFilter; label: string }[] = [
  { key: 'all',       label: 'All'       },
  { key: 'pending',   label: 'Pending'   },
  { key: 'notified',  label: 'Notified'  },
  { key: 'converted', label: 'Converted' },
];

const COLS     = ['#', 'Username', 'Email', 'Status', 'Points', 'Referral Code', 'Joined', 'Converted'];
const COL_GRID = '50px 1.2fr 1.6fr 100px 80px 130px 110px 110px';

interface StatCounts { total: number; pending: number; notified: number; converted: number }

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WaitlistPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search,       setSearch]       = useState('');
  const [page,         setPage]         = useState(1);
  const [entries,      setEntries]      = useState<AdminWaitlistItem[]>([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [stats,        setStats]        = useState<StatCounts>({ total: 0, pending: 0, notified: 0, converted: 0 });

  // ── Summary counts ──────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      listAdminWaitlist({ page: 1, limit: 1 }),
      listAdminWaitlist({ page: 1, limit: 1, status: 'pending'   }),
      listAdminWaitlist({ page: 1, limit: 1, status: 'notified'  }),
      listAdminWaitlist({ page: 1, limit: 1, status: 'converted' }),
    ])
      .then(([all, pend, notif, conv]) => {
        setStats({ total: all.total, pending: pend.total, notified: notif.total, converted: conv.total });
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
        const result = await listAdminWaitlist({
          page,
          limit:  LIMIT,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          search: search || undefined,
        });
        if (!cancelled) { setEntries(result.entries); setTotal(result.total); }
      } catch (e) {
        if (!cancelled) {
          const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
            ?? (e instanceof Error ? e.message : 'Failed to load waitlist');
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
    { label: 'Total Signups', value: n(stats.total),     color: c.text,  icon: <IcoRefresh /> },
    { label: 'Pending',       value: n(stats.pending),   color: c.amber, icon: <IcoClock />   },
    { label: 'Notified',      value: n(stats.notified),  color: c.blue,  icon: <IcoMail />    },
    { label: 'Converted',     value: n(stats.converted), color: c.green, icon: <IcoCheck />   },
  ] as const;

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h1 style={{ fontSize: 21, fontWeight: 700, color: c.text, margin: 0, letterSpacing: '-0.02em' }}>
          Waitlist
        </h1>
        <div style={{ fontSize: 12, color: c.textDim, marginTop: 4 }}>
          Pre-launch signups — track position, points, referrals, and conversion status
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
            placeholder="Search username, email, code…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        <div style={{ width: 1, height: 20, background: c.border, flexShrink: 0 }} />

        {/* Status filter */}
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
          {loading && entries.length === 0 ? (
            <div style={{ padding: '60px 22px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: c.textDim }}>Loading waitlist…</div>
            </div>
          ) : error ? (
            <div style={{ padding: '60px 22px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: c.red, fontWeight: 500, marginBottom: 6 }}>Failed to load waitlist</div>
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
          ) : entries.length === 0 ? (
            <div style={{ padding: '60px 22px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: c.textMid, fontWeight: 500, marginBottom: 6 }}>No waitlist entries found</div>
              <div style={{ fontSize: 12, color: c.textDim }}>Try adjusting your search or filter.</div>
            </div>
          ) : (
            entries.map((w, i) => {
              const ss = statusStyle(w.status);
              return (
                <div
                  key={w.id}
                  className="row-hover"
                  style={{
                    display: 'grid', gridTemplateColumns: COL_GRID,
                    padding: '11px 22px', alignItems: 'center',
                    borderBottom: i < entries.length - 1 ? `1px solid ${c.border}` : 'none',
                  }}
                >
                  {/* Position */}
                  <div style={{ fontSize: 12, color: c.textDim, fontVariantNumeric: 'tabular-nums' }}>
                    {w.position ?? '—'}
                  </div>

                  {/* Username */}
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: c.text }}>
                    @{w.username}
                  </div>

                  {/* Email */}
                  <div style={{
                    fontSize: 12, color: c.textMid,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8,
                  }}>
                    {w.email}
                  </div>

                  {/* Status */}
                  <Pill
                    label={w.status.charAt(0).toUpperCase() + w.status.slice(1)}
                    color={ss.color} bg={ss.bg} brd={ss.brd}
                  />

                  {/* Points */}
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: c.text, fontVariantNumeric: 'tabular-nums' }}>
                    {w.points.toLocaleString()}
                  </div>

                  {/* Referral Code */}
                  <div style={{ fontSize: 11, fontFamily: 'monospace', color: c.textMid, letterSpacing: '0.04em' }}>
                    {w.referralCode ?? '—'}
                  </div>

                  {/* Joined */}
                  <div style={{ fontSize: 11.5, color: c.textDim }}>{fmtDate(w.createdAt)}</div>

                  {/* Converted */}
                  <div style={{ fontSize: 11.5, color: w.convertedAt ? c.green : c.textDim }}>
                    {fmtDate(w.convertedAt)}
                  </div>
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
          {total === 0 ? 'No entries' : (
            <>
              Showing <span style={{ color: c.text, fontWeight: 500 }}>{from}–{to}</span> of{' '}
              <span style={{ color: c.text, fontWeight: 500 }}>{n(total)}</span> signups
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
