'use client';

import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { c, IcoSend, IcoWallet, IcoChain, Pill } from '../_shared';
import {
  getTreasuryBalance,
  treasuryTransfer,
  evmTreasuryWithdraw,
  listAdminTransfers,
  type TreasuryBalance,
  type EvmVaultBalance,
  type AdminTransferItem,
} from '@/lib/api/admin';
import { useAdminAuthStore } from '@/store/adminAuthStore';

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt   = (v: string) => parseFloat(v).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
const fmtUsd= (v: string) => parseFloat(v).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate= (s: string) => new Date(s).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

function statusStyle(s: string) {
  if (s === 'completed')  return { color: c.green,   bg: c.greenDim, brd: 'rgba(34,197,94,0.2)'  };
  if (s === 'failed')     return { color: c.red,     bg: c.redDim,   brd: 'rgba(239,68,68,0.2)'  };
  if (s === 'processing') return { color: c.blue,    bg: c.blueDim,  brd: 'rgba(96,165,250,0.2)' };
  return { color: c.amber, bg: c.amberDim, brd: c.amberBrd };
}

const COLS     = ['User / Reference', 'Bank & Account', 'NGN', 'USDC Collected', 'Status', 'Date'];
const COL_GRID = '1.6fr 1.8fr 120px 130px 110px 110px';
const LIMIT    = 20;

