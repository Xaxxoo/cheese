'use client';

import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import Link from 'next/link';
import {
  c, IcoSearch, IcoShield, IcoMore,
  Pill, tierStyle, kycStyle, IcoChevron, IcoChevLeft,
} from '../_shared';
import {
  listAdminKyc, getAdminStats, approveBlackTier, rejectBlackTier,
  type AdminKycUserItem, type AdminStats,
} from '@/lib/api/admin';

type TierFilter = 'All' | 'Silver' | 'Gold' | 'Black';
type KycFilter  = 'All' | 'Verified' | 'Pending' | 'Reviewing' | 'Failed';

const LIMIT = 20;

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

const fmtRelative = (s: string) => {
  const diff = Date.now() - new Date(s).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
};

// ─── KYC & Tiers page ─────────────────────────────────────────────────────────
export default function KycPage() {
  const [stats, setStats]           = useState<AdminStats | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Pending Black requests ──────────────────────────────────────────────
  const [pendingBlack, setPendingBlack]     = useState<AdminKycUserItem[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);

  // ── Per-row confirm state ───────────────────────────────────────────────
  type ConfirmState = { id: string; name: string; action: 'approve' | 'reject'; reason: string };
  const [confirm, setConfirm]           = useState<ConfirmState | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError]   = useState('');

  // ── All users table ─────────────────────────────────────────────────────
  const [search,     setSearch]     = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('All');
  const [kycFilter,  setKycFilter]  = useState<KycFilter>('All');
  const [page,       setPage]       = useState(1);
  const [users,      setUsers]      = useState<AdminKycUserItem[]>([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);

  // ── Load stats ──────────────────────────────────────────────────────────
  const loadStats = useCallback(() => {
    getAdminStats().then(setStats).catch(console.error);
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  // ── Load pending Black requests ─────────────────────────────────────────
  const loadPending = useCallback(async () => {
    setPendingLoading(true);
    try {
      const res = await listAdminKyc({ pendingBlack: true, limit: 50 });
      setPendingBlack(res.users);
    } catch (e) {
      console.error(e);
    } finally {
      setPendingLoading(false);
    }
  }, []);

  useEffect(() => { void loadPending(); }, [loadPending, refreshKey]);

  // ── Load all users table ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const delay = search ? 350 : 0;
    const timer = setTimeout(async () => {
      try {
        const res = await listAdminKyc({
          page,
          limit: LIMIT,
          search:  search || undefined,
          tier:    tierFilter !== 'All' ? tierFilter : undefined,
          kyc:     kycFilter  !== 'All' ? kycFilter  : undefined,
        });
        if (!cancelled) { setUsers(res.users); setTotal(res.total); }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, delay);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [page, search, tierFilter, kycFilter, refreshKey]);

  const handleSearch = (s: string)     => { setSearch(s);     setPage(1); };
  const handleTier   = (t: TierFilter) => { setTierFilter(t); setPage(1); };
  const handleKyc    = (k: KycFilter)  => { setKycFilter(k);  setPage(1); };

  // ── Approve / Reject action ─────────────────────────────────────────────
  async function handleAction() {
    if (!confirm) return;
    setActionLoading(true);
    setActionError('');
    try {
      if (confirm.action === 'approve') {
        await approveBlackTier(confirm.id);
      } else {
        await rejectBlackTier(confirm.id, confirm.reason);
      }
      setConfirm(null);
      loadStats();
      setRefreshKey((k) => k + 1);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } }; message?: string })
        ?.response?.data?.message ?? (e as Error).message ?? 'Action failed';
      setActionError(msg);
    } finally {
      setActionLoading(false);
    }
  }

  // ── Pagination helpers ──────────────────────────────────────────────────
  const n          = (v: number) => v.toLocaleString();
  const totalPages = Math.ceil(total / LIMIT);
  const from       = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to         = Math.min(page * LIMIT, total);

  const pageButtons = (): (number | '···')[] => {
    if (totalPages <= 7) return Array.from({ length: Math.max(1, totalPages) }, (_, i) => i + 1);
    if (page <= 4)              return [1, 2, 3, 4, 5, '···', totalPages];
    if (page >= totalPages - 3) return [1, '···', totalPages-4, totalPages-3, totalPages-2, totalPages-1, totalPages];
    return [1, '···', page-1, page, page+1, '···', totalPages];
  };

  const card: CSSProperties = { background: c.surface, border: `1px solid ${c.border}`, borderRadius: 14 };

  const TIERS: TierFilter[] = ['All', 'Silver', 'Gold', 'Black'];
  const KYCS:  KycFilter[]  = ['All', 'Verified', 'Pending', 'Reviewing', 'Failed'];

  const COLS     = ['User', 'Tier', 'KYC', 'Black Req.', 'Email', 'Joined', ''];
  const COL_GRID = '2.2fr 80px 90px 90px 1.4fr 100px 36px';

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 style={{ fontSize: 21, fontWeight: 700, color: c.text, margin: 0, letterSpacing: '-0.02em' }}>
          KYC & Tiers
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {stats ? [
            { label: `${n(stats.totalUsers)} users`,                      color: c.textMid,  bg: 'rgba(255,255,255,0.06)', brd: c.border },
            { label: `${n(stats.verifiedUsers)} verified`,                color: c.green,    bg: c.greenDim,              brd: 'rgba(34,197,94,0.2)' },
            { label: `${n(stats.pendingKyc)} reviewing`,                  color: c.amber,    bg: c.amberDim,              brd: c.amberBrd },
            { label: `${n(stats.pendingBlackCount ?? 0)} awaiting Black`, color: '#e4e4e7',  bg: 'rgba(255,255,255,0.07)', brd: 'rgba(255,255,255,0.15)' },
          ].map((chip) => (
            <span key={chip.label} style={{
              fontSize: 11, fontWeight: 600, color: chip.color,
              background: chip.bg, border: `1px solid ${chip.brd}`,
              padding: '3px 10px', borderRadius: 99,
            }}>
              {chip.label}
            </span>
          )) : (
            <span style={{ fontSize: 11, color: c.textDim }}>Loading stats…</span>
          )}
        </div>
      </div>

      {/* ── Black Tier Requests ──────────────────────────────────────────── */}
      <div style={{ ...card, overflow: 'hidden' }}>
        {/* Section header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '13px 22px', borderBottom: `1px solid ${c.border}`,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e4e4e7',
          }}>
            <IcoShield />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>Black Tier Requests</div>
            <div style={{ fontSize: 11, color: c.textDim, marginTop: 1 }}>
              {pendingLoading
                ? 'Loading…'
                : pendingBlack.length === 0
                  ? 'No pending requests'
                  : `${pendingBlack.length} request${pendingBlack.length !== 1 ? 's' : ''} awaiting review`}
            </div>
          </div>
        </div>

        {/* Pending rows */}
        {!pendingLoading && pendingBlack.length === 0 && (
          <div style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.green, flexShrink: 0, display: 'inline-block' }} />
            <span style={{ fontSize: 12.5, color: c.textMid }}>All clear — no users are waiting for Black tier approval.</span>
          </div>
        )}

        {!pendingLoading && pendingBlack.map((u, i) => {
          const initials    = u.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
          const isConfirming = confirm?.id === u.id;

          return (
            <div key={u.id} style={{ borderBottom: i < pendingBlack.length - 1 || isConfirming ? `1px solid ${c.border}` : 'none' }}>
              {/* Row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2.4fr 1.5fr 130px 190px',
                padding: '12px 22px', alignItems: 'center',
              }}>
                {/* User */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: '#e4e4e7',
                  }}>
                    {initials}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.name}
                    </div>
                    <div style={{ fontSize: 10.5, color: c.textDim }}>{u.username}</div>
                  </div>
                </div>

                {/* Email */}
                <div style={{ fontSize: 12, color: c.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.email}
                </div>

                {/* Submitted */}
                <div style={{ fontSize: 11.5, color: c.textDim }}>{fmtRelative(u.updatedAt)}</div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end' }}>
                  <button
                    className="action-btn"
                    onClick={() => { setConfirm({ id: u.id, name: u.name, action: 'reject', reason: '' }); setActionError(''); }}
                    style={{
                      padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500,
                      color: c.red, background: c.redDim, border: `1px solid rgba(239,68,68,0.2)`,
                      cursor: 'pointer',
                    }}
                  >
                    Reject
                  </button>
                  <button
                    className="action-btn"
                    onClick={() => { setConfirm({ id: u.id, name: u.name, action: 'approve', reason: '' }); setActionError(''); }}
                    style={{
                      padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                      color: '#09090b', background: '#e4e4e7', border: '1px solid rgba(255,255,255,0.15)',
                      cursor: 'pointer',
                    }}
                  >
                    Approve
                  </button>
                </div>
              </div>

              {/* Confirm panel */}
              {isConfirming && (
                <div style={{
                  padding: '14px 22px 16px',
                  background: confirm!.action === 'approve' ? 'rgba(255,255,255,0.02)' : 'rgba(239,68,68,0.05)',
                  borderTop: `1px solid ${c.border}`,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: c.text, marginBottom: 12 }}>
                    {confirm!.action === 'approve'
                      ? `Upgrade ${u.name} to Black tier?`
                      : `Reject Black tier request from ${u.name}?`}
                  </div>

                  {confirm!.action === 'reject' && (
                    <input
                      type="text"
                      className="user-search-input"
                      placeholder="Reason for rejection (optional, sent to user)"
                      value={confirm!.reason}
                      onChange={(e) => setConfirm({ ...confirm!, reason: e.target.value })}
                      style={{ marginBottom: 12, maxWidth: 440, paddingLeft: 12 }}
                    />
                  )}

                  {actionError && (
                    <div style={{ fontSize: 11.5, color: c.red, marginBottom: 10 }}>{actionError}</div>
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="action-btn"
                      onClick={() => { setConfirm(null); setActionError(''); }}
                      style={{
                        padding: '5px 14px', fontSize: 12, color: c.textMid,
                        background: 'rgba(255,255,255,0.06)', border: `1px solid ${c.border}`,
                        borderRadius: 7, cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="action-btn"
                      disabled={actionLoading}
                      onClick={() => void handleAction()}
                      style={{
                        padding: '5px 18px', fontSize: 12, fontWeight: 600,
                        color: confirm!.action === 'approve' ? '#09090b' : '#fff',
                        background: confirm!.action === 'approve' ? '#e4e4e7' : c.red,
                        border: 'none', borderRadius: 7,
                        opacity: actionLoading ? 0.6 : 1,
                        cursor: actionLoading ? 'wait' : 'pointer',
                      }}
                    >
                      {actionLoading
                        ? (confirm!.action === 'approve' ? 'Approving…' : 'Rejecting…')
                        : (confirm!.action === 'approve' ? 'Confirm Approve' : 'Confirm Reject')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>

        {/* Search */}
        <div style={{ position: 'relative', flex: '0 0 260px' }}>
          <span style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            color: c.textDim, display: 'flex', pointerEvents: 'none',
          }}>
            <IcoSearch />
          </span>
          <input
            type="text"
            className="user-search-input"
            placeholder="Search by name or @username…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        <div style={{ width: 1, height: 20, background: c.border, flexShrink: 0 }} />

        {/* Tier filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 10.5, color: c.textDim, fontWeight: 500, flexShrink: 0 }}>Tier</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {TIERS.map((t) => (
              <button key={t} className="filter-btn" onClick={() => handleTier(t)}
                style={{
                  background: tierFilter === t ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color:      tierFilter === t ? c.text                  : c.textDim,
                  border:     tierFilter === t ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent',
                }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div style={{ width: 1, height: 20, background: c.border, flexShrink: 0 }} />

        {/* KYC filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 10.5, color: c.textDim, fontWeight: 500, flexShrink: 0 }}>KYC</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {KYCS.map((k) => (
              <button key={k} className="filter-btn" onClick={() => handleKyc(k)}
                style={{
                  background: kycFilter === k ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color:      kycFilter === k ? c.text                  : c.textDim,
                  border:     kycFilter === k ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent',
                }}>
                {k}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginLeft: 'auto', fontSize: 11.5, color: c.textDim }}>
          {loading ? 'Loading…' : `${n(total)} result${total !== 1 ? 's' : ''}`}
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
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
          {loading && users.length === 0 ? (
            <div style={{ padding: '60px 22px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: c.textDim }}>Loading users…</div>
            </div>
          ) : users.length === 0 ? (
            <div style={{ padding: '60px 22px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: c.textMid, fontWeight: 500, marginBottom: 6 }}>No users found</div>
              <div style={{ fontSize: 12, color: c.textDim }}>Try adjusting your filters.</div>
            </div>
          ) : (
            users.map((u, i) => {
              const initials = u.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
              const ts = tierStyle(u.tier);
              const ks = kycStyle(u.kycStatus);
              return (
                <Link key={u.id} href={`/admin/users/${u.id}`} className="row-hover"
                  style={{
                    display: 'grid', gridTemplateColumns: COL_GRID,
                    padding: '11px 22px', alignItems: 'center', cursor: 'pointer',
                    borderBottom: i < users.length - 1 ? `1px solid ${c.border}` : 'none',
                    textDecoration: 'none', color: 'inherit',
                  }}
                >
                  {/* User */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                      background: ts.bg, border: `1px solid ${ts.brd}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: ts.color,
                    }}>
                      {initials}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.name}
                      </div>
                      <div style={{ fontSize: 10.5, color: c.textDim }}>{u.username}</div>
                    </div>
                  </div>

                  {/* Tier */}
                  <Pill label={u.tier}      color={ts.color} bg={ts.bg} brd={ts.brd} />

                  {/* KYC */}
                  <Pill label={u.kycStatus} color={ks.color} bg={ks.bg} brd={ks.brd} />

                  {/* Pending Black */}
                  <div>
                    {u.pendingBlackApproval ? (
                      <span style={{
                        fontSize: 10, fontWeight: 600, color: '#e4e4e7',
                        background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                        padding: '2px 9px', borderRadius: 99,
                      }}>
                        Awaiting
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: c.textDim }}>—</span>
                    )}
                  </div>

                  {/* Email */}
                  <div style={{ fontSize: 12, color: c.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.email}
                  </div>

                  {/* Joined */}
                  <div style={{ fontSize: 11.5, color: c.textDim }}>{fmtDate(u.createdAt)}</div>

                  {/* Actions */}
                  <button className="action-btn" onClick={(e) => e.preventDefault()} style={{
                    width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: c.textDim, borderRadius: 6,
                  }}>
                    <IcoMore />
                  </button>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 4px', flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: c.textDim }}>
          {total === 0 ? 'No users' : (
            <>
              Showing <span style={{ color: c.text, fontWeight: 500 }}>{from}–{to}</span> of{' '}
              <span style={{ color: c.text, fontWeight: 500 }}>{n(total)}</span> users
            </>
          )}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="action-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            style={{ minWidth: 30, height: 30, padding: '0 8px', fontSize: 12, color: page <= 1 ? c.textDim : c.textMid, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, border: '1px solid transparent', opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? 'default' : 'pointer' }}>
            <IcoChevLeft />{' '}Prev
          </button>
          {pageButtons().map((label, i) => {
            const isActive   = label === page;
            const isEllipsis = label === '···';
            return (
              <button key={`${label}-${i}`} className="action-btn" disabled={isEllipsis}
                onClick={() => typeof label === 'number' && setPage(label)}
                style={{ minWidth: 30, height: 30, padding: '0 8px', fontSize: 12, fontWeight: isActive ? 700 : 400, color: isActive ? c.text : c.textMid, background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent', border: isActive ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isEllipsis ? 'default' : 'pointer' }}>
                {label}
              </button>
            );
          })}
          <button className="action-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
            style={{ minWidth: 30, height: 30, padding: '0 8px', fontSize: 12, color: page >= totalPages ? c.textDim : c.textMid, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, border: '1px solid transparent', opacity: page >= totalPages ? 0.4 : 1, cursor: page >= totalPages ? 'default' : 'pointer' }}>
            Next{' '}<IcoChevron />
          </button>
        </div>
      </div>

    </div>
  );
}
