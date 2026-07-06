'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { c, IcoAlert, IcoSearch, IcoUsers, Pill, kycStyle, walletStyle, IcoChevron, IcoChevLeft } from '../_shared';
import {
  getAdminStats,
  listAdminUsers,
  flagAdminUser,
  type AdminStats,
  type AdminUserItem,
} from '@/lib/api/admin';

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

const COLS     = ['User', 'KYC', 'Wallet', 'Joined', 'Action'];
const COL_GRID = '1.8fr 120px 120px 120px 100px';
const LIMIT    = 25;

// ── Stat banner ────────────────────────────────────────────────────────────
function StatBanner({ stats }: { stats: AdminStats | null }) {
  const items = [
    {
      label: 'Flagged accounts',
      value: stats?.flaggedUsers ?? 0,
      color: c.red,
      bg:    c.redDim,
      brd:   'rgba(239,68,68,0.2)',
      icon:  <IcoAlert />,
    },
    {
      label: 'Failed bank transfers today',
      value: stats?.failedBankTransfersToday ?? 0,
      color: c.amber,
      bg:    c.amberDim,
      brd:   c.amberBrd,
      icon:  <IcoUsers />,
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
      {items.map(({ label, value, color, bg, brd, icon }) => (
        <div
          key={label}
          style={{
            background: bg,
            border: `1px solid ${brd}`,
            borderRadius: 14, padding: '18px 22px',
            display: 'flex', alignItems: 'center', gap: 16,
          }}
        >
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: 'rgba(0,0,0,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color,
          }}>
            {icon}
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
              {value.toLocaleString()}
            </div>
            <div style={{ fontSize: 11.5, color, opacity: 0.75, marginTop: 2 }}>{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Row with inline unflag ─────────────────────────────────────────────────
function FlaggedRow({
  user,
  last,
  onUnflagged,
}: {
  user: AdminUserItem;
  last: boolean;
  onUnflagged: (id: string) => void;
}) {
  const [saving, setSaving] = useState(false);

  async function handleUnflag(e: React.MouseEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await flagAdminUser(user.id, false);
      onUnflagged(user.id);
    } catch { /* non-fatal */ }
    finally { setSaving(false); }
  }

  const ks = kycStyle(user.kycStatus);
  const ws = walletStyle(user.walletStatus);

  return (
    <div
      style={{
        display: 'grid', gridTemplateColumns: COL_GRID,
        padding: '11px 22px', alignItems: 'center',
        borderBottom: last ? 'none' : `1px solid ${c.border}`,
      }}
    >
      {/* User */}
      <Link
        href={`/admin/users/${user.id}`}
        style={{ textDecoration: 'none', minWidth: 0 }}
      >
        <div style={{ fontSize: 12.5, fontWeight: 500, color: c.text }}>{user.name}</div>
        <div style={{ fontSize: 11, color: c.textDim, marginTop: 1 }}>{user.username}</div>
      </Link>

      {/* KYC */}
      <Pill label={user.kycStatus} color={ks.color} bg={ks.bg} brd={ks.brd} />

      {/* Wallet */}
      <Pill label={user.walletStatus} color={ws.color} bg={ws.bg} brd={ws.brd} />

      {/* Joined */}
      <div style={{ fontSize: 11.5, color: c.textDim }}>{fmtDate(user.createdAt)}</div>

      {/* Unflag */}
      <button
        onClick={handleUnflag}
        disabled={saving}
        className="action-btn"
        style={{
          fontSize: 11.5, fontWeight: 500,
          color: saving ? c.textDim : c.green,
          background: saving ? 'transparent' : c.greenDim,
          border: `1px solid ${saving ? 'transparent' : 'rgba(34,197,94,0.2)'}`,
          borderRadius: 7, padding: '5px 11px',
          opacity: saving ? 0.5 : 1,
        }}
      >
        {saving ? 'Saving…' : 'Unflag'}
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function FraudPage() {
  const [stats,   setStats]   = useState<AdminStats | null>(null);
  const [users,   setUsers]   = useState<AdminUserItem[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadStats = useCallback(async () => {
    try { setStats(await getAdminStats()); } catch { /* non-fatal */ }
  }, []);

  const loadUsers = useCallback(async (p: number, q: string) => {
    setLoading(true);
    try {
      const res = await listAdminUsers({
        page:    p,
        limit:   LIMIT,
        search:  q || undefined,
        flagged: true,
      });
      setUsers(res.users);
      setTotal(res.total);
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadStats(); }, [loadStats]);
  useEffect(() => { void loadUsers(page, search); }, [loadUsers, page]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearch(val: string) {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      void loadUsers(1, val);
    }, 320);
  }

  function handleUnflagged(id: string) {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    setTotal((t) => Math.max(0, t - 1));
    setStats((s) => s ? { ...s, flaggedUsers: Math.max(0, s.flaggedUsers - 1) } : s);
  }

  const totalPages = Math.ceil(total / LIMIT);
  const from       = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to         = Math.min(page * LIMIT, total);

  const card = { background: c.surface, border: `1px solid ${c.border}`, borderRadius: 14 };

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 21, fontWeight: 700, color: c.text, margin: 0, letterSpacing: '-0.02em' }}>
          Fraud & Trust
        </h1>
        <div style={{ fontSize: 12, color: c.textDim, marginTop: 4 }}>
          Flagged accounts and risk signals — review and clear flags inline
        </div>
      </div>

      {/* Stats */}
      <StatBanner stats={stats} />

      {/* Flagged users table */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>
            Flagged Accounts
            {total > 0 && (
              <span style={{
                marginLeft: 8, fontSize: 11, fontWeight: 600,
                color: c.red, background: c.redDim,
                border: '1px solid rgba(239,68,68,0.2)',
                padding: '2px 8px', borderRadius: 99,
              }}>
                {total.toLocaleString()}
              </span>
            )}
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: c.textDim, display: 'flex', pointerEvents: 'none',
            }}>
              <IcoSearch />
            </span>
            <input
              className="user-search-input"
              style={{ paddingLeft: 32, width: 220 }}
              placeholder="Search flagged users…"
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

          {loading && users.length === 0 ? (
            <div style={{ padding: '50px 22px', textAlign: 'center', fontSize: 13, color: c.textDim }}>Loading…</div>
          ) : users.length === 0 ? (
            <div style={{ padding: '50px 22px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: c.green, fontWeight: 500 }}>No flagged accounts</div>
              <div style={{ fontSize: 11.5, color: c.textDim, marginTop: 4 }}>All clear — no users are currently flagged.</div>
            </div>
          ) : (
            users.map((u, i) => (
              <FlaggedRow
                key={u.id}
                user={u}
                last={i === users.length - 1}
                onUnflagged={handleUnflagged}
              />
            ))
          )}
        </div>

        {/* Pagination */}
        {total > LIMIT && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 4px' }}>
            <span style={{ fontSize: 12, color: c.textDim }}>
              Showing <b style={{ color: c.text }}>{from}–{to}</b> of <b style={{ color: c.text }}>{total.toLocaleString()}</b>
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
        )}
      </div>

    </div>
  );
}
