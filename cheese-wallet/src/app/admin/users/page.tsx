'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import Link from 'next/link';
import {
  c,
  IcoSearch, IcoMore, IcoPlus, IcoChevDown, IcoChevron, IcoChevLeft,
  IcoArrowDn, IcoArrowUp,
  Pill,
  tierStyle, kycStyle, walletStyle,
} from '../_shared';
import { listAdminUsers, getAdminStats, type AdminUserItem, type AdminStats } from '@/lib/api/admin';

type TierFilter = 'All' | 'Silver' | 'Gold' | 'Black';
type KycFilter  = 'All' | 'Verified' | 'Pending' | 'Reviewing' | 'Failed';
type SortDir    = 'asc' | 'desc';
type SortBy     = 'balance' | 'createdAt';

const LIMIT = 20;

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

// ─── Users page ───────────────────────────────────────────────────────────────
export default function UsersPage() {
  const [search,     setSearch]     = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('All');
  const [kycFilter,  setKycFilter]  = useState<KycFilter>('All');
  const [page,       setPage]       = useState(1);
  const [users,      setUsers]      = useState<AdminUserItem[]>([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [stats,      setStats]      = useState<AdminStats | null>(null);
  const [sortBy,     setSortBy]     = useState<SortBy>('createdAt');
  const [sortDir,    setSortDir]    = useState<SortDir>('desc');

  // Header chips — fetch once
  useEffect(() => {
    getAdminStats().then(setStats).catch(console.error);
  }, []);

  // Users list — debounce search, reset page on filter change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const delay = search ? 350 : 0;
    const timer = setTimeout(async () => {
      try {
        const result = await listAdminUsers({
          page,
          limit: LIMIT,
          search:  search || undefined,
          tier:    tierFilter !== 'All' ? tierFilter : undefined,
          kyc:     kycFilter  !== 'All' ? kycFilter  : undefined,
          sortBy,
          sortDir,
        });
        if (!cancelled) { setUsers(result.users); setTotal(result.total); }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, delay);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [page, search, tierFilter, kycFilter, sortBy, sortDir]);

  // Handlers — reset page on filter change
  const handleSearch = (s: string)      => { setSearch(s);     setPage(1); };
  const handleTier   = (t: TierFilter)  => { setTierFilter(t); setPage(1); };
  const handleKyc    = (k: KycFilter)   => { setKycFilter(k);  setPage(1); };

  const n = (v: number) => v.toLocaleString();
  const totalPages = Math.ceil(total / LIMIT);

  const pageButtons = (): (number | '···')[] => {
    if (totalPages <= 7) return Array.from({ length: Math.max(1, totalPages) }, (_, i) => i + 1);
    if (page <= 4)               return [1, 2, 3, 4, 5, '···', totalPages];
    if (page >= totalPages - 3)  return [1, '···', totalPages-4, totalPages-3, totalPages-2, totalPages-1, totalPages];
    return [1, '···', page-1, page, page+1, '···', totalPages];
  };

  const card: CSSProperties = {
    background: c.surface, border: `1px solid ${c.border}`, borderRadius: 14,
  };

  const TIERS: TierFilter[] = ['All', 'Silver', 'Gold', 'Black'];
  const KYCS:  KycFilter[]  = ['All', 'Verified', 'Pending', 'Reviewing', 'Failed'];

  const COL_GRID = '2fr 90px 100px 110px 1.6fr 110px 70px 110px 36px';

  const toggleSort = (field: SortBy) => {
    if (field === sortBy) {
      setSortDir((d) => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
    setPage(1);
  };

  const from = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to   = Math.min(page * LIMIT, total);

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 700, color: c.text, margin: 0, letterSpacing: '-0.02em' }}>
            Users
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {stats ? [
              { label: `${n(stats.totalUsers)} total`,     color: c.textMid, bg: 'rgba(255,255,255,0.06)', brd: c.border },
              { label: `${n(stats.verifiedUsers)} verified`, color: c.green, bg: c.greenDim, brd: 'rgba(34,197,94,0.2)' },
              { label: `${n(stats.premiumUsers)} premium`,   color: c.amber, bg: c.amberDim, brd: c.amberBrd },
              { label: `${n(stats.flaggedUsers)} flagged`,   color: c.red,   bg: c.redDim,   brd: 'rgba(239,68,68,0.2)' },
              { label: `$${stats.totalBalanceUsdc.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total balance`, color: '#60a5fa', bg: 'rgba(96,165,250,0.08)', brd: 'rgba(96,165,250,0.2)' },
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
        <button className="invite-btn" style={{
          display: 'flex', alignItems: 'center', gap: 7,
          fontSize: 12.5, fontWeight: 600, color: c.amber,
          background: c.amberDim, border: `1px solid ${c.amberBrd}`,
          padding: '7px 16px', borderRadius: 9, cursor: 'pointer',
        }}>
          <IcoPlus /> Invite User
        </button>
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
                  border:     tierFilter === t ? `1px solid rgba(255,255,255,0.15)` : `1px solid transparent`,
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
                  border:     kycFilter === k ? `1px solid rgba(255,255,255,0.15)` : `1px solid transparent`,
                }}>
                {k}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11.5, color: c.textDim }}>
            {loading ? 'Loading…' : `${n(total)} result${total !== 1 ? 's' : ''}`}
          </span>
          <button className="action-btn" style={{ padding: '5px 10px', color: c.textMid, border: `1px solid ${c.border}`, fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 5 }}>
            <IcoChevDown /> Export
          </button>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div style={{ ...card, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

        {/* Column headers */}
        <div style={{
          display: 'grid', gridTemplateColumns: COL_GRID, columnGap: 12,
          padding: '9px 22px', borderBottom: `1px solid ${c.border}`,
          flexShrink: 0,
        }}>
          {(['User', 'Tier', 'KYC', 'Wallet', 'Email'] as const).map((h) => (
            <div key={h} style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: c.textDim }}>
              {h}
            </div>
          ))}
          {/* Joined — sortable */}
          <button onClick={() => toggleSort('createdAt')} style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase',
            color: sortBy === 'createdAt' ? c.amber : c.textDim,
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4, padding: 0,
          }}>
            Joined {sortBy === 'createdAt' ? (sortDir === 'desc' ? <IcoArrowDn /> : <IcoArrowUp />) : null}
          </button>
          {/* Volume */}
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: c.textDim }}>
            Volume
          </div>
          {/* Balance — sortable */}
          <button onClick={() => toggleSort('balance')} style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase',
            color: sortBy === 'balance' ? c.amber : c.textDim,
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4, padding: 0,
          }}>
            Balance (est.) {sortBy === 'balance' ? (sortDir === 'desc' ? <IcoArrowDn /> : <IcoArrowUp />) : null}
          </button>
          <div />
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
              <div style={{ fontSize: 12, color: c.textDim }}>Try adjusting your search or filters.</div>
            </div>
          ) : (
            users.map((u, i) => {
              const initials = u.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
              const ts = tierStyle(u.tier);
              const ks = kycStyle(u.kycStatus);
              const ws = walletStyle(u.walletStatus);
              return (
                <Link key={u.id} href={`/admin/users/${u.id}`} className="row-hover"
                  style={{
                    display: 'grid', gridTemplateColumns: COL_GRID, columnGap: 12,
                    padding: '11px 22px', alignItems: 'center', cursor: 'pointer',
                    borderBottom: i < users.length - 1 ? `1px solid ${c.border}` : 'none',
                    textDecoration: 'none', color: 'inherit',
                  }}
                >
                  {/* User */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                      background: c.amberDim, border: `1px solid ${c.amberBrd}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: c.amber,
                    }}>
                      {initials}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.name}
                        </div>
                        {u.isFlagged && (
                          <span style={{ fontSize: 9, color: c.red, background: c.redDim, border: `1px solid rgba(239,68,68,0.2)`, padding: '1px 5px', borderRadius: 99, fontWeight: 700, flexShrink: 0 }}>
                            Flagged
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 10.5, color: c.textDim }}>{u.username}</div>
                    </div>
                  </div>

                  {/* Tier */}
                  <Pill label={u.tier}        color={ts.color} bg={ts.bg} brd={ts.brd} />

                  {/* KYC */}
                  <Pill label={u.kycStatus}   color={ks.color} bg={ks.bg} brd={ks.brd} />

                  {/* Wallet */}
                  <Pill label={u.walletStatus} color={ws.color} bg={ws.bg} brd={ws.brd} />

                  {/* Email */}
                  <div style={{ fontSize: 12, color: c.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.email}
                  </div>

                  {/* Joined */}
                  <div style={{ fontSize: 11.5, color: c.textDim }}>{fmtDate(u.createdAt)}</div>

                  {/* Volume */}
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: parseFloat(u.txVolume) > 0 ? c.text : c.textDim }}>
                    ${parseFloat(u.txVolume).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>

                  {/* Balance */}
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: parseFloat(u.balanceUsdc) > 0 ? c.text : c.textDim }}>
                    ${parseFloat(u.balanceUsdc).toFixed(2)}
                  </div>

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

      {/* ── Pagination footer ───────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 4px', flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, color: c.textDim }}>
          {total === 0 ? 'No users' : (
            <>
              Showing <span style={{ color: c.text, fontWeight: 500 }}>{from}–{to}</span> of{' '}
              <span style={{ color: c.text, fontWeight: 500 }}>{n(total)}</span> users
            </>
          )}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="action-btn"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            style={{
              minWidth: 30, height: 30, padding: '0 8px',
              fontSize: 12, color: page <= 1 ? c.textDim : c.textMid,
              borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1px solid transparent`, opacity: page <= 1 ? 0.4 : 1,
              cursor: page <= 1 ? 'default' : 'pointer', gap: 4,
            }}
          >
            <IcoChevLeft />{' '}Prev
          </button>
          {pageButtons().map((label, i) => {
            const isActive   = label === page;
            const isEllipsis = label === '···';
            return (
              <button
                key={`${label}-${i}`}
                className="action-btn"
                disabled={isEllipsis}
                onClick={() => typeof label === 'number' && setPage(label)}
                style={{
                  minWidth: 30, height: 30, padding: '0 8px',
                  fontSize: 12, fontWeight: isActive ? 700 : 400,
                  color: isActive ? c.text : c.textMid,
                  background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                  border: isActive ? `1px solid rgba(255,255,255,0.15)` : `1px solid transparent`,
                  borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: isEllipsis ? 'default' : 'pointer',
                }}
              >
                {label}
              </button>
            );
          })}
          <button
            className="action-btn"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            style={{
              minWidth: 30, height: 30, padding: '0 8px',
              fontSize: 12, color: page >= totalPages ? c.textDim : c.textMid,
              borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
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
