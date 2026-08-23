'use client';

import React, { useState, useEffect, type CSSProperties } from 'react';
import Link from 'next/link';
import { c, IcoSearch, Pill, IcoRefresh, IcoCheck, IcoX, IcoArrowDn, IcoArrowUp, IcoChevron, IcoChevLeft } from '../_shared';
import { listAdminTransactions, getAdminTransaction, resolveAdminTransaction, getAdminStats, type AdminTransactionItem, type AdminTransactionDetail } from '@/lib/api/admin';

type StatusFilter = 'all' | 'pending' | 'completed' | 'failed' | 'reversed';
type TypeFilter   = 'all' | 'deposit' | 'withdrawal' | 'send_username' | 'send_address'
                  | 'bank_transfer' | 'pay_request' | 'yield_credit' | 'referral_bonus' | 'fee';

const LIMIT = 20;

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

const fmtUsdc = (v: string) =>
  parseFloat(v).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 6 });

function statusStyle(s: string) {
  if (s === 'completed') return { color: c.green,   bg: c.greenDim, brd: 'rgba(34,197,94,0.2)'  };
  if (s === 'failed')    return { color: c.red,     bg: c.redDim,   brd: 'rgba(239,68,68,0.2)'  };
  if (s === 'reversed')  return { color: c.textMid, bg: 'rgba(255,255,255,0.05)', brd: 'transparent' };
  return { color: c.amber, bg: c.amberDim, brd: c.amberBrd }; // pending
}

const TYPE_LABELS: Record<string, string> = {
  deposit:        'Deposit',
  withdrawal:     'Withdrawal',
  send_username:  'Send',
  send_address:   'Send (Addr)',
  bank_transfer:  'Bank Out',
  pay_request:    'Pay Link',
  yield_credit:   'Yield',
  referral_bonus: 'Referral',
  card_payment:   'Card',
  fee:            'Fee',
};

function typeStyle(t: string) {
  if (t === 'deposit' || t === 'yield_credit' || t === 'referral_bonus')
    return { color: c.green,  bg: c.greenDim,  brd: 'rgba(34,197,94,0.2)'  };
  if (t === 'withdrawal' || t === 'bank_transfer')
    return { color: c.amber,  bg: c.amberDim,  brd: c.amberBrd             };
  if (t === 'send_username' || t === 'send_address' || t === 'pay_request')
    return { color: c.blue,   bg: c.blueDim,   brd: 'rgba(96,165,250,0.2)' };
  return { color: c.textMid, bg: 'rgba(255,255,255,0.05)', brd: 'transparent' };
}

const STATUSES: { key: StatusFilter; label: string }[] = [
  { key: 'all',       label: 'All'       },
  { key: 'pending',   label: 'Pending'   },
  { key: 'completed', label: 'Completed' },
  { key: 'failed',    label: 'Failed'    },
  { key: 'reversed',  label: 'Reversed'  },
];

const TX_TYPES: { key: TypeFilter; label: string }[] = [
  { key: 'all',           label: 'All Types'   },
  { key: 'deposit',       label: 'Deposits'    },
  { key: 'send_username', label: 'Sends'       },
  { key: 'bank_transfer', label: 'Bank Out'    },
  { key: 'pay_request',   label: 'Pay Links'   },
  { key: 'withdrawal',    label: 'Withdrawals' },
  { key: 'yield_credit',  label: 'Yield'       },
];

const COLS     = ['User / Reference', 'Type', 'Amount USDC', 'Fee', 'Status', 'Recipient / Details', 'Date'];
const COL_GRID = '1.6fr 100px 110px 90px 100px 1.6fr 110px';

interface StatCounts { total: number; completed: number; failed: number; totalInUsdc: number; totalOutUsdc: number }

