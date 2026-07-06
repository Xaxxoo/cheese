'use client';

import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { c, IcoChain, IcoWallet, Pill, IcoCheck, IcoChevron, IcoChevLeft } from '../_shared';
import {
  getAdminHealth,
  getAdminStats,
  getTreasuryBalance,
  listAdminTransactions,
  type AdminHealth,
  type AdminStats,
  type TreasuryBalance,
  type AdminTransactionItem,
} from '@/lib/api/admin';

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtUsdc  = (v: string | number) =>
  parseFloat(String(v)).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate  = (s: string) =>
  new Date(s).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

const TX_LABEL: Record<string, string> = {
  deposit:       'Deposit',
  withdrawal:    'Withdrawal',
  send_username: 'Send',
  send_address:  'Send (Addr)',
  pay_request:   'Pay Link',
};

function txTypeStyle(t: string) {
  if (t === 'deposit')                      return { color: c.green,  bg: c.greenDim, brd: 'rgba(34,197,94,0.2)'  };
  if (t === 'send_username' || t === 'send_address' || t === 'pay_request')
                                            return { color: c.blue,   bg: c.blueDim,  brd: 'rgba(96,165,250,0.2)' };
  return                                           { color: c.amber,  bg: c.amberDim, brd: c.amberBrd             };
}

function statusStyle(s: string) {
  if (s === 'completed') return { color: c.green,   bg: c.greenDim, brd: 'rgba(34,197,94,0.2)'  };
  if (s === 'failed')    return { color: c.red,     bg: c.redDim,   brd: 'rgba(239,68,68,0.2)'  };
  if (s === 'reversed')  return { color: c.textMid, bg: 'rgba(255,255,255,0.05)', brd: 'transparent' };
  return { color: c.amber, bg: c.amberDim, brd: c.amberBrd };
}

const card: CSSProperties = {
  background: c.surface, border: `1px solid ${c.border}`, borderRadius: 14,
};

const ONCHAN_TYPES = ['deposit', 'withdrawal', 'send_username', 'send_address', 'pay_request'];

