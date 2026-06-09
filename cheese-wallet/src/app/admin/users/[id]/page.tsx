'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { c, Pill, tierStyle, kycStyle, walletStyle } from '../../_shared';
import {
  getAdminUserDetail, flagAdminUser, setAdminUserStatus, completeAdminTransfer,
  setAdminUserKycVerified, deleteAdminUser, type AdminUserDetail,
} from '@/lib/api/admin';

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const fmtNgn = (v: string) =>
  parseFloat(v).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function txStatusColor(s: string) {
  if (s === 'completed') return c.green;
  if (s === 'failed')    return c.red;
  if (s === 'pending')   return c.amber;
  return c.textMid;
}

export default function UserDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [user,    setUser]    = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    getAdminUserDetail(params.id)
      .then(setUser)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleFlag = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      const result = await flagAdminUser(user.id, !user.isFlagged);
      setUser((u) => u ? { ...u, isFlagged: result.isFlagged } : u);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const handleStatus = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      const result = await setAdminUserStatus(user.id, !user.isActive);
      setUser((u) => u ? { ...u, isActive: result.isActive } : u);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const handleVerifyKyc = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      const result = await setAdminUserKycVerified(user.id);
      setUser((u) => u ? { ...u, kycStatus: 'Verified' } : u);
      void result;
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      await deleteAdminUser(user.id);
      router.replace('/admin/users');
    } catch { /* ignore */ }
    finally { setSaving(false); setConfirmDelete(false); }
  };

  const handleCompleteTransfer = async (transferId: string) => {
    if (saving) return;
    setSaving(true);
    try {
      await completeAdminTransfer(transferId);
      setUser((u) => u ? {
        ...u,
        recentTransfers: u.recentTransfers.map((bt) =>
          bt.id === transferId ? { ...bt, status: 'completed' } : bt,
        ),
        recentTransactions: u.recentTransactions.map((tx) =>
          tx.type === 'bank_transfer' && tx.status === 'pending'
            ? { ...tx, status: 'completed' }
            : tx,
        ),
      } : u);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  // ── Loading / error states ────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ fontSize: 13, color: c.textDim }}>Loading user…</div>
      </div>
    );
  }
  if (notFound || !user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
        <div style={{ fontSize: 14, color: c.red }}>User not found.</div>
        <button onClick={() => router.back()} style={{ fontSize: 12, color: c.textDim, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          ← Go back
        </button>
      </div>
    );
  }

  const ts       = tierStyle(user.tier);
  const ks       = kycStyle(user.kycStatus);
  const ws       = walletStyle(user.walletStatus);
  const evmWs    = walletStyle(user.evmWalletStatus);
  const initials = user.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

  const card = {
    background: c.surface,
    border: `1px solid ${c.border}`,
    borderRadius: 14,
    padding: '20px',
  };

  const lbl = {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.07em',
    textTransform: 'uppercase' as const,
    color: c.textDim,
  };

  const profileRows = [
    { l: 'Full Name',     v: user.name                     },
    { l: 'Username',      v: `@${user.username}`           },
    { l: 'Email',         v: user.email                    },
    { l: 'Phone',         v: user.phone ?? '—'             },
    { l: 'Referral Code', v: user.referralCode ?? '—'      },
    { l: 'Points',        v: user.points.toLocaleString()  },
    { l: 'Joined',        v: fmtDate(user.createdAt)       },
  ];

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Back + Header ────────────────────────────────────────────────── */}
      <div>
        <button
          onClick={() => router.back()}
          style={{ fontSize: 12, color: c.textDim, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          ← Back to Users
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 50, height: 50, borderRadius: '50%', flexShrink: 0,
            background: c.amberDim, border: `1px solid ${c.amberBrd}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 19, fontWeight: 700, color: c.amber,
          }}>
            {initials}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: c.text, margin: 0, letterSpacing: '-0.02em' }}>
                {user.name}
              </h1>
              <Pill label={user.tier}      color={ts.color} bg={ts.bg} brd={ts.brd} />
              <Pill label={user.kycStatus} color={ks.color} bg={ks.bg} brd={ks.brd} />
              {user.isFlagged && (
                <Pill label="Flagged" color={c.red} bg={c.redDim} brd="rgba(239,68,68,0.2)" />
              )}
              {!user.isActive && (
                <Pill label="Inactive" color={c.textMid} bg="rgba(255,255,255,0.05)" brd="transparent" />
              )}
            </div>
            <div style={{ fontSize: 13, color: c.textDim, marginTop: 5 }}>
              @{user.username} · {user.email}
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI cards ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {[
          { label: 'Total Transactions',  value: user.txCount.toLocaleString(),             color: c.blue                                         },
          { label: 'Failed Transfers',    value: user.failedTransferCount.toLocaleString(), color: user.failedTransferCount > 0 ? c.red : c.green },
          { label: 'Reward Points',       value: user.points.toLocaleString(),              color: c.amber                                        },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ ...lbl, marginBottom: 10 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Main grid ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* ── Left column ─────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Profile */}
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 600, color: c.textMid, marginBottom: 16 }}>Profile</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {profileRows.map(({ l, v }) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  <div style={lbl}>{l}</div>
                  <div style={{ fontSize: 12.5, color: c.text, textAlign: 'right', maxWidth: '65%', wordBreak: 'break-all' }}>{v}</div>
                </div>
              ))}
              {user.referralCode && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  <div style={lbl}>Referral Link</div>
                  <CopyField value={`https://cheesepay.xyz/signup?ref=${user.referralCode}`} />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={lbl}>Email Verified</div>
                <Pill
                  label={user.emailVerified ? 'Verified' : 'Unverified'}
                  color={user.emailVerified ? c.green : c.amber}
                  bg={user.emailVerified ? c.greenDim : c.amberDim}
                  brd={user.emailVerified ? 'rgba(34,197,94,0.2)' : c.amberBrd}
                />
              </div>
            </div>
          </div>

          {/* Wallets */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: c.textMid }}>Wallets</div>
              {user.usdcBalance !== null && (
                <div style={{ fontSize: 13, fontWeight: 700, color: c.green }}>
                  ${parseFloat(user.usdcBalance).toFixed(4)} <span style={{ fontSize: 10, fontWeight: 500, color: c.textDim }}>USDC</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Stellar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontSize: 11, color: c.textDim, fontWeight: 500 }}>Stellar</div>
                  <Pill label={user.walletStatus} color={ws.color} bg={ws.bg} brd={ws.brd} />
                </div>
                <div style={{ fontSize: 10.5, color: c.textMid, fontFamily: 'monospace', wordBreak: 'break-all', background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 8, border: `1px solid ${c.border}` }}>
                  {user.stellarPublicKey ?? 'Not provisioned'}
                </div>
              </div>

              {/* EVM */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontSize: 11, color: c.textDim, fontWeight: 500 }}>EVM</div>
                  <Pill label={user.evmWalletStatus} color={evmWs.color} bg={evmWs.bg} brd={evmWs.brd} />
                </div>
                <div style={{ fontSize: 10.5, color: c.textMid, fontFamily: 'monospace', wordBreak: 'break-all', background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 8, border: `1px solid ${c.border}` }}>
                  {user.evmAddress ?? 'Not provisioned'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right column ─────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Actions */}
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 600, color: c.textMid, marginBottom: 14 }}>Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Flag / Unflag */}
              <button
                onClick={handleFlag}
                disabled={saving}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px', borderRadius: 10, cursor: saving ? 'default' : 'pointer',
                  background: user.isFlagged ? c.redDim : c.amberDim,
                  border: `1px solid ${user.isFlagged ? 'rgba(239,68,68,0.25)' : c.amberBrd}`,
                  color: user.isFlagged ? c.red : c.amber,
                  fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
                  opacity: saving ? 0.55 : 1, transition: 'opacity .15s',
                }}
              >
                <span>{user.isFlagged ? 'Unflag User' : 'Flag User'}</span>
                <span style={{ fontSize: 11, opacity: 0.65 }}>
                  {user.isFlagged ? 'Remove fraud flag' : 'Mark as suspicious'}
                </span>
              </button>

              {/* Verify KYC */}
              {user.kycStatus !== 'Verified' && (
                <button
                  onClick={handleVerifyKyc}
                  disabled={saving}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 16px', borderRadius: 10, cursor: saving ? 'default' : 'pointer',
                    background: c.greenDim,
                    border: '1px solid rgba(34,197,94,0.25)',
                    color: c.green,
                    fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
                    opacity: saving ? 0.55 : 1, transition: 'opacity .15s',
                  }}
                >
                  <span>Verify KYC</span>
                  <span style={{ fontSize: 11, opacity: 0.65 }}>Mark identity as verified</span>
                </button>
              )}

              {/* Activate / Deactivate */}
              <button
                onClick={handleStatus}
                disabled={saving}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px', borderRadius: 10, cursor: saving ? 'default' : 'pointer',
                  background: user.isActive ? c.redDim : c.greenDim,
                  border: `1px solid ${user.isActive ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'}`,
                  color: user.isActive ? c.red : c.green,
                  fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
                  opacity: saving ? 0.55 : 1, transition: 'opacity .15s',
                }}
              >
                <span>{user.isActive ? 'Deactivate Account' : 'Activate Account'}</span>
                <span style={{ fontSize: 11, opacity: 0.65 }}>
                  {user.isActive ? 'Block user access' : 'Restore user access'}
                </span>
              </button>

              {/* Divider */}
              <div style={{ borderTop: `1px solid ${c.border}`, margin: '4px 0' }} />

              {/* Delete User */}
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={saving}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 16px', borderRadius: 10, cursor: saving ? 'default' : 'pointer',
                    background: 'transparent',
                    border: `1px solid rgba(239,68,68,0.3)`,
                    color: c.red,
                    fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
                    opacity: saving ? 0.55 : 1, transition: 'opacity .15s',
                  }}
                >
                  <span>Delete User</span>
                  <span style={{ fontSize: 11, opacity: 0.65 }}>Permanent — cannot be undone</span>
                </button>
              ) : (
                <div style={{
                  borderRadius: 10, border: '1px solid rgba(239,68,68,0.4)',
                  background: c.redDim, padding: '12px 16px',
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  <div style={{ fontSize: 12, color: c.red, fontWeight: 600 }}>
                    Permanently delete @{user.username}?
                  </div>
                  <div style={{ fontSize: 11, color: c.textDim, lineHeight: 1.5 }}>
                    This will delete the account, all transactions, wallets, and associated data. This cannot be reversed.
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleDelete}
                      disabled={saving}
                      style={{
                        flex: 1, padding: '8px 0', borderRadius: 8, cursor: saving ? 'default' : 'pointer',
                        background: c.red, border: 'none', color: '#fff',
                        fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                        opacity: saving ? 0.6 : 1,
                      }}
                    >
                      {saving ? 'Deleting…' : 'Yes, delete permanently'}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      disabled={saving}
                      style={{
                        padding: '8px 14px', borderRadius: 8, cursor: saving ? 'default' : 'pointer',
                        background: 'transparent', border: `1px solid ${c.border}`, color: c.textMid,
                        fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recent Transactions */}
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 600, color: c.textMid, marginBottom: 14 }}>
              Recent Transactions
            </div>
            {user.recentTransactions.length === 0 ? (
              <div style={{ fontSize: 12, color: c.textDim, textAlign: 'center', padding: '18px 0' }}>
                No transactions yet
              </div>
            ) : (
              <div>
                {user.recentTransactions.map((tx, i) => (
                  <div
                    key={tx.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 0',
                      borderBottom: i < user.recentTransactions.length - 1 ? `1px solid ${c.border}` : 'none',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, color: c.text, fontWeight: 500, textTransform: 'capitalize' }}>
                        {tx.type.replace(/_/g, ' ')}
                      </div>
                      <div style={{ fontSize: 10.5, color: c.textDim, marginTop: 2 }}>
                        {fmtDate(tx.createdAt)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12.5, color: c.text, fontWeight: 600 }}>
                        ${parseFloat(tx.amountUsdc ?? '0').toFixed(2)}
                      </div>
                      <div style={{ fontSize: 10.5, color: txStatusColor(tx.status), marginTop: 2 }}>
                        {tx.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Bank Transfers */}
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 600, color: c.textMid, marginBottom: 14 }}>
              Recent Bank Transfers
            </div>
            {user.recentTransfers.length === 0 ? (
              <div style={{ fontSize: 12, color: c.textDim, textAlign: 'center', padding: '18px 0' }}>
                No bank transfers yet
              </div>
            ) : (
              <div>
                {user.recentTransfers.map((bt, i) => (
                  <div
                    key={bt.id}
                    style={{
                      padding: '8px 0',
                      borderBottom: i < user.recentTransfers.length - 1 ? `1px solid ${c.border}` : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <div style={{ fontSize: 12, color: c.text, fontWeight: 500 }}>{bt.accountName}</div>
                      <div style={{ fontSize: 12.5, color: c.text, fontWeight: 600 }}>₦{fmtNgn(bt.amountNgn)}</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 10.5, color: c.textDim }}>
                        {bt.bankName} · {fmtDate(bt.createdAt)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          fontSize: 10.5,
                          color: bt.status === 'failed' ? c.red : bt.status === 'completed' ? c.green : c.amber,
                        }}>
                          {bt.status}
                        </div>
                        {(bt.status === 'pending' || bt.status === 'processing') && (
                          <button
                            onClick={() => handleCompleteTransfer(bt.id)}
                            disabled={saving}
                            style={{
                              fontSize: 10, padding: '2px 8px', borderRadius: 6, cursor: saving ? 'default' : 'pointer',
                              background: c.greenDim, border: '1px solid rgba(34,197,94,0.25)',
                              color: c.green, fontFamily: 'inherit', fontWeight: 600,
                              opacity: saving ? 0.55 : 1,
                            }}
                          >
                            Mark complete
                          </button>
                        )}
                      </div>
                    </div>
                    {bt.failureReason && (
                      <div style={{
                        fontSize: 10.5, color: c.red, marginTop: 5,
                        background: c.redDim, padding: '4px 9px', borderRadius: 6,
                      }}>
                        {bt.failureReason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, maxWidth: '65%' }}>
      <span style={{ fontSize: 12, color: c.textMid, wordBreak: 'break-all', textAlign: 'right' }}>
        {value.replace('https://', '')}
      </span>
      <button
        onClick={copy}
        style={{
          flexShrink: 0,
          background: copied ? c.greenDim : 'rgba(255,255,255,0.06)',
          border: `1px solid ${copied ? 'rgba(34,197,94,0.2)' : c.border}`,
          borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
          fontSize: 11, color: copied ? c.green : c.textMid,
          fontFamily: 'inherit', whiteSpace: 'nowrap',
        }}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}
