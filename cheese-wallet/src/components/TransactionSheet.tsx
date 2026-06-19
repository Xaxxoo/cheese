'use client'

import { useEffect, useRef, useState } from 'react'
import {
  X, Share2,
  ArrowUpRight, ArrowDownLeft, Building2,
} from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { captureAndShare, type ShareFormat } from '@/lib/shareReceipt'
import type { Transaction } from '@/types'

// ── Config maps (mirrors history page) ──────────────────────
const TX_LABELS: Record<string, string> = {
  send_username:  'Sent',
  send_address:   'Sent',
  bank_transfer:  'Bank Transfer',
  withdrawal:     'Withdrawal',
  deposit:        'Deposit',
  yield_credit:   'Yield Credit',
  referral_bonus: 'Referral Bonus',
  card_payment:   'Card Payment',
  fee:            'Fee',
  pay_request:    'Pay Request',
}

const TX_ICON: Record<string, { Icon: React.ElementType; color: string; bg: string }> = {
  send_username:  { Icon: ArrowUpRight,  color: 'text-white/70',    bg: 'bg-white/10'         },
  send_address:   { Icon: ArrowUpRight,  color: 'text-white/70',    bg: 'bg-white/10'         },
  bank_transfer:  { Icon: Building2,     color: 'text-sky-400',     bg: 'bg-sky-400/12'       },
  withdrawal:     { Icon: Building2,     color: 'text-sky-400',     bg: 'bg-sky-400/12'       },
  deposit:        { Icon: ArrowDownLeft, color: 'text-emerald-400', bg: 'bg-emerald-400/12'   },
  yield_credit:   { Icon: ArrowDownLeft, color: 'text-emerald-400', bg: 'bg-emerald-400/12'   },
  referral_bonus: { Icon: ArrowDownLeft, color: 'text-emerald-400', bg: 'bg-emerald-400/12'   },
  card_payment:   { Icon: ArrowUpRight,  color: 'text-white/70',    bg: 'bg-white/10'         },
  fee:            { Icon: ArrowUpRight,  color: 'text-white/70',    bg: 'bg-white/10'         },
  pay_request:    { Icon: ArrowUpRight,  color: 'text-white/70',    bg: 'bg-white/10'         },
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  completed: { label: 'Completed', cls: 'bg-emerald-400/12 text-emerald-400' },
  pending:   { label: 'Pending',   cls: 'bg-amber-400/15 text-amber-400'     },
  failed:    { label: 'Failed',    cls: 'bg-red-400/15 text-red-400'         },
  reversed:  { label: 'Reversed',  cls: 'bg-orange-400/15 text-orange-400'   },
}

// Inline-style equivalents used inside the off-screen receipt card (html2canvas reads computed styles)
const RECEIPT_ICON_STYLE: Record<string, { bg: string; color: string }> = {
  send_username:  { bg: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.7)' },
  send_address:   { bg: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.7)' },
  bank_transfer:  { bg: 'rgba(56,189,248,0.12)',  color: '#38bdf8' },
  withdrawal:     { bg: 'rgba(56,189,248,0.12)',  color: '#38bdf8' },
  deposit:        { bg: 'rgba(52,211,153,0.12)',  color: '#34d399' },
  yield_credit:   { bg: 'rgba(52,211,153,0.12)',  color: '#34d399' },
  referral_bonus: { bg: 'rgba(52,211,153,0.12)',  color: '#34d399' },
  card_payment:   { bg: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.7)' },
  fee:            { bg: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.7)' },
  pay_request:    { bg: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.7)' },
}

const RECEIPT_STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: 'Completed', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  pending:   { label: 'Pending',   color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
  failed:    { label: 'Failed',    color: '#f87171', bg: 'rgba(248,113,113,0.15)' },
  reversed:  { label: 'Reversed',  color: '#fb923c', bg: 'rgba(251,146,60,0.15)' },
}

// ── Row helper ───────────────────────────────────────────────
function DetailRow({ label, value, mono = false, truncate = false }: {
  label: string
  value: string
  mono?: boolean
  truncate?: boolean
}) {
  return (
    <div className="flex justify-between items-start gap-4 py-3 border-b border-white/6 last:border-0">
      <span className="text-xs text-white/35 shrink-0 uppercase tracking-wider font-medium">{label}</span>
      <span className={cn(
        'text-xs text-right',
        mono ? 'font-mono text-white/60 break-all' : 'text-white/80 font-medium',
        truncate && 'truncate max-w-[60%]',
      )}>
        {value}
      </span>
    </div>
  )
}

// ── Sheet ────────────────────────────────────────────────────
interface TransactionSheetProps {
  tx: Transaction | null
  onClose: () => void
}

