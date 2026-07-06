'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { c, IcoWallet, IcoChain, IcoSearch, Pill, IcoChevron, IcoChevLeft } from '../_shared';
import {
  getAdminStats,
  listAdminUsers,
  type AdminStats,
  type AdminUserItem,
} from '@/lib/api/admin';

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

function walletStyle(s: string) {
  const l = s.toLowerCase();
  if (l === 'active')  return { color: c.green,   bg: c.greenDim, brd: 'rgba(34,197,94,0.2)'  };
  if (l === 'pending') return { color: c.amber,   bg: c.amberDim, brd: c.amberBrd              };
  if (l === 'failed')  return { color: c.red,     bg: c.redDim,   brd: 'rgba(239,68,68,0.2)'  };
  return                      { color: c.textMid, bg: 'rgba(255,255,255,0.05)', brd: 'transparent' };
}

const COLS     = ['User', 'Stellar Wallet', 'EVM Wallet', 'Joined'];
const COL_GRID = '1.8fr 130px 130px 120px';
const LIMIT    = 25;

type WalletFilter = 'all' | 'active' | 'pending' | 'failed';

// ── KPI stat card ──────────────────────────────────────────────────────────
function StatCard({
  label, active, pending, failed, icon, color,
}: {
  label: string; active: number; pending: number; failed: number;
  icon: React.ReactNode; color: string;
}) {
  const card = {
    background: c.surface, border: `1px solid ${c.border}`,
    borderRadius: 14, padding: '18px 22px',
    display: 'flex', flexDirection: 'column' as const, gap: 14,
  };

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: color === 'amber' ? c.amberDim : c.blueDim,
          border: `1px solid ${color === 'amber' ? c.amberBrd : 'rgba(96,165,250,0.22)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: color === 'amber' ? c.amber : c.blue,
        }}>
          {icon}
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: c.text }}>{label}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[
          { label: 'Active',  value: active,  col: c.green },
          { label: 'Pending', value: pending, col: c.amber },
          { label: 'Failed',  value: failed,  col: c.red   },
        ].map(({ label: l, value, col }) => (
          <div key={l} style={{
            background: 'rgba(255,255,255,0.03)', border: `1px solid ${c.border}`,
            borderRadius: 9, padding: '10px 12px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: col, fontVariantNumeric: 'tabular-nums' }}>
              {value.toLocaleString()}
            </div>
            <div style={{ fontSize: 10, color: c.textDim, marginTop: 3 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function WalletsPage() {
  const [stats,    setStats]    = useState<AdminStats | null>(null);
  const [users,    setUsers]    = useState<AdminUserItem[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState<WalletFilter>('all');

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadStats = useCallback(async () => {
    try { setStats(await getAdminStats()); } catch { /* non-fatal */ }
  }, []);

  const loadUsers = useCallback(async (p: number, q: string, wf: WalletFilter) => {
    setLoading(true);
    try {
      const res = await listAdminUsers({
        page:   p,
        limit:  LIMIT,
        search: q || undefined,
        wallet: wf === 'all' ? undefined : wf,
      });
      setUsers(res.users);
      setTotal(res.total);
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadStats(); }, [loadStats]);
  useEffect(() => { void loadUsers(page, search, filter); }, [loadUsers, page, filter]);  // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearch(val: string) {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      void loadUsers(1, val, filter);
    }, 320);
  }

  function handleFilter(wf: WalletFilter) {
    setFilter(wf);
    setPage(1);
  }

  const totalPages = Math.ceil(total / LIMIT);
  const from       = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to         = Math.min(page * LIMIT, total);

  const card = { background: c.surface, border: `1px solid ${c.border}`, borderRadius: 14 };

  const TABS: { key: WalletFilter; label: string }[] = [
    { key: 'all',     label: 'All'     },
    { key: 'active',  label: 'Active'  },
    { key: 'pending', label: 'Pending' },
    { key: 'failed',  label: 'Failed'  },
  ];

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 21, fontWeight: 700, color: c.text, margin: 0, letterSpacing: '-0.02em' }}>
          Wallets
        </h1>
        <div style={{ fontSize: 12, color: c.textDim, marginTop: 4 }}>
          User Stellar and EVM wallet status across the platform
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <StatCard
          label="Stellar Wallets (USDC)"
          active={stats?.activeWallets ?? 0}
          pending={stats?.pendingWallets ?? 0}
          failed={stats?.failedWallets ?? 0}
          icon={<IcoWallet />}
          color="amber"
        />
        <StatCard
          label="EVM Wallets"
          active={stats?.activeEvmWallets ?? 0}
          pending={stats?.pendingEvmWallets ?? 0}
          failed={stats?.failedEvmWallets ?? 0}
          icon={<IcoChain />}
          color="blue"
        />
      </div>

      {/* Table */}
      <div>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>

          {/* Status tabs */}
          <div style={{ display: 'flex', gap: 4 }}>
            {TABS.map(({ key, label }) => {
              const active = filter === key;
              return (
                <button
                  key={key}
                  className="tab-btn"
                  onClick={() => handleFilter(key)}
                  style={{
                    background: active ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
                    color:      active ? c.amber                  : c.textDim,
                    border:     `1px solid ${active ? c.amberBrd : c.border}`,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <span style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: c.textDim, display: 'flex', pointerEvents: 'none',
            }}>
              <IcoSearch />
            </span>
            <input
              className="user-search-input"
              style={{ paddingLeft: 32, width: 220 }}
              placeholder="Search user or email…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>

        <div style={{ ...card, overflow: 'hidden' }}>
          {/* Col headers */}
          <div style={{ display: 'grid', gridTemplateColumns: COL_GRID, padding: '9px 22px', borderBottom: `1px solid ${c.border}` }}>
            {COLS.map((h) => (
              <div key={h} style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: c.textDim }}>
                {h}
              </div>
            ))}
          </div>

          {/* Rows */}
          {loading && users.length === 0 ? (
            <div style={{ padding: '50px 22px', textAlign: 'center', fontSize: 13, color: c.textDim }}>Loading…</div>
          ) : users.length === 0 ? (
            <div style={{ padding: '50px 22px', textAlign: 'center', fontSize: 13, color: c.textDim }}>No wallets found.</div>
          ) : (
            users.map((u, i) => {
              const ws = walletStyle(u.walletStatus);
              return (
                <Link
                  key={u.id}
                  href={`/admin/users/${u.id}`}
                  className="row-hover"
                  style={{
                    display: 'grid', gridTemplateColumns: COL_GRID,
                    padding: '11px 22px', alignItems: 'center',
                    borderBottom: i < users.length - 1 ? `1px solid ${c.border}` : 'none',
                    textDecoration: 'none',
                  }}
                >
                  {/* User */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: c.text }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: c.textDim, marginTop: 1 }}>{u.username}</div>
                  </div>

                  {/* Stellar status */}
                  <Pill
                    label={u.walletStatus}
                    color={ws.color} bg={ws.bg} brd={ws.brd}
                  />

                  {/* EVM — not returned by list endpoint; show dash */}
                  <div style={{ fontSize: 11.5, color: c.textDim }}>—</div>

                  {/* Joined */}
                  <div style={{ fontSize: 11.5, color: c.textDim }}>{fmtDate(u.createdAt)}</div>
                </Link>
              );
            })
          )}
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 4px' }}>
          <span style={{ fontSize: 12, color: c.textDim }}>
            {total === 0 ? 'No users' : (
              <>Showing <b style={{ color: c.text }}>{from}–{to}</b> of <b style={{ color: c.text }}>{total.toLocaleString()}</b></>
            )}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="action-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              style={{ minWidth: 30, height: 30, padding: '0 10px', fontSize: 12, color: c.textMid, borderRadius: 7, border: '1px solid transparent', opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <IcoChevLeft />{' '}Prev
            </button>
            <button
              className="action-btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              style={{ minWidth: 30, height: 30, padding: '0 10px', fontSize: 12, color: c.textMid, borderRadius: 7, border: '1px solid transparent', opacity: page >= totalPages ? 0.4 : 1, cursor: page >= totalPages ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              Next{' '}<IcoChevron />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