// ── Network health panel ───────────────────────────────────────────────────
function HealthPanel({
  health, loading, onRefresh,
}: { health: AdminHealth | null; loading: boolean; onRefresh: () => void }) {
  const services = health ? [
    { name: 'Stellar Horizon', ok: health.stellar,  desc: 'On-chain sends, deposits, balances' },
    { name: 'EVM RPC',         ok: health.evm,      desc: 'EVM wallet provisioning'            },
    { name: 'PulseMFB API',    ok: health.pulsemfb, desc: 'NGN bank transfer provider'         },
    { name: 'PostgreSQL',      ok: health.database, desc: 'Primary database'                   },
    { name: 'Redis / BullMQ',  ok: health.redis,    desc: 'Queue and caching layer'            },
  ] : [];

  const degraded = services.filter((s) => !s.ok).length;

  return (
    <div style={{ ...card, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>Network Health</div>
          <div style={{ fontSize: 11, color: c.textDim, marginTop: 2 }}>Live service status</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {health && (
            degraded > 0 ? (
              <span style={{ fontSize: 11, fontWeight: 600, color: c.red, background: c.redDim, border: `1px solid rgba(239,68,68,0.2)`, padding: '3px 10px', borderRadius: 99 }}>
                {degraded} degraded
              </span>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 600, color: c.green, background: c.greenDim, border: `1px solid rgba(34,197,94,0.18)`, padding: '3px 10px', borderRadius: 99 }}>
                All systems live
              </span>
            )
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            style={{
              fontSize: 11.5, color: c.textDim, background: 'transparent',
              border: `1px solid ${c.border}`, borderRadius: 8, padding: '5px 11px',
              cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && !health ? (
          <div style={{ fontSize: 12, color: c.textDim }}>Loading…</div>
        ) : (
          services.map((svc) => (
            <div key={svc.name} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderRadius: 10,
              background: svc.ok ? 'rgba(34,197,94,0.04)' : 'rgba(239,68,68,0.05)',
              border: `1px solid ${svc.ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.15)'}`,
            }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: svc.ok ? c.text : c.red }}>
                  {svc.name}
                </div>
                <div style={{ fontSize: 11, color: c.textDim, marginTop: 2 }}>{svc.desc}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: svc.ok ? c.green : c.red, display: 'inline-block',
                }} />
                <span style={{ fontSize: 11.5, fontWeight: 600, color: svc.ok ? c.green : c.red }}>
                  {svc.ok ? 'Operational' : 'Degraded'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Wallet stats panel ─────────────────────────────────────────────────────
function WalletStats({ stats }: { stats: AdminStats | null }) {
  const stellar = [
    { label: 'Active',   value: stats?.activeWallets  ?? 0, color: c.green },
    { label: 'Pending',  value: stats?.pendingWallets ?? 0, color: c.amber },
    { label: 'Failed',   value: stats?.failedWallets  ?? 0, color: c.red   },
  ];
  const evm = [
    { label: 'Active',   value: stats?.activeEvmWallets  ?? 0, color: c.green },
    { label: 'Pending',  value: stats?.pendingEvmWallets ?? 0, color: c.amber },
    { label: 'Failed',   value: stats?.failedEvmWallets  ?? 0, color: c.red   },
  ];

  return (
    <div style={{ ...card, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>User Wallets</div>

      {/* Stellar */}
      <div>
        <div style={{ fontSize: 11, color: c.textDim, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
          Stellar (USDC)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {stellar.map(({ label, value, color }) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.03)', border: `1px solid ${c.border}`,
              borderRadius: 10, padding: '12px 16px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
                {value.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: c.textDim, marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* EVM */}
      <div>
        <div style={{ fontSize: 11, color: c.textDim, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
          EVM
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {evm.map(({ label, value, color }) => (
            <div key={`evm-${label}`} style={{
              background: 'rgba(255,255,255,0.03)', border: `1px solid ${c.border}`,
              borderRadius: 10, padding: '12px 16px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
                {value.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: c.textDim, marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Treasury card ──────────────────────────────────────────────────────────
function TreasuryCard({
  treasury, loading, onRefresh,
}: { treasury: TreasuryBalance | null; loading: boolean; onRefresh: () => void }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    if (!treasury?.address) return;
    void navigator.clipboard.writeText(treasury.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{ ...card, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>Platform Treasury</div>
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            fontSize: 11.5, color: c.textDim, background: 'transparent',
            border: `1px solid ${c.border}`, borderRadius: 8, padding: '5px 11px',
            cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: c.amberDim, border: `1px solid ${c.amberBrd}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.amber,
        }}>
          <IcoWallet />
        </div>
        <div>
          <div style={{ fontSize: 11, color: c.textDim, marginBottom: 3 }}>Stellar USDC Balance</div>
          {loading && !treasury ? (
            <div style={{ fontSize: 26, fontWeight: 700, color: c.textDim }}>—</div>
          ) : (
            <div style={{ fontSize: 26, fontWeight: 700, color: c.text, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
              ${fmtUsdc(treasury?.balanceUsdc ?? '0')}
              <span style={{ fontSize: 13, color: c.textDim, fontWeight: 400, marginLeft: 6 }}>USDC</span>
            </div>
          )}
        </div>
      </div>

      {treasury?.address && (
        <button
          onClick={copy}
          style={{
            textAlign: 'left', fontSize: 11.5,
            color: copied ? c.green : c.textDim,
            background: copied ? c.greenDim : 'rgba(255,255,255,0.04)',
            border: `1px solid ${copied ? 'rgba(34,197,94,0.2)' : c.border}`,
            borderRadius: 9, padding: '8px 12px', cursor: 'pointer',
            fontFamily: 'monospace', letterSpacing: '0.02em',
            transition: 'all 0.15s', width: '100%',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {copied ? <><IcoCheck />{' '}Copied!</> : treasury.address}
        </button>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
const TX_COLS     = ['User / Reference', 'Type', 'Amount USDC', 'Status', 'Tx Hash', 'Date'];
const TX_COL_GRID = '1.4fr 100px 110px 100px 1.4fr 110px';
const TX_LIMIT    = 15;

export default function BlockchainPage() {
  const [health,    setHealth]    = useState<AdminHealth | null>(null);
  const [hLoading,  setHLoading]  = useState(true);
  const [stats,     setStats]     = useState<AdminStats | null>(null);
  const [treasury,  setTreasury]  = useState<TreasuryBalance | null>(null);
  const [tLoading,  setTLoading]  = useState(true);
  const [txns,      setTxns]      = useState<AdminTransactionItem[]>([]);
  const [txTotal,   setTxTotal]   = useState(0);
  const [txPage,    setTxPage]    = useState(1);
  const [txLoading, setTxLoading] = useState(true);

  const loadHealth = useCallback(async () => {
    setHLoading(true);
    try {
      const [h, s] = await Promise.all([getAdminHealth(), getAdminStats()]);
      setHealth(h);
      setStats(s);
    } catch (e) { console.error(e); }
    finally { setHLoading(false); }
  }, []);

  const loadTreasury = useCallback(async () => {
    setTLoading(true);
    try { setTreasury(await getTreasuryBalance()); }
    catch (e) { console.error(e); }
    finally { setTLoading(false); }
  }, []);

  const loadTxns = useCallback(async (p: number) => {
    setTxLoading(true);
    try {
      const res = await listAdminTransactions({ page: p, limit: TX_LIMIT });
      setTxns(res.transactions.filter((t) => ONCHAN_TYPES.includes(t.type)));
      setTxTotal(res.total);
    } catch (e) { console.error(e); }
    finally { setTxLoading(false); }
  }, []);

  useEffect(() => { void loadHealth();       }, [loadHealth]);
  useEffect(() => { void loadTreasury();     }, [loadTreasury]);
  useEffect(() => { void loadTxns(txPage);   }, [loadTxns, txPage]);

  const totalPages = Math.ceil(txTotal / TX_LIMIT);

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div>
        <h1 style={{ fontSize: 21, fontWeight: 700, color: c.text, margin: 0, letterSpacing: '-0.02em' }}>
          Blockchain
        </h1>
        <div style={{ fontSize: 12, color: c.textDim, marginTop: 4 }}>
          Network health, platform wallet, user wallet status, and on-chain activity
        </div>
      </div>

      {/* ── Top row: treasury + health ─────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, alignItems: 'start' }}>
        <TreasuryCard treasury={treasury} loading={tLoading} onRefresh={loadTreasury} />
        <HealthPanel  health={health}     loading={hLoading} onRefresh={loadHealth}   />
      </div>

      {/* ── Wallet stats ───────────────────────────────────────────────── */}
      <WalletStats stats={stats} />

      {/* ── Recent on-chain transactions ───────────────────────────────── */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 12 }}>
          Recent On-chain Activity
          <span style={{ fontSize: 11, color: c.textDim, fontWeight: 400, marginLeft: 8 }}>
            deposits · sends · pay links · withdrawals
          </span>
        </div>

        <div style={{ ...card, overflow: 'hidden' }}>
          {/* Headers */}
          <div style={{ display: 'grid', gridTemplateColumns: TX_COL_GRID, padding: '9px 22px', borderBottom: `1px solid ${c.border}` }}>
            {TX_COLS.map((h) => (
              <div key={h} style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: c.textDim }}>
                {h}
              </div>
            ))}
          </div>

          {/* Rows */}
          {txLoading && txns.length === 0 ? (
            <div style={{ padding: '40px 22px', textAlign: 'center', fontSize: 13, color: c.textDim }}>Loading…</div>
          ) : txns.length === 0 ? (
            <div style={{ padding: '40px 22px', textAlign: 'center', fontSize: 13, color: c.textDim }}>No on-chain transactions yet.</div>
          ) : (
            txns.map((t, i) => {
              const ss = statusStyle(t.status);
              const ts = txTypeStyle(t.type);
              return (
                <div
                  key={t.id}
                  className="row-hover"
                  style={{
                    display: 'grid', gridTemplateColumns: TX_COL_GRID,
                    padding: '11px 22px', alignItems: 'center',
                    borderBottom: i < txns.length - 1 ? `1px solid ${c.border}` : 'none',
                  }}
                >
                  {/* User / Ref */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: c.text }}>@{t.username}</div>
                    <div style={{ fontSize: 10.5, color: c.textDim, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.reference}
                    </div>
                  </div>

                  {/* Type */}
                  <Pill label={TX_LABEL[t.type] ?? t.type} color={ts.color} bg={ts.bg} brd={ts.brd} />

                  {/* Amount */}
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: c.text, fontVariantNumeric: 'tabular-nums' }}>
                    ${fmtUsdc(t.amountUsdc)}
                  </div>

                  {/* Status */}
                  <Pill
                    label={t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                    color={ss.color} bg={ss.bg} brd={ss.brd}
                  />

                  {/* Tx Hash */}
                  <div style={{
                    fontSize: 11, color: c.textDim, fontFamily: 'monospace',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    paddingRight: 8,
                  }}>
                    {t.txHash ? `${t.txHash.slice(0, 12)}…${t.txHash.slice(-8)}` : '—'}
                  </div>

                  {/* Date */}
                  <div style={{ fontSize: 11.5, color: c.textDim }}>{fmtDate(t.createdAt)}</div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '10px 4px', gap: 6 }}>
          <button
            className="action-btn"
            disabled={txPage <= 1}
            onClick={() => setTxPage((p) => p - 1)}
            style={{
              minWidth: 30, height: 30, padding: '0 8px', fontSize: 12,
              color: txPage <= 1 ? c.textDim : c.textMid, borderRadius: 7,
              border: '1px solid transparent', opacity: txPage <= 1 ? 0.4 : 1,
              cursor: txPage <= 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <IcoChevLeft />{' '}Prev
          </button>
          <button
            className="action-btn"
            disabled={txPage >= totalPages}
            onClick={() => setTxPage((p) => p + 1)}
            style={{
              minWidth: 30, height: 30, padding: '0 8px', fontSize: 12,
              color: txPage >= totalPages ? c.textDim : c.textMid, borderRadius: 7,
              border: '1px solid transparent', opacity: txPage >= totalPages ? 0.4 : 1,
              cursor: txPage >= totalPages ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            Next{' '}<IcoChevron />
          </button>
        </div>
      </div>

    </div>
  );
}
