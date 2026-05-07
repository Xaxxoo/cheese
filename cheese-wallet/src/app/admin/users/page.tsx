'use client';

import { useState, type CSSProperties } from 'react';
import {
  c,
  IcoSearch, IcoMore, IcoPlus, IcoChevDown,
  Pill,
  tierStyle, kycStyle, walletStyle,
} from '../_shared';

// ─── Mock data ────────────────────────────────────────────────────────────────
const USERS = [
  { name: 'Chiamaka Obi',      username: '@chiamaka22',   tier: 'Gold',   kyc: 'Verified',  wallet: 'Active',   balance: '$1,204.50',  txns: 43,  joined: 'Apr 22, 2026' },
  { name: 'Emeka Nwachukwu',   username: '@emeka_fx',     tier: 'Silver', kyc: 'Pending',   wallet: 'Active',   balance: '$88.00',     txns: 5,   joined: 'Apr 22, 2026' },
  { name: 'Adaeze Nwosu',      username: '@adaeze',       tier: 'Black',  kyc: 'Reviewing', wallet: 'Active',   balance: '$4,780.00',  txns: 127, joined: 'Apr 22, 2026' },
  { name: 'Babatunde Fola',    username: '@babatunde',    tier: 'Silver', kyc: 'Verified',  wallet: 'Active',   balance: '$342.10',    txns: 18,  joined: 'Apr 22, 2026' },
  { name: 'Ngozi Kalu',        username: '@ngozi_k',      tier: 'Gold',   kyc: 'Verified',  wallet: 'Active',   balance: '$2,100.00',  txns: 76,  joined: 'Apr 21, 2026' },
  { name: 'Tunde Adeyemi',     username: '@tunde_pays',   tier: 'Silver', kyc: 'Verified',  wallet: 'Pending',  balance: '$0.00',      txns: 0,   joined: 'Apr 21, 2026' },
  { name: 'Kemi Adesanya',     username: '@kemi_a',       tier: 'Gold',   kyc: 'Verified',  wallet: 'Active',   balance: '$892.75',    txns: 55,  joined: 'Apr 20, 2026' },
  { name: 'Chukwuemeka Eze',   username: '@chukwu_e',     tier: 'Black',  kyc: 'Verified',  wallet: 'Active',   balance: '$12,440.00', txns: 312, joined: 'Apr 20, 2026' },
  { name: 'Fatima Abubakar',   username: '@fatima_fx',    tier: 'Silver', kyc: 'Failed',    wallet: 'Inactive', balance: '$0.00',      txns: 0,   joined: 'Apr 19, 2026' },
  { name: 'Olumide Bakare',    username: '@olumide_b',    tier: 'Silver', kyc: 'Verified',  wallet: 'Active',   balance: '$514.20',    txns: 29,  joined: 'Apr 19, 2026' },
  { name: 'Amina Sule',        username: '@amina_s',      tier: 'Gold',   kyc: 'Verified',  wallet: 'Active',   balance: '$3,210.00',  txns: 88,  joined: 'Apr 18, 2026' },
  { name: 'Obinna Okafor',     username: '@obinna_ok',    tier: 'Silver', kyc: 'Reviewing', wallet: 'Pending',  balance: '$0.00',      txns: 2,   joined: 'Apr 17, 2026' },
  { name: 'Yewande Adeleke',   username: '@yewande',      tier: 'Black',  kyc: 'Verified',  wallet: 'Active',   balance: '$8,900.00',  txns: 204, joined: 'Apr 16, 2026' },
  { name: 'Ibrahim Musa',      username: '@ibrahim_m',    tier: 'Silver', kyc: 'Pending',   wallet: 'Pending',  balance: '$0.00',      txns: 0,   joined: 'Apr 15, 2026' },
  { name: 'Chidinma Okonkwo',  username: '@chidinma_ok',  tier: 'Gold',   kyc: 'Verified',  wallet: 'Active',   balance: '$1,750.30',  txns: 62,  joined: 'Apr 14, 2026' },
  { name: 'Segun Ogunyemi',    username: '@segun_pays',   tier: 'Silver', kyc: 'Verified',  wallet: 'Active',   balance: '$287.00',    txns: 14,  joined: 'Apr 13, 2026' },
  { name: 'Nkechi Obi',        username: '@nkechi_o',     tier: 'Silver', kyc: 'Verified',  wallet: 'Active',   balance: '$620.00',    txns: 31,  joined: 'Apr 12, 2026' },
  { name: 'Aisha Mohammed',    username: '@aisha_m',      tier: 'Gold',   kyc: 'Verified',  wallet: 'Active',   balance: '$4,100.00',  txns: 95,  joined: 'Apr 10, 2026' },
  { name: 'Uche Obi',          username: '@uche_ob',      tier: 'Silver', kyc: 'Failed',    wallet: 'Inactive', balance: '$0.00',      txns: 3,   joined: 'Apr 8, 2026'  },
  { name: 'Folake Adekunle',   username: '@folake_a',     tier: 'Black',  kyc: 'Verified',  wallet: 'Active',   balance: '$21,300.00', txns: 441, joined: 'Apr 5, 2026'  },
];

const TOTAL = 12481;