export function TransactionSheet({ tx, onClose }: TransactionSheetProps) {
  const receiptRef = useRef<HTMLDivElement>(null)
  const [sharing, setSharing] = useState<ShareFormat | false>(false)
  const [showPicker, setShowPicker] = useState(false)

  // Lock body scroll while open
  useEffect(() => {
    if (tx) document.body.style.overflow = 'hidden'
    else     document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [tx])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!tx) return null

  const isIn = tx.type === 'deposit' || tx.type === 'yield_credit' || tx.type === 'referral_bonus'
  const sign  = isIn ? '+' : '-'
  const amountColor = isIn ? 'text-emerald-400' : 'text-white'
  const cfg   = TX_ICON[tx.type] ?? TX_ICON.deposit
  const { Icon } = cfg
  const status = STATUS_STYLE[tx.status] ?? { label: tx.status, cls: 'bg-white/8 text-white/50' }
  const receiptIcon = RECEIPT_ICON_STYLE[tx.type] ?? RECEIPT_ICON_STYLE.deposit
  const receiptStatus = RECEIPT_STATUS_STYLE[tx.status] ?? { label: tx.status, color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.08)' }

  const date = new Date(tx.createdAt).toLocaleString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  async function shareReceipt(format: ShareFormat) {
    if (!receiptRef.current || sharing) return
    setSharing(format)
    try {
      await captureAndShare(receiptRef.current, format)
    } catch (err) {
      console.error('[share receipt]', err)
    } finally {
      setSharing(false)
      setShowPicker(false)
    }
  }

  // Build detail rows for the receipt card
  const detailRows: { label: string; value: string; mono?: boolean }[] = [
    { label: 'TYPE', value: TX_LABELS[tx.type] ?? tx.type },
    { label: 'DATE', value: date },
    ...(tx.recipientName     ? [{ label: 'RECIPIENT', value: tx.recipientName }] : []),
    ...(tx.recipientUsername ? [{ label: 'TO',        value: `@${tx.recipientUsername}` }] : []),
    ...(tx.recipientAddress  ? [{ label: 'ADDRESS',   value: `${tx.recipientAddress.slice(0, 14)}…${tx.recipientAddress.slice(-6)}`, mono: true }] : []),
    ...(tx.bank              ? [{ label: 'BANK',      value: tx.bank }] : []),
    ...(tx.accountNumber     ? [{ label: 'ACCOUNT',   value: tx.accountNumber, mono: true }] : []),
    ...(tx.network           ? [{ label: 'NETWORK',   value: tx.network }] : []),
    ...(tx.description       ? [{ label: 'NOTE',      value: tx.description }] : []),
    ...(tx.fee && parseFloat(tx.fee) > 0 ? [{ label: 'FEE', value: `$${parseFloat(tx.fee).toFixed(4)} USDC` }] : []),
  ]

  const refRows: { label: string; value: string }[] = [
    { label: 'REFERENCE', value: tx.reference },
    ...(tx.txHash ? [{ label: 'TX HASH', value: tx.txHash.length > 22 ? `${tx.txHash.slice(0, 22)}…` : tx.txHash }] : []),
  ]

  return (
    <>
      {/* Off-screen receipt card — captured by html2canvas */}
      <div
        ref={receiptRef}
        aria-hidden
        style={{
          position: 'fixed', left: '-9999px', top: 0,
          width: '375px', background: '#141414',
          borderRadius: '24px', padding: '32px 20px 28px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        {/* Logo */}
        <p style={{ color: '#d4a843', fontSize: '13px', fontWeight: '700', letterSpacing: '0.1em', textAlign: 'center', marginBottom: '24px', textTransform: 'uppercase' }}>
          cheese pay
        </p>

        {/* Icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: receiptIcon.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={28} style={{ color: receiptIcon.color }} />
          </div>
        </div>

        {/* Amount */}
        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
          <span style={{ color: isIn ? '#34d399' : 'white', fontSize: '32px', fontWeight: '700', letterSpacing: '-0.02em' }}>
            {sign}${parseFloat(tx.amountUsdc).toFixed(2)}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '16px', fontWeight: '500', marginLeft: '6px' }}>USDC</span>
          {tx.amountNgn && (
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '14px', marginTop: '4px' }}>
              ≈ ₦{parseFloat(tx.amountNgn).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </p>
          )}
        </div>

        {/* Status badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <span style={{ background: receiptStatus.bg, color: receiptStatus.color, fontSize: '12px', fontWeight: '500', padding: '4px 14px', borderRadius: '20px' }}>
            {receiptStatus.label}
          </span>
        </div>

        {/* Detail rows */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '0 16px', marginBottom: '12px' }}>
          {detailRows.map(({ label, value, mono }, i) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', padding: '12px 0', borderBottom: i < detailRows.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>{label}</span>
              <span style={{ color: mono ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.85)', fontSize: '12px', fontWeight: mono ? '400' : '500', fontFamily: mono ? 'monospace' : 'inherit', textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Reference rows */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '0 16px', marginBottom: '24px' }}>
          {refRows.map(({ label, value }, i) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', padding: '12px 0', borderBottom: i < refRows.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>{label}</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontFamily: 'monospace', textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', textAlign: 'center', letterSpacing: '0.04em' }}>cheesepay.xyz</p>
      </div>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-1/2 -translate-x-1/2 z-[60] rounded-t-3xl flex flex-col w-full max-w-[430px]"
        style={{
          background: '#141414',
          border: '1px solid rgba(255,255,255,0.08)',
          borderBottom: 'none',
          maxHeight: '92dvh',
        }}
      >
        {/* Drag handle — not scrollable */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/15" />
        </div>

        {/* Header — not scrollable */}
        <div className="flex items-center justify-between px-5 pt-3 pb-4 shrink-0">
          <h2 className="text-base font-semibold text-white">Transaction Detail</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/14 transition-all"
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* Amount hero */}
          <div className="flex flex-col items-center gap-3 px-5 py-5">
            <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center', cfg.bg)}>
              <Icon size={28} className={cfg.color} />
            </div>
            <div className="text-center">
              <p className={cn('text-3xl font-bold tabular-nums', amountColor)}>
                {sign}${parseFloat(tx.amountUsdc).toFixed(2)}
                <span className="text-base font-medium text-white/30 ml-1.5">USDC</span>
              </p>
              {tx.amountNgn && (
                <p className="text-sm text-white/35 mt-1">
                  ≈ ₦{parseFloat(tx.amountNgn).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>
            <span className={cn('text-xs font-medium px-3 py-1 rounded-full', status.cls)}>
              {status.label}
            </span>
          </div>

          {/* Details */}
          <div className="px-5 pb-2">
            <div className="rounded-2xl px-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <DetailRow label="Type"      value={TX_LABELS[tx.type] ?? tx.type} />
              <DetailRow label="Date"      value={date} />
              {tx.recipientName    && <DetailRow label="Recipient"  value={tx.recipientName} />}
              {tx.recipientUsername && <DetailRow label="To"         value={`@${tx.recipientUsername}`} />}
              {tx.recipientAddress && <DetailRow label="Address"    value={tx.recipientAddress} mono truncate />}
              {tx.bank             && <DetailRow label="Bank"       value={tx.bank} />}
              {tx.accountNumber    && <DetailRow label="Account"    value={tx.accountNumber} mono />}
              {tx.network          && <DetailRow label="Network"    value={tx.network} />}
              {tx.description      && <DetailRow label="Note"       value={tx.description} />}
              {tx.fee && parseFloat(tx.fee) > 0 && (
                <DetailRow label="Fee" value={`$${parseFloat(tx.fee).toFixed(4)} USDC`} />
              )}
            </div>
          </div>

          {/* Reference + txHash */}
          <div className="px-5 pt-3 pb-4">
            <div className="rounded-2xl px-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <DetailRow label="Reference" value={tx.reference} mono />
              {tx.txHash && <DetailRow label="Tx Hash" value={tx.txHash} mono truncate />}
            </div>
          </div>
        </div>

        {/* Share button — sticky above safe area */}
        <div
          className="shrink-0 px-5 pt-3 pb-3"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          {!showPicker ? (
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#d4a843] text-black text-sm font-semibold hover:bg-[#c49938] transition-colors active:scale-[0.98]"
            >
              <Share2 size={16} />
              Share Receipt
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => shareReceipt('jpeg')}
                disabled={!!sharing}
                className="flex-1 flex items-center justify-center gap-1.5 py-3.5 rounded-2xl bg-[#d4a843] text-black text-sm font-semibold hover:bg-[#c49938] transition-colors disabled:opacity-50 active:scale-[0.98]"
              >
                {sharing === 'jpeg' ? <Spinner size="sm" /> : 'JPEG'}
              </button>
              <button
                type="button"
                onClick={() => shareReceipt('pdf')}
                disabled={!!sharing}
                className="flex-1 flex items-center justify-center gap-1.5 py-3.5 rounded-2xl bg-[#d4a843] text-black text-sm font-semibold hover:bg-[#c49938] transition-colors disabled:opacity-50 active:scale-[0.98]"
              >
                {sharing === 'pdf' ? <Spinner size="sm" /> : 'PDF'}
              </button>
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                disabled={!!sharing}
                className="px-4 py-3.5 rounded-2xl bg-white/8 text-white/50 text-sm hover:bg-white/12 transition-colors disabled:opacity-50"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