export default function TransactionsPage() {
  const [statusFilter,   setStatusFilter]   = useState<StatusFilter>('all');
  const [typeFilter,     setTypeFilter]     = useState<TypeFilter>('all');
  const [search,         setSearch]         = useState('');
  const [page,           setPage]           = useState(1);
  const [retryTick,      setRetryTick]      = useState(0);
  const [txns,           setTxns]           = useState<AdminTransactionItem[]>([]);
  const [total,          setTotal]          = useState(0);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [stats,          setStats]          = useState<StatCounts>({ total: 0, completed: 0, failed: 0, totalInUsdc: 0, totalOutUsdc: 0 });
  const [detail,         setDetail]         = useState<AdminTransactionDetail | null>(null);
  const [detailLoading,  setDetailLoading]  = useState(false);
  const [actionBusy,     setActionBusy]     = useState(false);
  const [actionMsg,      setActionMsg]      = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmAction,  setConfirmAction]  = useState<'refund_user' | 'treasury' | null>(null);

  // ── Summary counts + USDC totals ─────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      listAdminTransactions({ page: 1, limit: 1 }),
      listAdminTransactions({ page: 1, limit: 1, status: 'completed' }),
      listAdminTransactions({ page: 1, limit: 1, status: 'failed' }),
      getAdminStats(),
    ])
      .then(([all, comp, fail, adminStats]) => {
        setStats({
          total:       all.total,
          completed:   comp.total,
          failed:      fail.total,
          totalInUsdc:  adminStats.totalInUsdc,
          totalOutUsdc: adminStats.totalOutUsdc,
        });
      })
      .catch(console.error);
  }, []);

  // ── Table data ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const delay = search ? 350 : 0;
    const timer = setTimeout(async () => {
      try {
        const result = await listAdminTransactions({
          page,
          limit:  LIMIT,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          type:   typeFilter   !== 'all' ? typeFilter   : undefined,
          search: search || undefined,
        });
        if (!cancelled) { setTxns(result.transactions); setTotal(result.total); }
      } catch (e) {
        if (!cancelled) {
          const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
            ?? (e instanceof Error ? e.message : 'Failed to load transactions');
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, delay);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [page, search, statusFilter, typeFilter, retryTick]);

  const handleStatus = (s: StatusFilter) => { setStatusFilter(s); setPage(1); };
  const handleType   = (t: TypeFilter)   => { setTypeFilter(t);   setPage(1); };
  const handleSearch = (q: string)       => { setSearch(q);       setPage(1); };

  function openDetail(id: string) {
    setDetailLoading(true);
    setDetail(null);
    setActionMsg(null);
    setConfirmAction(null);
    getAdminTransaction(id)
      .then(setDetail)
      .catch(console.error)
      .finally(() => setDetailLoading(false));
  }

  async function handleResolve(resolution: 'refund_user' | 'treasury') {
    if (!detail || actionBusy) return;
    setActionBusy(true);
    setActionMsg(null);
    try {
      const result = await resolveAdminTransaction(detail.id, resolution);
      const status = resolution === 'refund_user' ? 'reversed' : 'completed';
      setDetail((d) => d ? { ...d, status } : d);
      setTxns((prev) => prev.map((t) => t.id === detail.id ? { ...t, status } : t));
      setConfirmAction(null);
      setActionMsg({ type: 'success', text: resolution === 'refund_user'
        ? `$${parseFloat(result.amountUsdc).toFixed(2)} USDC refunded to the user.`
        : `$${parseFloat(result.amountUsdc).toFixed(2)} USDC retained in the treasury.` });
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (e instanceof Error ? e.message : 'Transaction resolution failed');
      setActionMsg({ type: 'error', text: msg });
    } finally {
      setActionBusy(false);
    }
  }

  const n          = (v: number) => v.toLocaleString();
  const totalPages = Math.ceil(total / LIMIT);
  const from       = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to         = Math.min(page * LIMIT, total);

  const card: CSSProperties = {
    background: c.surface, border: `1px solid ${c.border}`, borderRadius: 14,
  };

  function recipientCell(t: AdminTransactionItem) {
    if (t.recipientUsername) return `@${t.recipientUsername}`;
    if (t.bankName)          return t.bankName;
    if (t.recipientAddress)  return `${t.recipientAddress.slice(0, 8)}…${t.recipientAddress.slice(-6)}`;
    return '—';
  }

  const fmtUsdc2 = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const STAT_ITEMS = [
    { label: 'Total Transactions', value: n(stats.total),              color: c.text,  icon: <IcoRefresh /> },
    { label: 'Completed',          value: n(stats.completed),          color: c.green, icon: <IcoCheck />   },
    { label: 'Failed',             value: n(stats.failed),             color: c.red,   icon: <IcoX />       },
    { label: 'Total Received',     value: fmtUsdc2(stats.totalInUsdc),  color: c.green, icon: <IcoArrowDn /> },
    { label: 'Total Sent',         value: fmtUsdc2(stats.totalOutUsdc), color: c.red,   icon: <IcoArrowUp /> },
  ] as const;

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div>
        <h1 style={{ fontSize: 21, fontWeight: 700, color: c.text, margin: 0, letterSpacing: '-0.02em' }}>
          Transactions
        </h1>
        <div style={{ fontSize: 12, color: c.textDim, marginTop: 4 }}>
          All on-chain and off-chain platform transactions — deposits, sends, paylinks, bank outs
        </div>
      </div>

      {/* ── Stats row ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
        {STAT_ITEMS.map(({ label, value, color, icon }) => (
          <div key={label} style={{ ...card, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'rgba(255,255,255,0.05)', border: `1px solid ${c.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, color,
            }}>
              {icon}
            </div>
            <div>
              <div style={{ fontSize: 11, color: c.textDim, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>
                {label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                {value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Row 1: search + result count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative', flex: '0 0 270px' }}>
            <span style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: c.textDim, display: 'flex', pointerEvents: 'none',
            }}>
              <IcoSearch />
            </span>
            <input
              type="text"
              className="user-search-input"
              placeholder="Search username, reference, bank…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <span style={{ fontSize: 11.5, color: c.textDim }}>
              {loading ? 'Loading…' : `${n(total)} result${total !== 1 ? 's' : ''}`}
            </span>
          </div>
        </div>

        {/* Row 2: status + type filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {STATUSES.map(({ key, label }) => (
              <button
                key={key}
                className="filter-btn"
                onClick={() => handleStatus(key)}
                style={{
                  background: statusFilter === key ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color:      statusFilter === key ? c.text                  : c.textDim,
                  border:     statusFilter === key ? `1px solid rgba(255,255,255,0.15)` : `1px solid transparent`,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ width: 1, height: 16, background: c.border }} />

          <div style={{ display: 'flex', gap: 4 }}>
            {TX_TYPES.map(({ key, label }) => (
              <button
                key={key}
                className="filter-btn"
                onClick={() => handleType(key)}
                style={{
                  background: typeFilter === key ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color:      typeFilter === key ? c.text                  : c.textDim,
                  border:     typeFilter === key ? `1px solid rgba(255,255,255,0.15)` : `1px solid transparent`,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
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
          {loading && txns.length === 0 ? (
            <div style={{ padding: '60px 22px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: c.textDim }}>Loading transactions…</div>
            </div>
          ) : error ? (
            <div style={{ padding: '60px 22px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: c.red, fontWeight: 500, marginBottom: 6 }}>Failed to load transactions</div>
              <div style={{ fontSize: 12, color: c.textDim, marginBottom: 16 }}>{error}</div>
              <button
                onClick={() => setRetryTick((tick) => tick + 1)}
                style={{
                  fontSize: 12, color: c.textMid, background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${c.border}`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          ) : txns.length === 0 ? (
            <div style={{ padding: '60px 22px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: c.textMid, fontWeight: 500, marginBottom: 6 }}>No transactions found</div>
              <div style={{ fontSize: 12, color: c.textDim }}>Try adjusting your search or filters.</div>
            </div>
          ) : (
            txns.map((t, i) => {
              const ss  = statusStyle(t.status);
              const ts  = typeStyle(t.type);
              const lbl = TYPE_LABELS[t.type] ?? t.type;
              return (
                <div
                  key={t.id}
                  className="row-hover"
                  onClick={() => openDetail(t.id)}
                  style={{
                    display: 'grid', gridTemplateColumns: COL_GRID,
                    padding: '11px 22px', alignItems: 'center',
                    borderBottom: i < txns.length - 1 ? `1px solid ${c.border}` : 'none',
                    cursor: 'pointer',
                    background: detail?.id === t.id ? 'rgba(255,255,255,0.04)' : undefined,
                  }}
                >
                  {/* User / Reference */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: c.text }}>@{t.username}</div>
                    <div style={{ fontSize: 10.5, color: c.textDim, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.reference}
                    </div>
                  </div>

                  {/* Type */}
                  <Pill label={lbl} color={ts.color} bg={ts.bg} brd={ts.brd} />

                  {/* Amount USDC */}
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: c.text, fontVariantNumeric: 'tabular-nums' }}>
                    ${fmtUsdc(t.amountUsdc)}
                  </div>

                  {/* Fee */}
                  <div style={{ fontSize: 11.5, color: c.textDim, fontVariantNumeric: 'tabular-nums' }}>
                    {parseFloat(t.feeUsdc) > 0 ? `$${fmtUsdc(t.feeUsdc)}` : '—'}
                  </div>

                  {/* Status */}
                  <Pill
                    label={t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                    color={ss.color} bg={ss.bg} brd={ss.brd}
                  />

                  {/* Recipient / Details */}
                  <div style={{
                    fontSize: 12, color: c.textMid,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    paddingRight: 8,
                  }}>
                    {recipientCell(t)}
                  </div>

                  {/* Date */}
                  <div style={{ fontSize: 11.5, color: c.textDim }}>{fmtDate(t.createdAt)}</div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Pagination ───────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 4px', flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, color: c.textDim }}>
          {total === 0 ? 'No transactions' : (
            <>
              Showing <span style={{ color: c.text, fontWeight: 500 }}>{from}–{to}</span> of{' '}
              <span style={{ color: c.text, fontWeight: 500 }}>{n(total)}</span> transactions
            </>
          )}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="action-btn"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            style={{
              minWidth: 30, height: 30, padding: '0 8px', fontSize: 12,
              color: page <= 1 ? c.textDim : c.textMid, borderRadius: 7,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1px solid transparent`, opacity: page <= 1 ? 0.4 : 1,
              cursor: page <= 1 ? 'default' : 'pointer', gap: 4,
            }}
          >
            <IcoChevLeft />{' '}Prev
          </button>
          <button
            className="action-btn"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            style={{
              minWidth: 30, height: 30, padding: '0 8px', fontSize: 12,
              color: page >= totalPages ? c.textDim : c.textMid, borderRadius: 7,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1px solid transparent`, opacity: page >= totalPages ? 0.4 : 1,
              cursor: page >= totalPages ? 'default' : 'pointer', gap: 4,
            }}
          >
            Next{' '}<IcoChevron />
          </button>
        </div>
      </div>

      {/* ── Transaction detail drawer ─────────────────────────────────────── */}
      {(detail || detailLoading) && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setDetail(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 90,
              background: 'rgba(0,0,0,0.45)',
            }}
          />

          {/* Drawer */}
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0,
            width: 440, zIndex: 100,
            background: c.surface, borderLeft: `1px solid ${c.border}`,
            display: 'flex', flexDirection: 'column',
            boxShadow: '-12px 0 40px rgba(0,0,0,0.5)',
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px', borderBottom: `1px solid ${c.border}`,
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0,
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>Transaction Detail</div>
                {detail && (
                  <div style={{ fontSize: 11, color: c.textDim, marginTop: 3, fontFamily: 'monospace' }}>
                    {detail.reference}
                  </div>
                )}
              </div>
              <button
                onClick={() => setDetail(null)}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: `1px solid ${c.border}`,
                  borderRadius: 8, width: 28, height: 28, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: c.textMid, fontSize: 16, lineHeight: 1, flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {detailLoading && !detail ? (
                <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: c.textDim }}>
                  Loading…
                </div>
              ) : detail ? (
                <>
                  {/* Status + type row */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(() => { const ss = statusStyle(detail.status); return <Pill label={detail.status.charAt(0).toUpperCase() + detail.status.slice(1)} color={ss.color} bg={ss.bg} brd={ss.brd} />; })()}
                    {(() => { const ts = typeStyle(detail.type); return <Pill label={TYPE_LABELS[detail.type] ?? detail.type} color={ts.color} bg={ts.bg} brd={ts.brd} />; })()}
                  </div>

                  {/* Amount */}
                  <Section label="Amount">
                    <Row k="USDC"    v={`$${fmtUsdc(detail.amountUsdc)}`} highlight />
                    <Row k="Fee"     v={parseFloat(detail.feeUsdc) > 0 ? `$${fmtUsdc(detail.feeUsdc)}` : '—'} />
                    {detail.amountNgn  && <Row k="NGN"  v={`₦${parseFloat(detail.amountNgn).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`} />}
                    {detail.rateApplied && <Row k="Rate" v={`₦${parseFloat(detail.rateApplied).toLocaleString()}`} />}
                  </Section>

                  {/* User */}
                  <Section label="User">
                    <Row k="Username" v={
                      <Link href={`/admin/users/${detail.userId}`} style={{ color: c.blue, textDecoration: 'none' }}>
                        @{detail.username}
                      </Link>
                    } />
                    <Row k="User ID" v={detail.userId} mono />
                  </Section>

                  {/* Recipient */}
                  {(detail.recipientUsername || detail.recipientAddress || detail.bankName) && (
                    <Section label="Recipient">
                      {detail.recipientUsername && <Row k="Username"  v={`@${detail.recipientUsername}`} />}
                      {detail.recipientName     && <Row k="Name"      v={detail.recipientName} />}
                      {detail.bankName          && <Row k="Bank"      v={detail.bankName} />}
                      {detail.accountNumber     && <Row k="Account"   v={detail.accountNumber} mono />}
                      {detail.recipientAddress  && <Row k="Address"   v={detail.recipientAddress} mono truncate />}
                    </Section>
                  )}

                  {/* On-chain */}
                  {(detail.txHash || detail.network) && (
                    <Section label="On-chain">
                      {detail.network && <Row k="Network" v={detail.network} />}
                      {detail.txHash  && <Row k="Tx Hash" v={detail.txHash} mono truncate />}
                    </Section>
                  )}

                  {/* Meta */}
                  <Section label="Details">
                    {detail.description    && <Row k="Description"    v={detail.description} />}
                    {detail.failureReason  && <Row k="Failure reason" v={detail.failureReason} color={c.red} />}
                    <Row k="Created"  v={new Date(detail.createdAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })} />
                    <Row k="Updated"  v={new Date(detail.updatedAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })} />
                    <Row k="ID" v={detail.id} mono truncate />
                  </Section>

                  {/* Actions */}
                  {(detail.status === 'pending' || detail.status === 'failed') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: c.textDim }}>
                        Actions
                      </div>

                      {/* Action feedback */}
                      {actionMsg && (
                        <div style={{
                          fontSize: 12, padding: '9px 12px', borderRadius: 8,
                          background: actionMsg.type === 'success' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                          color:      actionMsg.type === 'success' ? c.green              : c.red,
                          border:     `1px solid ${actionMsg.type === 'success' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                        }}>
                          {actionMsg.text}
                        </div>
                      )}

                      {/* Resolve transaction */}
                      {!confirmAction ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button disabled={actionBusy} onClick={() => setConfirmAction('refund_user')} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)', color: c.red, fontSize: 12, fontWeight: 600, cursor: actionBusy ? 'not-allowed' : 'pointer', opacity: actionBusy ? 0.6 : 1 }}>
                            Refund User
                          </button>
                          <button disabled={actionBusy} onClick={() => setConfirmAction('treasury')} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.22)', color: c.green, fontSize: 12, fontWeight: 600, cursor: actionBusy ? 'not-allowed' : 'pointer', opacity: actionBusy ? 0.6 : 1 }}>
                            Send to Treasury
                          </button>
                        </div>
                      ) : (
                        <div style={{
                          padding: '12px 14px', borderRadius: 10,
                          background: confirmAction === 'refund_user' ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
                          border: `1px solid ${confirmAction === 'refund_user' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
                          display: 'flex', flexDirection: 'column', gap: 10,
                        }}>
                          <div style={{ fontSize: 12, color: confirmAction === 'refund_user' ? c.red : c.green, fontWeight: 500 }}>
                            {confirmAction === 'refund_user'
                              ? `Send $${parseFloat(detail.amountUsdc).toFixed(2)} USDC back to this user?`
                              : `Retain $${parseFloat(detail.amountUsdc).toFixed(2)} USDC in the treasury?`}
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              disabled={actionBusy}
                              onClick={() => handleResolve(confirmAction)}
                              style={{
                                flex: 1, padding: '8px 0', borderRadius: 8,
                                background: confirmAction === 'refund_user' ? 'rgba(239,68,68,0.18)' : 'rgba(34,197,94,0.18)',
                                border: `1px solid ${confirmAction === 'refund_user' ? 'rgba(239,68,68,0.35)' : 'rgba(34,197,94,0.35)'}`,
                                color: confirmAction === 'refund_user' ? c.red : c.green, fontSize: 12, fontWeight: 600,
                                cursor: actionBusy ? 'not-allowed' : 'pointer',
                                opacity: actionBusy ? 0.6 : 1,
                              }}
                            >
                              {actionBusy ? 'Processing…' : confirmAction === 'refund_user' ? 'Confirm Refund' : 'Confirm Treasury'}
                            </button>
                            <button
                              disabled={actionBusy}
                              onClick={() => setConfirmAction(null)}
                              style={{
                                flex: 1, padding: '8px 0', borderRadius: 8,
                                background: 'rgba(255,255,255,0.05)',
                                border: `1px solid ${c.border}`,
                                color: c.textMid, fontSize: 12,
                                cursor: 'pointer',
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </>
      )}

    </div>
  );
}

// ── Drawer helpers ─────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: c.textDim, marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: 'rgba(255,255,255,0.03)', border: `1px solid ${c.border}`, borderRadius: 10, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

function Row({ k, v, mono, truncate, highlight, color }: {
  k: string;
  v: React.ReactNode;
  mono?: boolean;
  truncate?: boolean;
  highlight?: boolean;
  color?: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '9px 14px', gap: 12,
      borderBottom: `1px solid ${c.border}`,
    }}
    >
      <span style={{ fontSize: 11.5, color: c.textDim, flexShrink: 0 }}>{k}</span>
      <span style={{
        fontSize: highlight ? 15 : 12,
        fontWeight: highlight ? 600 : 400,
        color: color ?? (highlight ? c.text : c.textMid),
        fontFamily: mono ? 'monospace' : undefined,
        overflow: truncate ? 'hidden' : undefined,
        textOverflow: truncate ? 'ellipsis' : undefined,
        whiteSpace: truncate ? 'nowrap' : undefined,
        maxWidth: truncate ? 220 : undefined,
        textAlign: 'right',
      }}>
        {v}
      </span>
    </div>
  );
}