// ─── Users page ───────────────────────────────────────────────────────────────
export default function UsersPage() {
  const [search,     setSearch]     = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('All');
  const [kycFilter,  setKycFilter]  = useState<KycFilter>('All');

  const filtered = USERS.filter((u) => {
    if (search) {
      const q = search.toLowerCase();
      if (!u.name.toLowerCase().includes(q) && !u.username.toLowerCase().includes(q)) return false;
    }
    if (tierFilter !== 'All' && u.tier !== tierFilter) return false;
    if (kycFilter  !== 'All' && u.kyc  !== kycFilter)  return false;
    return true;
  });

  const card: CSSProperties = {
    background: c.surface, border: `1px solid ${c.border}`, borderRadius: 14,
  };

  const TIERS:  TierFilter[] = ['All', 'Silver', 'Gold', 'Black'];
  const KYCS:   KycFilter[]  = ['All', 'Verified', 'Pending', 'Reviewing', 'Failed'];

  const COLS = ['User', 'Tier', 'KYC', 'Wallet', 'Balance', 'Txns', 'Joined', ''];
  const COL_GRID = '2.4fr 80px 90px 90px 90px 60px 100px 36px';

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 700, color: c.text, margin: 0, letterSpacing: '-0.02em' }}>
            Users
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {[
              { label: '12,481 total',    color: c.textMid, bg: 'rgba(255,255,255,0.06)', brd: c.border },
              { label: '9,860 verified',  color: c.green,   bg: c.greenDim,               brd: 'rgba(34,197,94,0.2)' },
              { label: '4,868 premium',   color: c.amber,   bg: c.amberDim,               brd: c.amberBrd },
              { label: '34 flagged',      color: c.red,     bg: c.redDim,                 brd: 'rgba(239,68,68,0.2)' },
            ].map((chip) => (
              <span key={chip.label} style={{
                fontSize: 11, fontWeight: 600, color: chip.color,
                background: chip.bg, border: `1px solid ${chip.brd}`,
                padding: '3px 10px', borderRadius: 99,
              }}>
                {chip.label}
              </span>
            ))}
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
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ width: 1, height: 20, background: c.border, flexShrink: 0 }} />

        {/* Tier filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 10.5, color: c.textDim, fontWeight: 500, flexShrink: 0 }}>Tier</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {TIERS.map((t) => (
              <button key={t} className="filter-btn" onClick={() => setTierFilter(t)}
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
              <button key={k} className="filter-btn" onClick={() => setKycFilter(k)}
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
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
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
          display: 'grid', gridTemplateColumns: COL_GRID,
          padding: '9px 22px', borderBottom: `1px solid ${c.border}`,
          flexShrink: 0,
        }}>
          {COLS.map((h) => (
            <div key={h} style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: c.textDim }}>
              {h}
            </div>
          ))}
        </div>

        {/* Rows */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '60px 22px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: c.textMid, fontWeight: 500, marginBottom: 6 }}>No users found</div>
              <div style={{ fontSize: 12, color: c.textDim }}>Try adjusting your search or filters.</div>
            </div>
          ) : (
            filtered.map((u, i) => {
              const initials = u.name.split(' ').map((n) => n[0]).join('').slice(0, 2);
              const ts = tierStyle(u.tier);
              const ks = kycStyle(u.kyc);
              const ws = walletStyle(u.wallet);
              return (
                <div key={i} className="row-hover"
                  style={{
                    display: 'grid', gridTemplateColumns: COL_GRID,
                    padding: '11px 22px', alignItems: 'center', cursor: 'default',
                    borderBottom: i < filtered.length - 1 ? `1px solid ${c.border}` : 'none',
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
                      <div style={{ fontSize: 13, fontWeight: 500, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.name}
                      </div>
                      <div style={{ fontSize: 10.5, color: c.textDim }}>{u.username}</div>
                    </div>
                  </div>

                  {/* Tier */}
                  <Pill label={u.tier}   color={ts.color} bg={ts.bg} brd={ts.brd} />

                  {/* KYC */}
                  <Pill label={u.kyc}    color={ks.color} bg={ks.bg} brd={ks.brd} />

                  {/* Wallet */}
                  <Pill label={u.wallet} color={ws.color} bg={ws.bg} brd={ws.brd} />

                  {/* Balance */}
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: u.balance === '$0.00' ? c.textDim : c.text, fontVariantNumeric: 'tabular-nums' }}>
                    {u.balance}
                  </div>

                  {/* Txns */}
                  <div style={{ fontSize: 12.5, color: u.txns === 0 ? c.textDim : c.text, fontVariantNumeric: 'tabular-nums' }}>
                    {u.txns}
                  </div>

                  {/* Joined */}
                  <div style={{ fontSize: 11.5, color: c.textDim }}>{u.joined}</div>

                  {/* Actions */}
                  <button className="action-btn" style={{
                    width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: c.textDim, borderRadius: 6,
                  }}>
                    <IcoMore />
                  </button>
                </div>
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
          Showing <span style={{ color: c.text, fontWeight: 500 }}>1–20</span> of{' '}
          <span style={{ color: c.text, fontWeight: 500 }}>{TOTAL.toLocaleString()}</span> users
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {['← Prev', '1', '2', '3', '···', '625', 'Next →'].map((label, i) => {
            const isActive = label === '1';
            const isDisabled = label === '← Prev';
            return (
              <button key={i} className="action-btn"
                style={{
                  minWidth: 30, height: 30, padding: '0 8px',
                  fontSize: 12, fontWeight: isActive ? 700 : 400,
                  color: isActive ? c.text : isDisabled ? c.textDim : c.textMid,
                  background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                  border: isActive ? `1px solid rgba(255,255,255,0.15)` : `1px solid transparent`,
                  borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: isDisabled ? 0.4 : 1, cursor: isDisabled ? 'default' : 'pointer',
                }}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