// ── Balance card ──────────────────────────────────────────────────────────
function BalanceCard({
  treasury,
  loading,
  onRefresh,
}: {
  treasury:  TreasuryBalance | null;
  loading:   boolean;
  onRefresh: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function copyAddress() {
    if (!treasury?.address) return;
    void navigator.clipboard.writeText(treasury.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const card: CSSProperties = {
    background: c.surface,
    border: `1px solid ${c.border}`,
    borderRadius: 14,
    padding: '22px 26px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
  };

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: c.amberDim, border: `1px solid ${c.amberBrd}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: c.amber, flexShrink: 0,
        }}>
          <IcoWallet />
        </div>
        <div>
          <div style={{ fontSize: 11, color: c.textDim, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>
            Platform Treasury
          </div>
          {loading && !treasury ? (
            <div style={{ fontSize: 26, fontWeight: 700, color: c.textDim, letterSpacing: '-0.02em' }}>—</div>
          ) : (
            <div style={{ fontSize: 26, fontWeight: 700, color: c.text, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
              ${fmtUsd(treasury?.balanceUsdc ?? '0')}
              <span style={{ fontSize: 13, color: c.textDim, fontWeight: 500, marginLeft: 6 }}>USDC</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {treasury?.address && (
          <button
            onClick={copyAddress}
            style={{
              fontSize: 11.5, color: copied ? c.green : c.textDim,
              background: copied ? c.greenDim : 'rgba(255,255,255,0.05)',
              border: `1px solid ${copied ? 'rgba(34,197,94,0.2)' : c.border}`,
              borderRadius: 8, padding: '6px 12px', cursor: 'pointer', transition: 'all 0.15s',
              fontFamily: 'monospace',
            }}
          >
            {copied ? 'Copied!' : `${treasury.address.slice(0, 8)}…${treasury.address.slice(-6)}`}
          </button>
        )}
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            fontSize: 11.5, color: c.textDim, background: 'transparent',
            border: `1px solid ${c.border}`, borderRadius: 8, padding: '6px 12px',
            cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
    </div>
  );
}

// ── EVM Vault card ────────────────────────────────────────────────────────
function EvmVaultCard({
  vault,
  loading,
  onRefresh,
}: {
  vault:     EvmVaultBalance | null | undefined;
  loading:   boolean;
  onRefresh: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function copyAddress() {
    if (!vault?.vaultAddress) return;
    void navigator.clipboard.writeText(vault.vaultAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const card: CSSProperties = {
    background: c.surface,
    border: `1px solid ${c.border}`,
    borderRadius: 14,
    padding: '22px 26px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  };

  if (!vault && !loading) {
    return (
      <div style={{ ...card, justifyContent: 'center', minHeight: 80 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: c.blueDim, border: `1px solid rgba(96,165,250,0.22)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: c.blue, flexShrink: 0,
          }}>
            <IcoChain />
          </div>
          <div>
            <div style={{ fontSize: 11, color: c.textDim, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>
              EVM Vault · Polygon Amoy
            </div>
            <div style={{ fontSize: 14, color: c.textDim }}>Not configured</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: c.blueDim, border: `1px solid rgba(96,165,250,0.22)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: c.blue, flexShrink: 0,
          }}>
            <IcoChain />
          </div>
          <div>
            <div style={{ fontSize: 11, color: c.textDim, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>
              EVM Vault · Polygon Amoy
            </div>
            {loading && !vault ? (
              <div style={{ fontSize: 26, fontWeight: 700, color: c.textDim, letterSpacing: '-0.02em' }}>—</div>
            ) : (
              <div style={{ fontSize: 26, fontWeight: 700, color: c.text, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                ${fmtUsd(vault?.total ?? '0')}
                <span style={{ fontSize: 13, color: c.textDim, fontWeight: 500, marginLeft: 6 }}>USDC</span>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {vault?.vaultAddress && (
            <button
              onClick={copyAddress}
              style={{
                fontSize: 11.5, color: copied ? c.green : c.textDim,
                background: copied ? c.greenDim : 'rgba(255,255,255,0.05)',
                border: `1px solid ${copied ? 'rgba(34,197,94,0.2)' : c.border}`,
                borderRadius: 8, padding: '6px 12px', cursor: 'pointer', transition: 'all 0.15s',
                fontFamily: 'monospace',
              }}
            >
              {copied ? 'Copied!' : `${vault.vaultAddress.slice(0, 6)}…${vault.vaultAddress.slice(-4)}`}
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            style={{
              fontSize: 11.5, color: c.textDim, background: 'transparent',
              border: `1px solid ${c.border}`, borderRadius: 8, padding: '6px 12px',
              cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {vault && (
        <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: 12, display: 'flex', gap: 24 }}>
          <div>
            <div style={{ fontSize: 10, color: c.textDim, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>Payments</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: c.text, fontVariantNumeric: 'tabular-nums' }}>${fmtUsd(vault.payments)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: c.textDim, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>Fees</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: c.blue, fontVariantNumeric: 'tabular-nums' }}>${fmtUsd(vault.fees)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Transfer panel ────────────────────────────────────────────────────────
function TransferPanel({ onSent }: { onSent: () => void }) {
  const { admin } = useAdminAuthStore();
  const canTransfer = admin?.adminRole === 'super_admin' || admin?.adminRole === 'treasurer';

  const [toAddress,  setToAddress]  = useState('');
  const [amount,     setAmount]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result,     setResult]     = useState<{ txHash: string } | null>(null);
  const [error,      setError]      = useState('');

  async function handleSend() {
    setError('');
    setResult(null);
    if (!toAddress.trim() || !amount.trim()) { setError('Both fields are required.'); return; }
    if (!/^G[A-Z0-9]{55}$/.test(toAddress.trim())) { setError('Invalid Stellar address (must start with G and be 56 chars).'); return; }
    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) { setError('Enter a valid amount.'); return; }
    setSubmitting(true);
    try {
      const res = await treasuryTransfer(toAddress.trim(), amount.trim());
      setResult(res);
      setToAddress('');
      setAmount('');
      onSent();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Transfer failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const card: CSSProperties = {
    background: c.surface, border: `1px solid ${c.border}`,
    borderRadius: 14, padding: '20px 24px',
    display: 'flex', flexDirection: 'column', gap: 14,
  };

  const inp: CSSProperties = {
    background: 'rgba(255,255,255,0.04)', border: `1px solid ${c.border}`,
    borderRadius: 9, padding: '10px 14px', color: c.text, fontSize: 13,
    outline: 'none', width: '100%', boxSizing: 'border-box',
    fontFamily: 'inherit',
  };

  if (!canTransfer) {
    return (
      <div style={{ ...card, alignItems: 'center', padding: '24px', textAlign: 'center' }}>
        <div style={{ color: c.textDim, fontSize: 13 }}>
          Only <span style={{ color: c.amber }}>super_admin</span> and <span style={{ color: c.amber }}>treasurer</span> roles can initiate transfers.
        </div>
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>Send USDC from Treasury</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ fontSize: 11, color: c.textDim, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Destination Stellar Address
        </label>
        <input
          style={inp}
          placeholder="G…"
          value={toAddress}
          onChange={(e) => setToAddress(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ fontSize: 11, color: c.textDim, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Amount (USDC)
        </label>
        <input
          style={inp}
          type="number"
          min="0.01"
          step="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      {error && (
        <div style={{ fontSize: 12, color: c.red, background: c.redDim, border: `1px solid rgba(239,68,68,0.2)`, borderRadius: 8, padding: '8px 12px' }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ fontSize: 12, color: c.green, background: c.greenDim, border: `1px solid rgba(34,197,94,0.2)`, borderRadius: 8, padding: '8px 12px' }}>
          Sent! TX hash:{' '}
          <span style={{ fontFamily: 'monospace', fontSize: 11 }}>
            {result.txHash.slice(0, 20)}…
          </span>
        </div>
      )}

      <button
        onClick={handleSend}
        disabled={submitting}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          background: submitting ? c.amberDim : c.amber,
          color: submitting ? c.amber : '#000',
          border: `1px solid ${c.amberBrd}`, borderRadius: 9,
          padding: '10px 18px', fontSize: 13, fontWeight: 600,
          cursor: submitting ? 'default' : 'pointer', transition: 'all 0.15s',
          opacity: submitting ? 0.7 : 1,
        }}
      >
        <IcoSend />
        {submitting ? 'Sending…' : 'Send USDC'}
      </button>
    </div>
  );
}

// ── EVM Withdraw panel ────────────────────────────────────────────────────
function EvmWithdrawPanel({ onSent }: { onSent: () => void }) {
  const { admin } = useAdminAuthStore();
  const canWithdraw = admin?.adminRole === 'super_admin' || admin?.adminRole === 'treasurer';

  const [submitting, setSubmitting] = useState(false);
  const [result,     setResult]     = useState<{ txHash: string; toAddress: string } | null>(null);
  const [error,      setError]      = useState('');

  async function handleSweep() {
    setError('');
    setResult(null);
    setSubmitting(true);
    try {
      const res = await evmTreasuryWithdraw();
      setResult(res);
      onSent();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Sweep failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const card: CSSProperties = {
    background: c.surface, border: `1px solid ${c.border}`,
    borderRadius: 14, padding: '20px 24px',
    display: 'flex', flexDirection: 'column', gap: 14,
  };

  if (!canWithdraw) {
    return (
      <div style={{ ...card, alignItems: 'center', padding: '24px', textAlign: 'center' }}>
        <div style={{ color: c.textDim, fontSize: 13 }}>
          Only <span style={{ color: c.blue }}>super_admin</span> and <span style={{ color: c.blue }}>treasurer</span> roles can withdraw from the vault.
        </div>
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>Sweep Vault Funds</div>

      <div style={{ fontSize: 12, color: c.textDim, background: c.blueDim, border: `1px solid rgba(96,165,250,0.22)`, borderRadius: 8, padding: '8px 12px' }}>
        Sweeps all available payments and fees to the configured withdrawal address in one transaction.
      </div>

      {error && (
        <div style={{ fontSize: 12, color: c.red, background: c.redDim, border: `1px solid rgba(239,68,68,0.2)`, borderRadius: 8, padding: '8px 12px' }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ fontSize: 12, color: c.green, background: c.greenDim, border: `1px solid rgba(34,197,94,0.2)`, borderRadius: 8, padding: '8px 12px' }}>
          Swept to{' '}
          <span style={{ fontFamily: 'monospace' }}>
            {result.toAddress.slice(0, 6)}…{result.toAddress.slice(-4)}
          </span>
          {' '}· TX:{' '}
          <span style={{ fontFamily: 'monospace' }}>
            {result.txHash.slice(0, 20)}…
          </span>
        </div>
      )}

      <button
        onClick={handleSweep}
        disabled={submitting}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          background: submitting ? c.blueDim : c.blue,
          color: '#000',
          border: `1px solid rgba(96,165,250,0.4)`, borderRadius: 9,
          padding: '10px 18px', fontSize: 13, fontWeight: 600,
          cursor: submitting ? 'default' : 'pointer', transition: 'all 0.15s',
          opacity: submitting ? 0.7 : 1,
        }}
      >
        <IcoChain />
        {submitting ? 'Sweeping…' : 'Sweep All Funds'}
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function TreasuryPage() {
  const [treasury,    setTreasury]    = useState<TreasuryBalance | null>(null);
  const [balLoading,  setBalLoading]  = useState(true);
  const [transfers,   setTransfers]   = useState<AdminTransferItem[]>([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [txLoading,   setTxLoading]   = useState(true);

  const loadBalance = useCallback(async () => {
    setBalLoading(true);
    try {
      const data = await getTreasuryBalance();
      setTreasury(data);
    } catch (e) { console.error(e); }
    finally { setBalLoading(false); }
  }, []);

  const loadTransfers = useCallback(async (p: number) => {
    setTxLoading(true);
    try {
      const res = await listAdminTransfers({ page: p, limit: LIMIT, status: 'completed' });
      setTransfers(res.transfers);
      setTotal(res.total);
    } catch (e) { console.error(e); }
    finally { setTxLoading(false); }
  }, []);

  useEffect(() => { void loadBalance(); }, [loadBalance]);
  useEffect(() => { void loadTransfers(page); }, [loadTransfers, page]);

  const totalPages = Math.ceil(total / LIMIT);
  const from       = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to         = Math.min(page * LIMIT, total);

  const card: CSSProperties = {
    background: c.surface, border: `1px solid ${c.border}`, borderRadius: 14,
  };

  const sectionLabel = (label: string, color: string): CSSProperties => ({
    fontSize: 12, fontWeight: 600, letterSpacing: '0.06em',
    textTransform: 'uppercase', color, marginBottom: 10,
  });

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 21, fontWeight: 700, color: c.text, margin: 0, letterSpacing: '-0.02em' }}>
          Treasury
        </h1>
        <div style={{ fontSize: 12, color: c.textDim, marginTop: 4 }}>
          Platform wallets — Stellar treasury and EVM vault
        </div>
      </div>

      {/* Stellar Treasury section */}
      <div>
        <div style={sectionLabel('Stellar Treasury', c.amber)}>Stellar Treasury</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, alignItems: 'start' }}>
          <BalanceCard treasury={treasury} loading={balLoading} onRefresh={loadBalance} />
          <TransferPanel onSent={loadBalance} />
        </div>
      </div>

      {/* EVM Vault section */}
      <div>
        <div style={sectionLabel('EVM Vault · CheeseVault', c.blue)}>EVM Vault · CheeseVault</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, alignItems: 'start' }}>
          <EvmVaultCard vault={treasury?.evmVault} loading={balLoading} onRefresh={loadBalance} />
          <EvmWithdrawPanel onSent={loadBalance} />
        </div>
      </div>

      {/* Completed transfers table */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 12 }}>
          Collected USDC — Completed Bank Transfers
          <span style={{ fontSize: 11, color: c.textDim, fontWeight: 400, marginLeft: 8 }}>
            ({total.toLocaleString()} total)
          </span>
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
          {txLoading && transfers.length === 0 ? (
            <div style={{ padding: '50px 22px', textAlign: 'center', fontSize: 13, color: c.textDim }}>Loading…</div>
          ) : transfers.length === 0 ? (
            <div style={{ padding: '50px 22px', textAlign: 'center', fontSize: 13, color: c.textDim }}>No completed transfers yet.</div>
          ) : (
            transfers.map((t, i) => {
              const ss = statusStyle(t.status);
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
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: c.text }}>@{t.username}</div>
                    <div style={{ fontSize: 10.5, color: c.textDim, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.reference}
                    </div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.accountName}
                    </div>
                    <div style={{ fontSize: 10.5, color: c.textDim, marginTop: 1 }}>
                      {t.bankName} · {t.accountNumber}
                    </div>
                  </div>
                  <div style={{ fontSize: 12.5, color: c.textMid, fontVariantNumeric: 'tabular-nums' }}>
                    ₦{fmt(t.amountNgn)}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: c.green, fontVariantNumeric: 'tabular-nums' }}>
                    +${fmtUsd(t.amountUsdc)}
                  </div>
                  <Pill
                    label={t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                    color={ss.color} bg={ss.bg} brd={ss.brd}
                  />
                  <div style={{ fontSize: 11.5, color: c.textDim }}>{fmtDate(t.createdAt)}</div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 4px' }}>
          <span style={{ fontSize: 12, color: c.textDim }}>
            {total === 0 ? 'No transfers' : (
              <>Showing <b style={{ color: c.text }}>{from}–{to}</b> of <b style={{ color: c.text }}>{total.toLocaleString()}</b></>
            )}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="action-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              style={{ minWidth: 30, height: 30, padding: '0 10px', fontSize: 12, color: c.textMid, borderRadius: 7, border: '1px solid transparent', opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? 'default' : 'pointer' }}>
              ← Prev
            </button>
            <button className="action-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
              style={{ minWidth: 30, height: 30, padding: '0 10px', fontSize: 12, color: c.textMid, borderRadius: 7, border: '1px solid transparent', opacity: page >= totalPages ? 0.4 : 1, cursor: page >= totalPages ? 'default' : 'pointer' }}>
              Next →
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
