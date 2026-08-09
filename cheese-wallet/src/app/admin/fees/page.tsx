'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import { c, IcoSearch, IcoChevron, IcoChevLeft } from '../_shared';
import { getAdminFeeStats, type AdminFeeTransferItem, type AdminFeeSummary } from '@/lib/api/admin';

const LIMIT = 20;

const fmtUsdc = (v: string | number) =>
  parseFloat(String(v)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });

const fmtNgn = (v: string) =>
  parseFloat(v).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const COLS     = ['Reference / User', 'Recipient', 'Bank', 'Amount (NGN)', 'Amount (USDC)', 'Fee (USDC)', 'Rate', 'Date'];
const COL_GRID = '1.8fr 1.4fr 1.1fr 110px 120px 100px 90px 130px';

const EMPTY_SUMMARY: AdminFeeSummary = {
  totalFeesUsdc: 0, totalCompletedCount: 0, todayFeesUsdc: 0, monthFeesUsdc: 0,
};

export default function FeesPage() {
  const [summary,  setSummary]  = useState<AdminFeeSummary>(EMPTY_SUMMARY);
  const [rows,     setRows]     = useState<AdminFeeTransferItem[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [search,   setSearch]   = useState('');
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const delay = search ? 350 : 0;
    const timer = setTimeout(async () => {
      try {
        const result = await getAdminFeeStats({ page, limit: LIMIT, search: search || undefined });
        if (!cancelled) {
          setSummary(result.summary);
          setRows(result.transfers);
          setTotal(result.total);
        }
      } catch (e) {
        if (!cancelled) {
          const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
            ?? (e instanceof Error ? e.message : 'Failed to load fee data');
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, delay);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [page, search, retryTick]);

  const handleSearch = (q: string) => { setSearch(q); setPage(1); };

  const n          = (v: number) => v.toLocaleString();
  const totalPages = Math.ceil(total / LIMIT);
  const from       = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to         = Math.min(page * LIMIT, total);

  const card: CSSProperties = {
    background: c.surface, border: `1px solid ${c.border}`, borderRadius: 14,
  };

  const STAT_ITEMS = [
    {
      label: 'All-Time Revenue',
      value: `$${fmtUsdc(summary.totalFeesUsdc)}`,
      sub:   `${n(summary.totalCompletedCount)} completed transfer${summary.totalCompletedCount !== 1 ? 's' : ''}`,
      color: c.amber,
      icon:  '$',
    },
    {
      label: 'This Month',
      value: `$${fmtUsdc(summary.monthFeesUsdc)}`,
      sub:   'Completed bank transfers',
      color: c.green,
      icon:  '↗',
    },
    {
      label: 'Today',
      value: `$${fmtUsdc(summary.todayFeesUsdc)}`,
      sub:   'Since midnight',
      color: c.blue,
      icon:  '⏱',
    },
  ] as const;

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div>
        <h1 style={{ fontSize: 21, fontWeight: 700, color: c.text, margin: 0, letterSpacing: '-0.02em' }}>
          Fee Revenue
        </h1>
        <div style={{ fontSize: 12, color: c.textDim, marginTop: 4 }}>
          USDC fees collected from completed bank transfers — charged on top of the transfer amount
        </div>
      </div>

      {/* ── Summary cards ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {STAT_ITEMS.map(({ label, value, sub, color, icon }) => (
          <div key={label} style={{ ...card, padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: c.textDim, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {label}
              </div>
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: 'rgba(255,255,255,0.05)', border: `1px solid ${c.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, color, fontWeight: 700,
              }}>
                {icon}
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1 }}>
              {value}
            </div>
            <div style={{ fontSize: 11, color: c.textDim, marginTop: 6 }}>
              {sub}
            </div>
          </div>
        ))}
      </div>

      {/* ── Fee tiers reference ─────────────────────────────────────────── */}
      <div style={{ ...card, padding: '14px 20px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: c.textDim, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
          Active Fee Tiers
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { range: '₦500 – ₦50,000',            fee: '₦500 / rate' },
            { range: '₦50,001 – ₦99,999',         fee: '₦1,000 / rate' },
            { range: '₦100,000 – ₦199,999',       fee: '$1' },
            { range: '₦200,000 – ₦500,000',       fee: '$2' },
            { range: '₦500,000+',                  fee: '$3' },
          ].map(({ range, fee }) => (
            <div key={range} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.04)', border: `1px solid ${c.border}`,
              borderRadius: 8, padding: '6px 12px',
            }}>
              <span style={{ fontSize: 11.5, color: c.textMid }}>{range}</span>
              <span style={{ color: c.border, display: 'flex' }}><IcoChevron /></span>
              <span style={{ fontSize: 12, fontWeight: 700, color: c.amber, fontVariantNumeric: 'tabular-nums' }}>{fee}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ position: 'relative', flex: '0 0 280px' }}>
          <span style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            color: c.textDim, display: 'flex', pointerEvents: 'none',
          }}>
            <IcoSearch />
          </span>
          <input
            type="text"
            className="user-search-input"
            placeholder="Search reference, recipient, bank…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <span style={{ fontSize: 11.5, color: c.textDim }}>
            {loading ? 'Loading…' : `${n(total)} transfer${total !== 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
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
          {loading && rows.length === 0 ? (
            <div style={{ padding: '60px 22px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: c.textDim }}>Loading fee records…</div>
            </div>
          ) : error ? (
            <div style={{ padding: '60px 22px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: c.red, fontWeight: 500, marginBottom: 6 }}>Failed to load fee data</div>
              <div style={{ fontSize: 12, color: c.textDim, marginBottom: 16 }}>{error}</div>
              <button
                onClick={() => { setPage(1); setSearch(''); setRetryTick(t => t + 1); }}
                style={{
                  fontSize: 12, color: c.textMid, background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${c.border}`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          ) : rows.length === 0 ? (
            <div style={{ padding: '60px 22px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: c.textMid, fontWeight: 500, marginBottom: 6 }}>No completed transfers yet</div>
              <div style={{ fontSize: 12, color: c.textDim }}>Fee records appear once a bank transfer completes.</div>
            </div>
          ) : (
            rows.map((t, i) => (
              <div
                key={t.id}
                className="row-hover"
                style={{
                  display: 'grid', gridTemplateColumns: COL_GRID,
                  padding: '11px 22px', alignItems: 'center',
                  borderBottom: i < rows.length - 1 ? `1px solid ${c.border}` : 'none',
                  background: 'transparent',
                }}
              >
                {/* Reference / User */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontFamily: 'monospace', color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.reference}
                  </div>
                  <div style={{ fontSize: 11, color: c.textDim, marginTop: 1 }}>
                    @{t.username}
                  </div>
                </div>

                {/* Recipient */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: c.textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.accountName}
                  </div>
                  <div style={{ fontSize: 11, fontFamily: 'monospace', color: c.textDim, marginTop: 1 }}>
                    {t.accountNumber}
                  </div>
                </div>

                {/* Bank */}
                <div style={{ fontSize: 12, color: c.textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.bankName}
                </div>

                {/* Amount NGN */}
                <div style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: c.text }}>
                  ₦{fmtNgn(t.amountNgn)}
                </div>

                {/* Amount USDC */}
                <div style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: c.textMid }}>
                  ${fmtUsdc(t.amountUsdc)}
                </div>

                {/* Fee USDC — highlighted */}
                <div style={{
                  fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                  color: c.amber,
                }}>
                  ${fmtUsdc(t.feeUsdc)}
                </div>

                {/* Rate */}
                <div style={{ fontSize: 11, color: c.textDim, fontVariantNumeric: 'tabular-nums' }}>
                  ₦{parseFloat(t.rateApplied).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                </div>

                {/* Date */}
                <div style={{ fontSize: 11, color: c.textDim }}>
                  {fmtDate(t.createdAt)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 22px', borderTop: `1px solid ${c.border}`, flexShrink: 0,
          }}>
            <span style={{ fontSize: 11.5, color: c.textDim }}>
              {from}–{to} of {n(total)}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  fontSize: 12, padding: '4px 12px', borderRadius: 7, cursor: page === 1 ? 'default' : 'pointer',
                  background: 'rgba(255,255,255,0.05)', border: `1px solid ${c.border}`,
                  color: page === 1 ? c.textDim : c.text, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <IcoChevLeft />{' '}Prev
              </button>
              <span style={{ fontSize: 12, color: c.textMid, padding: '4px 8px', alignSelf: 'center' }}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{
                  fontSize: 12, padding: '4px 12px', borderRadius: 7, cursor: page === totalPages ? 'default' : 'pointer',
                  background: 'rgba(255,255,255,0.05)', border: `1px solid ${c.border}`,
                  color: page === totalPages ? c.textDim : c.text, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
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
