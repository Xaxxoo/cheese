'use client'

import { useEffect } from 'react'
import {
  X, Share2, Copy, CheckCheck,
  ArrowUpRight, ArrowDownLeft, Building2,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/cn'
import { notify } from '@/lib/toast'
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

// ── Receipt text builder ─────────────────────────────────────
function buildReceiptText(tx: Transaction): string {
  const isIn = tx.type === 'deposit' || tx.type === 'yield_credit' || tx.type === 'referral_bonus'
  const sign  = isIn ? '+' : '-'
  const date  = new Date(tx.createdAt).toLocaleString('en-NG', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const lines: string[] = [
    '🧀 CHEESE PAY — RECEIPT',
    '──────────────────────────',
    `Type:       ${TX_LABELS[tx.type] ?? tx.type}`,
    `Amount:     ${sign}$${parseFloat(tx.amountUsdc).toFixed(2)} USDC`,
  ]

  if (tx.amountNgn) {
    lines.push(`NGN:        ₦${parseFloat(tx.amountNgn).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`)
  }

  lines.push(
    `Status:     ${STATUS_STYLE[tx.status]?.label ?? tx.status}`,
    `Date:       ${date}`,
    '──────────────────────────',
  )

  if (tx.recipientName)    lines.push(`Recipient:  ${tx.recipientName}`)
  if (tx.recipientUsername) lines.push(`To:         @${tx.recipientUsername}`)
  if (tx.recipientAddress) lines.push(`Address:    ${tx.recipientAddress}`)
  if (tx.bank)             lines.push(`Bank:       ${tx.bank}`)
  if (tx.accountNumber)    lines.push(`Account:    ${tx.accountNumber}`)
  if (tx.network)          lines.push(`Network:    ${tx.network}`)
  if (tx.txHash)           lines.push(`Tx Hash:    ${tx.txHash}`)

  lines.push(
    `Reference:  ${tx.reference}`,
    '──────────────────────────',
    'Powered by Cheese Pay',
  )

  return lines.join('\n')
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
  const [copied, setCopied] = useState(false)

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

  const date = new Date(tx.createdAt).toLocaleString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  async function handleShare() {
    const text = buildReceiptText(tx!)
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Cheese Pay Receipt', text })
        return
      } catch { /* user cancelled or not supported */ }
    }
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
      notify.success('Receipt copied to clipboard')
    } catch {
      notify.error('Could not share receipt')
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl flex flex-col"
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
          <button
            type="button"
            onClick={handleShare}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#d4a843] text-black text-sm font-semibold hover:bg-[#c49938] transition-colors active:scale-[0.98]"
          >
            {copied
              ? <><CheckCheck size={16} /> Copied to clipboard</>
              : <><Share2 size={16} /> Share Receipt</>
            }
          </button>
        </div>
      </div>
    </>
  )
}
