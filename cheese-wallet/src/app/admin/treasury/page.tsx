'use client';

import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { c, IcoSend, IcoWallet, IcoChain } from '../_shared';
import {
  getTreasuryBalance,
  treasuryTransfer,
  evmTreasuryWithdraw,
  evmTreasurySweepSigner,
  type TreasuryBalance,
  type EvmVaultChainBalance,
  type EvmVaultTokenBalance,
} from '@/lib/api/admin';
import { useAdminAuthStore } from '@/store/adminAuthStore';

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtUsd = (v: string) => parseFloat(v).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNative = (v: string | null | undefined) =>
  parseFloat(v ?? '0').toLocaleString('en-NG', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
const shortAddr = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

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

// ── EVM Vault section ─────────────────────────────────────────────────────
function EvmVaultSection({
  vaults,
  loading,
  onRefresh,
}: {
  vaults:    EvmVaultChainBalance[];
  loading:   boolean;
  onRefresh: () => void;
}) {
  const { admin } = useAdminAuthStore();
  const canWithdraw = admin?.adminRole === 'super_admin' || admin?.adminRole === 'treasurer';

  const [selectedChainId, setSelectedChainId] = useState<number | null>(null);
  const [selectedToken,   setSelectedToken]   = useState<string | null>(null);
  const [copiedKey,       setCopiedKey]       = useState<string | null>(null);
  const [submitting,      setSubmitting]      = useState(false);
  const [result,          setResult]          = useState<{ txHash: string; toAddress: string; tokenSymbol: string } | null>(null);
  const [error,           setError]           = useState('');

  // Sweep Signer state
  const [signerSubmitting, setSignerSubmitting] = useState(false);
  const [signerResult,     setSignerResult]     = useState<{ txHash: string; toAddress: string; tokenSymbol: string; amount: string } | null>(null);
  const [signerError,      setSignerError]      = useState('');

  useEffect(() => {
    const firstChain = vaults[0];
    if (!firstChain) {
      setSelectedChainId(null);
      setSelectedToken(null);
      return;
    }

    const activeChain = vaults.find((item) => item.chainId === selectedChainId) ?? firstChain;
    const activeToken = activeChain.tokens.find((item) => item.tokenAddress === selectedToken) ?? activeChain.tokens[0];
    if (activeChain.chainId !== selectedChainId) setSelectedChainId(activeChain.chainId);
    if (activeToken?.tokenAddress !== selectedToken) setSelectedToken(activeToken?.tokenAddress ?? null);
  }, [selectedChainId, selectedToken, vaults]);

  function copy(value: string | null | undefined, key: string) {
    if (!value) return;
    void navigator.clipboard.writeText(value).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  }

  const selectedVault = vaults.find((item) => item.chainId === selectedChainId) ?? vaults[0];
  const selectedTokenSummary = selectedVault?.tokens.find((item) => item.tokenAddress === selectedToken) ?? selectedVault?.tokens[0];
  const vaultSweepable = parseFloat(selectedTokenSummary?.total ?? '0') > 0;
  const signerSweepable = parseFloat(selectedTokenSummary?.signerBalance ?? '0') > 0;
  const canSweep =
    canWithdraw &&
    Boolean(selectedVault?.withdrawalAddress) &&
    Boolean(selectedTokenSummary) &&
    (vaultSweepable || signerSweepable) &&
    !submitting &&
    !signerSubmitting;

  async function handleSweep() {
    if (!selectedVault || !selectedTokenSummary) return;
    setError('');
    setResult(null);
    if (!selectedVault.withdrawalAddress) { setError('Withdrawal address is not configured for this chain.'); return; }

    setSubmitting(true);
    try {
      if (vaultSweepable) {
        if (!selectedVault.vaultAddress) {
          setError('Vault address is not configured for this chain.');
          return;
        }
        const res = await evmTreasuryWithdraw({
          chainId: selectedVault.chainId,
          tokenAddress: selectedTokenSummary.tokenAddress,
        });
        setResult(res);
      } else {
        const res = await evmTreasurySweepSigner({
          chainId: selectedVault.chainId,
          tokenAddress: selectedTokenSummary.tokenAddress,
        });
        setSignerResult(res);
      }
      onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'EVM vault sweep failed');
    } finally {
      setSubmitting(false);
    }
  }

  const canSweepSigner =
    canWithdraw &&
    Boolean(selectedVault?.withdrawalAddress) &&
    Boolean(selectedTokenSummary) &&
    parseFloat(selectedTokenSummary?.signerBalance ?? '0') > 0 &&
    !signerSubmitting;

  async function handleSweepSigner() {
    if (!selectedVault || !selectedTokenSummary) return;
    setSignerError('');
    setSignerResult(null);
    if (!selectedVault.withdrawalAddress) { setSignerError('Withdrawal address is not configured for this chain.'); return; }

    setSignerSubmitting(true);
    try {
      const res = await evmTreasurySweepSigner({
        chainId: selectedVault.chainId,
        tokenAddress: selectedTokenSummary.tokenAddress,
      });
      setSignerResult(res);
      onRefresh();
    } catch (err: unknown) {
      setSignerError(err instanceof Error ? err.message : 'Signer sweep failed');
    } finally {
      setSignerSubmitting(false);
    }
  }

  const card: CSSProperties = {
    background: c.surface,
    border: `1px solid ${c.border}`,
    borderRadius: 14,
    padding: '20px 24px',
  };

  const monoButton = (value: string | null | undefined, key: string) => (
    value ? (
      <button
        onClick={() => copy(value, key)}
        style={{
          fontSize: 10.5, color: copiedKey === key ? c.green : c.textDim,
          background: copiedKey === key ? c.greenDim : 'rgba(255,255,255,0.04)',
          border: `1px solid ${copiedKey === key ? 'rgba(34,197,94,0.2)' : c.border}`,
          borderRadius: 7, padding: '5px 8px', cursor: 'pointer',
          fontFamily: 'monospace',
        }}
      >
        {copiedKey === key ? 'Copied!' : shortAddr(value)}
      </button>
    ) : <span style={{ color: c.textDim, fontSize: 11 }}>Not set</span>
  );

  if (!vaults.length && !loading) {
    return (
      <div style={{ ...card, color: c.textDim, fontSize: 13 }}>
        No EVM treasury chains are configured yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, alignItems: 'start' }}>
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>EVM Vaults</div>
            <div style={{ fontSize: 11.5, color: c.textDim, marginTop: 3 }}>
              Per-chain CheeseVault accounting for USDC and USDT.
            </div>
          </div>
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

        {loading && !vaults.length ? (
          <div style={{ fontSize: 13, color: c.textDim }}>Loading EVM treasury data…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {vaults.map((vault) => (
              <div
                key={vault.chainId}
                style={{
                  border: `1px solid ${selectedChainId === vault.chainId ? 'rgba(96,165,250,0.35)' : c.border}`,
                  background: selectedChainId === vault.chainId ? c.blueDim : 'rgba(255,255,255,0.025)',
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                  <button
                    onClick={() => {
                      setSelectedChainId(vault.chainId);
                      setSelectedToken(vault.tokens[0]?.tokenAddress ?? null);
                      setError('');
                      setResult(null);
                      setSignerError('');
                      setSignerResult(null);
                    }}
                    style={{
                      background: 'transparent', border: 'none', padding: 0,
                      cursor: 'pointer', textAlign: 'left', color: c.text,
                      fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{vault.displayName}</div>
                    <div style={{ fontSize: 11, color: c.textDim, marginTop: 3 }}>Chain ID {vault.chainId}</div>
                  </button>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: c.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Gas balance</div>
                    <div style={{ fontSize: 13, color: parseFloat(vault.nativeBalance ?? '0') > 1 ? c.green : c.amber, fontWeight: 700 }}>
                      {fmtNative(vault.nativeBalance)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, color: c.textDim, marginBottom: 4 }}>Backend signer</div>
                    {monoButton(vault.backendSigner, `${vault.chainId}:signer`)}
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: c.textDim, marginBottom: 4 }}>Factory</div>
                    {monoButton(vault.factoryAddress, `${vault.chainId}:factory`)}
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: c.textDim, marginBottom: 4 }}>Vault</div>
                    {monoButton(vault.vaultAddress, `${vault.chainId}:vault`)}
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: c.textDim, marginBottom: 4 }}>Withdrawal</div>
                    {monoButton(vault.withdrawalAddress, `${vault.chainId}:withdrawal`)}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr 1fr 1fr 1fr 92px', gap: 8, alignItems: 'center' }}>
                  {vault.tokens.map((token) => (
                    <TokenRow
                      key={`${vault.chainId}:${token.tokenAddress}`}
                      token={token}
                      selected={vault.chainId === selectedChainId && token.tokenAddress === selectedToken}
                      onSelect={() => {
                        setSelectedChainId(vault.chainId);
                        setSelectedToken(token.tokenAddress);
                        setError('');
                        setResult(null);
                        setSignerError('');
                        setSignerResult(null);
                      }}
                    />
                  ))}
                </div>

                {vault.errors.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {vault.errors.slice(0, 3).map((item) => (
                      <div key={item} style={{ fontSize: 11, color: c.amber }}>{item}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Sweep EVM Vault card */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>Sweep EVM Vault</div>
          {!canWithdraw ? (
            <div style={{ color: c.textDim, fontSize: 13 }}>
              Only <span style={{ color: c.blue }}>super_admin</span> and <span style={{ color: c.blue }}>treasurer</span> roles can withdraw from vaults.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: c.textDim, background: c.blueDim, border: `1px solid rgba(96,165,250,0.22)`, borderRadius: 8, padding: '8px 12px', lineHeight: 1.6 }}>
                Select a chain and token. The action sweeps the selected token from the vault, or from the backend signer when the signer is the available source.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11, color: c.textDim }}>Selected</div>
                <div style={{ fontSize: 13, color: c.text }}>
                  {selectedVault ? selectedVault.displayName : '—'} · {selectedTokenSummary?.symbol ?? '—'}
                </div>
                <div style={{ fontSize: 11.5, color: c.textDim }}>
                  Vault withdrawable: <span style={{ color: c.text }}>${fmtUsd(selectedTokenSummary?.total ?? '0')}</span>
                </div>
                <div style={{ fontSize: 11.5, color: c.textDim }}>
                  Signer sweepable: <span style={{ color: c.text }}>${fmtUsd(selectedTokenSummary?.signerBalance ?? '0')}</span>
                </div>
              </div>

              {error && (
                <div style={{ fontSize: 12, color: c.red, background: c.redDim, border: `1px solid rgba(239,68,68,0.2)`, borderRadius: 8, padding: '8px 12px' }}>
                  {error}
                </div>
              )}

              {result && (
                <div style={{ fontSize: 12, color: c.green, background: c.greenDim, border: `1px solid rgba(34,197,94,0.2)`, borderRadius: 8, padding: '8px 12px', lineHeight: 1.6 }}>
                  Swept {result.tokenSymbol} to {shortAddr(result.toAddress)} · TX {result.txHash.slice(0, 18)}…
                </div>
              )}

              <button
                onClick={handleSweep}
                disabled={!canSweep}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  background: canSweep ? c.blue : c.blueDim,
                  color: canSweep ? '#000' : c.blue,
                  border: `1px solid rgba(96,165,250,0.4)`, borderRadius: 9,
                  padding: '10px 18px', fontSize: 13, fontWeight: 600,
                  cursor: canSweep ? 'pointer' : 'default', transition: 'all 0.15s',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                <IcoChain />
                {submitting ? 'Sweeping…' : vaultSweepable ? 'Sweep Selected Token' : 'Sweep Selected Signer Token'}
              </button>
            </>
          )}
        </div>

        {/* Sweep Signer card */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>Sweep Signer</div>
          {!canWithdraw ? (
            <div style={{ color: c.textDim, fontSize: 13 }}>
              Only <span style={{ color: c.blue }}>super_admin</span> and <span style={{ color: c.blue }}>treasurer</span> roles can sweep the signer wallet.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: c.textDim, background: c.blueDim, border: `1px solid rgba(96,165,250,0.22)`, borderRadius: 8, padding: '8px 12px', lineHeight: 1.6 }}>
                Transfers the selected token&apos;s full balance from the backend signer wallet to the configured withdrawal address.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11, color: c.textDim }}>Selected</div>
                <div style={{ fontSize: 13, color: c.text }}>
                  {selectedVault ? selectedVault.displayName : '—'} · {selectedTokenSummary?.symbol ?? '—'}
                </div>
                <div style={{ fontSize: 11.5, color: c.textDim }}>
                  Signer balance: <span style={{ color: c.text }}>${fmtUsd(selectedTokenSummary?.signerBalance ?? '0')}</span>
                </div>
              </div>

              {signerError && (
                <div style={{ fontSize: 12, color: c.red, background: c.redDim, border: `1px solid rgba(239,68,68,0.2)`, borderRadius: 8, padding: '8px 12px' }}>
                  {signerError}
                </div>
              )}

              {signerResult && (
                <div style={{ fontSize: 12, color: c.green, background: c.greenDim, border: `1px solid rgba(34,197,94,0.2)`, borderRadius: 8, padding: '8px 12px', lineHeight: 1.6 }}>
                  Swept ${fmtUsd(signerResult.amount)} {signerResult.tokenSymbol} to {shortAddr(signerResult.toAddress)} · TX {signerResult.txHash.slice(0, 18)}…
                </div>
              )}

              <button
                onClick={handleSweepSigner}
                disabled={!canSweepSigner}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  background: canSweepSigner ? c.blue : c.blueDim,
                  color: canSweepSigner ? '#000' : c.blue,
                  border: `1px solid rgba(96,165,250,0.4)`, borderRadius: 9,
                  padding: '10px 18px', fontSize: 13, fontWeight: 600,
                  cursor: canSweepSigner ? 'pointer' : 'default', transition: 'all 0.15s',
                  opacity: signerSubmitting ? 0.7 : 1,
                }}
              >
                <IcoSend />
                {signerSubmitting ? 'Sweeping…' : 'Sweep Signer Balance'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TokenRow({
  token,
  selected,
  onSelect,
}: {
  token:    EvmVaultTokenBalance;
  selected: boolean;
  onSelect: () => void;
}) {
  const sweepable = parseFloat(token.total ?? '0') + parseFloat(token.signerBalance ?? '0');

  return (
    <>
      <button
        onClick={onSelect}
        style={{
          fontSize: 12, fontWeight: 700, color: selected ? '#000' : c.text,
          background: selected ? c.blue : 'rgba(255,255,255,0.04)',
          border: `1px solid ${selected ? 'rgba(96,165,250,0.4)' : c.border}`,
          borderRadius: 8, padding: '7px 0', cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {token.symbol}
      </button>
      <Metric label="Vault balance" value={`$${fmtUsd(token.vaultBalance)}`} />
      <Metric label="Signer balance" value={`$${fmtUsd(token.signerBalance ?? '0')}`} />
      <Metric label="Sweepable" value={`$${fmtUsd(String(sweepable))}`} />
      <Metric label="Fees" value={`$${fmtUsd(token.fees)}`} />
      <div style={{ fontSize: 11, color: token.error ? c.amber : token.accountingOk ? c.green : c.red, fontWeight: 600 }}>
        {token.error ? 'Check config' : token.accountingOk ? 'Healthy' : 'Mismatch'}
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 9.5, color: c.textDim, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, color: c.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
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
      setError(err instanceof Error ? err.message : 'Transfer failed');
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

// ── Page ──────────────────────────────────────────────────────────────────
export default function TreasuryPage() {
  const [treasury,   setTreasury]  = useState<TreasuryBalance | null>(null);
  const [balLoading, setBalLoading] = useState(true);

  const loadBalance = useCallback(async () => {
    setBalLoading(true);
    try {
      const data = await getTreasuryBalance();
      setTreasury(data);
    } catch (e) { console.error(e); }
    finally { setBalLoading(false); }
  }, []);

  useEffect(() => { void loadBalance(); }, [loadBalance]);

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
        <EvmVaultSection
          vaults={treasury?.evmVaults ?? []}
          loading={balLoading}
          onRefresh={loadBalance}
        />
      </div>

    </div>
  );
}
