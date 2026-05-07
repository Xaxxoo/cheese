'use client';

import { useState, useEffect, useCallback } from 'react';
import { c } from '../_shared';
import { getAdminRate, setAdminRate, type ExchangeRateRecord } from '@/lib/api/admin';

export default function AdminRatesPage() {
  const [rate,    setRate]    = useState<ExchangeRateRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  // form state
  const [usdToNgn,      setUsdToNgn]      = useState('');
  const [spreadPercent, setSpreadPercent] = useState('0');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const r = await getAdminRate();
      setRate(r);
      setUsdToNgn(parseFloat(r.usdToNgn).toString());
      setSpreadPercent(parseFloat(r.spreadPercent).toString());
    } catch {
      setError('Failed to load rate');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setError(''); setSuccess('');
    const raw   = parseFloat(usdToNgn);
    const spread = parseFloat(spreadPercent || '0');
    if (isNaN(raw) || raw <= 0) { setError('Enter a valid rate'); return; }
    if (isNaN(spread) || spread < 0 || spread > 100) { setError('Spread must be 0–100'); return; }

    try {
      setSaving(true);
      const updated = await setAdminRate(raw, spread);
      setRate(updated);
      setSuccess(`Rate updated — 1 USD = ₦${parseFloat(updated.effectiveRate).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    } catch {
      setError('Failed to update rate');
    } finally {
      setSaving(false);
    }
  };

  const effective = (() => {
    const r = parseFloat(usdToNgn);
    const s = parseFloat(spreadPercent || '0');
    if (isNaN(r) || r <= 0) return null;
    return r * (1 - s / 100);
  })();

  return (
    <div style={{ padding: 28, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: c.text, margin: 0 }}>Exchange Rate</h1>
        <p style={{ fontSize: 13, color: c.textDim, margin: '4px 0 0' }}>
          Manually set the USD → NGN rate applied across the platform.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 820 }}>

        {/* Current rate card */}
        <div style={{
          background: c.surface, border: `1px solid ${c.border}`,
          borderRadius: 12, padding: 20,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: c.textDim, marginBottom: 14 }}>
            Live Rate
          </div>
          {loading ? (
            <div style={{ fontSize: 13, color: c.textDim }}>Loading…</div>
          ) : rate ? (
            <>
              <div style={{ fontSize: 32, fontWeight: 800, color: c.amber, letterSpacing: '-0.02em', lineHeight: 1 }}>
                ₦{parseFloat(rate.effectiveRate).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 12, color: c.textDim, marginTop: 6 }}>per 1 USD (effective)</div>
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[
                  ['Market rate',   `₦${parseFloat(rate.usdToNgn).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`],
                  ['Platform spread', `${parseFloat(rate.spreadPercent).toFixed(2)}%`],
                  ['Source',         rate.source],
                  ['Last set',       new Date(rate.fetchedAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: c.textDim }}>{label}</span>
                    <span style={{ color: c.textMid, fontVariantNumeric: 'tabular-nums' }}>{val}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: c.textDim }}>No rate set</div>
          )}
        </div>

        {/* Set rate form */}
        <div style={{
          background: c.surface, border: `1px solid ${c.border}`,
          borderRadius: 12, padding: 20,
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: c.textDim }}>
            Update Rate
          </div>

          <div>
            <label style={{ fontSize: 11.5, color: c.textDim, display: 'block', marginBottom: 6 }}>
              USD → NGN rate
            </label>
            <input
              type="number"
              value={usdToNgn}
              onChange={e => setUsdToNgn(e.target.value)}
              placeholder="e.g. 1390"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${c.border}`,
                borderRadius: 8, padding: '8px 12px',
                fontSize: 14, fontWeight: 600, color: c.text,
                fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11.5, color: c.textDim, display: 'block', marginBottom: 6 }}>
              Platform spread % <span style={{ opacity: 0.5 }}>(0 = no markup)</span>
            </label>
            <input
              type="number"
              value={spreadPercent}
              onChange={e => setSpreadPercent(e.target.value)}
              min="0" max="100" step="0.1"
              placeholder="0"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${c.border}`,
                borderRadius: 8, padding: '8px 12px',
                fontSize: 14, color: c.text,
                fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>

          {/* Preview */}
          {effective !== null && (
            <div style={{
              background: 'rgba(245,158,11,0.07)',
              border: `1px solid rgba(245,158,11,0.18)`,
              borderRadius: 8, padding: '10px 14px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 12, color: c.textDim }}>Effective rate</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: c.amber }}>
                ₦{effective.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {error   && <div style={{ fontSize: 12, color: c.red,   background: c.redDim,   border: `1px solid rgba(239,68,68,0.2)`,   borderRadius: 8, padding: '8px 12px' }}>{error}</div>}
          {success && <div style={{ fontSize: 12, color: c.green, background: c.greenDim, border: `1px solid rgba(34,197,94,0.2)`,   borderRadius: 8, padding: '8px 12px' }}>{success}</div>}

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: c.amber, color: '#09090b',
              border: 'none', borderRadius: 8,
              padding: '10px 20px', fontSize: 13, fontWeight: 700,
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.7 : 1,
              fontFamily: 'inherit',
              marginTop: 'auto',
            }}
          >
            {saving ? 'Saving…' : 'Apply Rate'}
          </button>
        </div>
      </div>
    </div>
  );
}
