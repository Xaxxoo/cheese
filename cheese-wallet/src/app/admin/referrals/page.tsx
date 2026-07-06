'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { c, IcoSearch, Pill, IcoRefresh, IcoCheck, IcoClock, IcoChevron, IcoChevLeft } from '../_shared';
import { listAdminReferrals, type AdminReferralItem } from '@/lib/api/admin';

const LIMIT = 25;

const STATUSES = [
  { key: 'all',       label: 'All'       },
  { key: 'pending',   label: 'Pending'   },
  { key: 'qualified', label: 'Qualified' },
  { key: 'rewarded',  label: 'Rewarded'  },
] as const;

type StatusFilter = typeof STATUSES[number]['key'];

const COLS     = ['Referrer', 'Referee', 'Status', 'Reward', 'Date'];
const COL_GRID = '1.4fr 1.4fr 110px 110px 120px';

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

function statusStyle(s: string) {
  if (s === 'rewarded')  return { color: c.green,  bg: c.greenDim,  brd: 'rgba(34,197,94,0.2)'  };
  if (s === 'qualified') return { color: c.blue,   bg: c.blueDim,   brd: 'rgba(96,165,250,0.2)' };
  return                        { color: c.amber,  bg: c.amberDim,  brd: c.amberBrd             };
}

export default function ReferralsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search,       setSearch]       = useState('');
  const [page,         setPage]         = useState(1);
  const [rows,         setRows]         = useState<AdminReferralItem[]>([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);

  // summary counts
  const [counts, setCounts] = useState({ total: 0, rewarded: 0, pending: 0 });

  useEffect(() => {
    Promise.all([
      listAdminReferrals({ page: 1, limit: 1 }),
      listAdminReferrals({ page: 1, limit: 1, status: 'rewarded' }),
      listAdminReferrals({ page: 1, limit: 1, status: 'pending'  }),
    ]).then(([all, rew, pen]) => {
      setCounts({ total: all.total, rewarded: rew.total, pending: pen.total });
    }).catch(console.error);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const delay = search ? 350 : 0;
    const timer = setTimeout(async () => {
      try {
        const res = await listAdminReferrals({
          page,
          limit:  LIMIT,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          search: search || undefined,
        });
        if (!cancelled) { setRows(res.referrals); setTotal(res.total); }
      } catch (e) { console.error(e); }
      finally { if (!cancelled) setLoading(false); }
    }, delay);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [page, search, statusFilter]);

  function handleStatus(s: StatusFilter) { setStatusFilter(s); setPage(1); }
  function handleSearch(q: string)       { setSearch(q);       setPage(1); }

  const n          = (v: number) => v.toLocaleString();
  const totalPages = Math.ceil(total / LIMIT);
  const from       = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to         = Math.min(page * LIMIT, total);

  const card = { background: c.surface, border: `1px solid ${c.border}`, borderRadius: 14 };

  const STAT_ITEMS = [
    { label: 'Total Referrals', value: n(counts.total),   color: c.text,  icon: <IcoRefresh /> },
    { label: 'Rewarded',        value: n(counts.rewarded), color: c.green, icon: <IcoCheck />   },
    { label: 'Pending',         value: n(counts.pending),  color: c.amber, icon: <IcoClock />   },
  ] as const;

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 21, fontWeight: 700, color: c.text, margin: 0, letterSpacing: '-0.02em' }}>
          Referrals
        </h1>
        <div style={{ fontSize: 12, color: c.textDim, marginTop: 4 }}>
          All user referrals — pending signup, qualified, and rewarded
        </div>
      </div>

      {/* Stats */}
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

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
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

        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: c.textDim, display: 'flex', pointerEvents: 'none' }}>
            <IcoSearch />
          </span>
          <input
            className="user-search-input"
            style={{ paddingLeft: 32, width: 220 }}
            placeholder="Search username…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ ...card, overflow: 'hidden' }}>
        {/* Col headers */}
        <div style={{ display: 'grid', gridTemplateColumns: COL_GRID, padding: '9px 22px', borderBottom: `1px solid ${c.border}` }}>
          {COLS.map((h) => (
            <div key={h} style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: c.textDim }}>
              {h}
            </div>
          ))}
        </div>

        {loading && rows.length === 0 ? (
          <div style={{ padding: '60px 22px', textAlign: 'center', fontSize: 13, color: c.textDim }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '60px 22px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: c.textMid, fontWeight: 500 }}>No referrals found</div>
            <div style={{ fontSize: 12, color: c.textDim, marginTop: 4 }}>Try adjusting your search or filter.</div>
          </div>
        ) : (
          rows.map((r, i) => {
            const ss = statusStyle(r.status);
            return (
              <div
                key={r.id}
                className="row-hover"
                style={{
                  display: 'grid', gridTemplateColumns: COL_GRID,
                  padding: '11px 22px', alignItems: 'center',
                  borderBottom: i < rows.length - 1 ? `1px solid ${c.border}` : 'none',
                }}
              >
                {/* Referrer */}
                <Link href={`/admin/users/${r.referrerId}`} style={{ textDecoration: 'none', minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: c.text }}>@{r.referrerUsername}</div>
                </Link>

                {/* Referee */}
                <Link href={`/admin/users/${r.refereeId}`} style={{ textDecoration: 'none', minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: c.textMid }}>@{r.refereeUsername}</div>
                </Link>

                {/* Status */}
                <Pill
                  label={r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                  color={ss.color} bg={ss.bg} brd={ss.brd}
                />

                {/* Reward */}
                <div style={{ fontSize: 12.5, fontVariantNumeric: 'tabular-nums', color: r.rewardUsdc ? c.green : c.textDim }}>
                  {r.rewardUsdc ? `$${parseFloat(r.rewardUsdc).toFixed(2)}` : '—'}
                </div>

                {/* Date */}
                <div style={{ fontSize: 11.5, color: c.textDim }}>{fmtDate(r.createdAt)}</div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px' }}>
          <span style={{ fontSize: 12, color: c.textDim }}>
            Showing <b style={{ color: c.text }}>{from}–{to}</b> of <b style={{ color: c.text }}>{n(total)}</b>
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="action-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              style={{ minWidth: 30, height: 30, padding: '0 10px', fontSize: 12, color: c.textMid, borderRadius: 7, border: '1px solid transparent', opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <IcoChevLeft />{' '}Prev
            </button>
            <button className="action-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
              style={{ minWidth: 30, height: 30, padding: '0 10px', fontSize: 12, color: c.textMid, borderRadius: 7, border: '1px solid transparent', opacity: page >= totalPages ? 0.4 : 1, cursor: page >= totalPages ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              Next{' '}<IcoChevron />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
