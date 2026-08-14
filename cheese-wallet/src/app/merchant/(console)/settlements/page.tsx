'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Star, X, Building2, Wallet } from 'lucide-react';
import {
  useMerchantSettlements,
  useAddPayoutAccount,
  useUpdatePayoutAccount,
  useRemovePayoutAccount,
  useSetDefaultPayoutAccount,
} from '@/features/merchant/hooks/use-merchant-data';
import {
  MerchantButton,
  MetricCard,
  SectionCard,
  EmptyState,
} from '@/features/merchant/components/shared/primitives';
import { StatusBadge } from '@/features/merchant/components/shared/status-badge';
import { SettlementScheduleCard } from '@/features/merchant/components/settlements/settlement-schedule-card';
import { useMerchantAuthStore } from '@/features/merchant/store/merchant-auth-store';
import type { PayoutAccount } from '@/features/merchant/types';

// ── Status badge ─────────────────────────────────────────────────────────────

function PayoutAccountBadge({ status }: { status: 'active' | 'review' }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${
      status === 'active'
        ? 'bg-emerald-400/10 text-emerald-400'
        : 'bg-amber-400/10 text-amber-400'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      {status === 'active' ? 'Active' : 'Under review'}
    </span>
  );
}

// ── Add / Edit modal ──────────────────────────────────────────────────────────

interface ModalProps {
  account?: PayoutAccount | null   // null = add mode
  onClose: () => void
}

function PayoutAccountModal({ account, onClose }: ModalProps) {
  const isEdit = !!account;

  const [label, setLabel]               = useState(account?.label ?? '');
  const [accountType, setAccountType]   = useState<'bank' | 'digital_dollar'>(
    account?.accountType ?? 'bank',
  );
  const [currency, setCurrency]         = useState(account?.currency ?? 'NGN');
  const [bankName, setBankName]         = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [walletAddress, setWalletAddress] = useState(
    account?.accountType === 'digital_dollar' ? account.destination : '',
  );
  const [error, setError] = useState('');

  const addMut    = useAddPayoutAccount();
  const updateMut = useUpdatePayoutAccount();
  const isPending = addMut.isPending || updateMut.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!label.trim()) { setError('Label is required.'); return; }

    if (isEdit) {
      await updateMut.mutateAsync({ id: account!.id, label: label.trim() });
    } else {
      let destination = '';
      if (accountType === 'bank') {
        if (!bankName.trim() || !accountNumber.trim() || !accountHolder.trim()) {
          setError('All bank fields are required.'); return;
        }
        destination = `${bankName.trim()} – ${accountNumber.trim()} – ${accountHolder.trim()}`;
      } else {
        if (!walletAddress.trim()) { setError('Wallet address is required.'); return; }
        destination = walletAddress.trim();
      }
      await addMut.mutateAsync({ label: label.trim(), accountType, currency, destination });
    }

    onClose();
  }

  const inputCls =
    'w-full h-9 rounded-lg border border-[color:var(--merchant-border)] bg-[color:var(--merchant-bg)] px-3 text-sm text-[color:var(--merchant-text)] placeholder:text-[color:var(--merchant-muted)] focus:outline-none focus:border-[color:var(--merchant-action-bg)] transition-colors';

  const selectCls =
    'w-full h-9 rounded-lg border border-[color:var(--merchant-border)] bg-[color:var(--merchant-bg)] px-3 text-sm text-[color:var(--merchant-text)] focus:outline-none focus:border-[color:var(--merchant-action-bg)] transition-colors cursor-pointer';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md rounded-2xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[color:var(--merchant-border)]">
          <h2 className="text-base font-semibold text-[color:var(--merchant-text)]">
            {isEdit ? 'Rename account' : 'Add payout account'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[color:var(--merchant-muted)] hover:text-[color:var(--merchant-text)] hover:bg-[color:var(--merchant-panel-strong)] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Label */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[color:var(--merchant-muted)]">
              Account label
            </label>
            <input
              className={inputCls}
              placeholder="e.g. Main GTBank Account"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
            />
          </div>

          {/* Type + Currency (add mode only) */}
          {!isEdit && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {/* Account type */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[color:var(--merchant-muted)]">
                    Account type
                  </label>
                  <div className="flex rounded-lg border border-[color:var(--merchant-border)] overflow-hidden">
                    {(['bank', 'digital_dollar'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setAccountType(type)}
                        className={`flex-1 flex items-center justify-center gap-1.5 h-9 text-xs font-medium transition-colors ${
                          accountType === type
                            ? 'bg-[color:var(--merchant-action-bg)] text-[color:var(--merchant-action-fg)]'
                            : 'text-[color:var(--merchant-muted)] hover:bg-[color:var(--merchant-panel-strong)]'
                        }`}
                      >
                        {type === 'bank'
                          ? <><Building2 size={12} /> Bank</>
                          : <><Wallet size={12} /> Digital $</>
                        }
                      </button>
                    ))}
                  </div>
                </div>

                {/* Currency */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[color:var(--merchant-muted)]">
                    Currency
                  </label>
                  <select
                    className={selectCls}
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    <option value="NGN">NGN – Nigerian Naira</option>
                    <option value="USD">USD – Dollar</option>
                    <option value="EUR">EUR – Euro</option>
                    <option value="GBP">GBP – Pound</option>
                    <option value="USDC">USDC</option>
                  </select>
                </div>
              </div>

              {/* Bank fields */}
              {accountType === 'bank' && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[color:var(--merchant-muted)]">Bank name</label>
                    <input
                      className={inputCls}
                      placeholder="e.g. GTBank"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[color:var(--merchant-muted)]">Account number</label>
                    <input
                      className={inputCls}
                      placeholder="0123456789"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      maxLength={10}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[color:var(--merchant-muted)]">Account holder name</label>
                    <input
                      className={inputCls}
                      placeholder="John Doe"
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Digital dollar field */}
              {accountType === 'digital_dollar' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[color:var(--merchant-muted)]">
                    Wallet address
                  </label>
                  <input
                    className={`${inputCls} font-mono text-xs`}
                    placeholder="G... or 0x..."
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                  />
                  <p className="text-[11px] text-[color:var(--merchant-muted)]">
                    Supports Stellar (G…) and EVM (0x…) addresses.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-rose-400">{error}</p>
          )}

          {/* New accounts start in review */}
          {!isEdit && (
            <p className="text-[11px] text-[color:var(--merchant-muted)]">
              New accounts are placed under review before they can receive payouts.
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <MerchantButton
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onClose}
            >
              Cancel
            </MerchantButton>
            <MerchantButton
              type="submit"
              variant="primary"
              className="flex-1"
              loading={isPending}
              disabled={isPending}
            >
              {isEdit ? 'Save' : 'Add account'}
            </MerchantButton>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete confirmation ───────────────────────────────────────────────────────

function DeleteConfirm({ account, onClose }: { account: PayoutAccount; onClose: () => void }) {
  const removeMut = useRemovePayoutAccount();

  async function handleDelete() {
    await removeMut.mutateAsync(account.id);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] shadow-2xl p-6">
        <h2 className="text-base font-semibold text-[color:var(--merchant-text)] mb-1">
          Remove account?
        </h2>
        <p className="text-sm text-[color:var(--merchant-muted)] mb-5">
          <span className="font-medium text-[color:var(--merchant-text)]">{account.label}</span> will be
          removed. This cannot be undone.
        </p>
        <div className="flex gap-2">
          <MerchantButton type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </MerchantButton>
          <MerchantButton
            type="button"
            variant="danger"
            className="flex-1"
            loading={removeMut.isPending}
            disabled={removeMut.isPending}
            onClick={handleDelete}
          >
            Remove
          </MerchantButton>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MerchantSettlementsPage() {
  const { data, isLoading, isError } = useMerchantSettlements();
  const session = useMerchantAuthStore((s) => s.session);

  const setDefaultMut = useSetDefaultPayoutAccount();

  const [addOpen, setAddOpen]       = useState(false);
  const [editing, setEditing]       = useState<PayoutAccount | null>(null);
  const [deleting, setDeleting]     = useState<PayoutAccount | null>(null);

  return (
    <>
      {/* ── Modals ── */}
      {addOpen && <PayoutAccountModal onClose={() => setAddOpen(false)} />}
      {editing && <PayoutAccountModal account={editing} onClose={() => setEditing(null)} />}
      {deleting && <DeleteConfirm account={deleting} onClose={() => setDeleting(null)} />}

      <div className="space-y-8 p-6 md:p-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[color:var(--merchant-text)]">
            Settlements
          </h1>
          <p className="mt-1 text-sm text-[color:var(--merchant-muted)]">
            Payout history and account configuration.
          </p>
        </div>

        {/* Summary metrics */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-xl bg-[color:var(--merchant-panel)] animate-pulse border border-[color:var(--merchant-border)]"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {data?.summaries.map((s) => (
              <MetricCard key={s.label} label={s.label} amount={s.amount} trend={s.trend} tone={s.tone} />
            ))}
          </div>
        )}

        {/* FX rate callout */}
        {!isLoading && data && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)]">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-violet-400 flex-shrink-0">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
            </svg>
            <div className="text-sm">
              <span className="text-[color:var(--merchant-muted)]">Live rate: </span>
              <span className="font-medium text-[color:var(--merchant-text)]">{data.currentFxRate}</span>
              <span className="text-[color:var(--merchant-muted)] ml-3">{data.estimatedArrival}</span>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main: settlement history */}
          <div className="lg:col-span-2 space-y-6">
            <SectionCard title="Payout history">
              {isError ? (
                <EmptyState title="Could not load settlements" description="Try refreshing the page." />
              ) : isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-14 rounded-lg bg-[color:var(--merchant-border)] animate-pulse" />
                  ))}
                </div>
              ) : !data?.settlements.length ? (
                <EmptyState
                  title="No payouts yet"
                  description="Settlements will appear here once payments are confirmed and settled."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[color:var(--merchant-border)]">
                        {['Reference', 'Amount', 'Destination', 'Schedule', 'Status', 'Date'].map((col, i) => (
                          <th
                            key={col}
                            className={`px-4 py-2.5 text-xs font-medium text-[color:var(--merchant-muted)] ${i === 1 ? 'text-right' : ''}`}
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[color:var(--merchant-border)]">
                      {data.settlements.map((s) => (
                        <tr key={s.id} className="hover:bg-[color:var(--merchant-panel)] transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm font-mono text-[color:var(--merchant-text)]">{s.paymentReference}</div>
                            {s.bankReference && s.bankReference !== '—' && (
                              <div className="text-[10px] text-[color:var(--merchant-muted)] mt-0.5 font-mono">Bank: {s.bankReference}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <div className="text-sm font-medium text-[color:var(--merchant-text)]">{s.netAmount}</div>
                            <div className="text-xs text-[color:var(--merchant-muted)]">{s.grossAmount} gross</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-xs text-[color:var(--merchant-text)] max-w-[160px] truncate">{s.destination}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-xs capitalize text-[color:var(--merchant-muted)]">{s.schedule}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={s.status} /></td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-[color:var(--merchant-muted)]">
                            {new Date(s.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </div>

          {/* Right: payout accounts + settings */}
          <div className="space-y-6">
            <SectionCard
              title="Payout accounts"
              action={
                <MerchantButton
                  size="sm"
                  variant="secondary"
                  onClick={() => setAddOpen(true)}
                >
                  <Plus size={13} />
                  Add
                </MerchantButton>
              }
            >
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="h-16 rounded-lg bg-[color:var(--merchant-border)] animate-pulse" />
                  ))}
                </div>
              ) : !data?.payoutAccounts.length ? (
                <EmptyState
                  title="No accounts yet"
                  description="Add a bank or digital dollar account to receive payouts."
                  action={
                    <MerchantButton size="sm" onClick={() => setAddOpen(true)}>
                      <Plus size={13} />
                      Add account
                    </MerchantButton>
                  }
                />
              ) : (
                <div className="space-y-2.5">
                  {data.payoutAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="group rounded-lg border border-[color:var(--merchant-border)] bg-[color:var(--merchant-bg)] p-3"
                    >
                      {/* Top row: label + default badge + status */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-[color:var(--merchant-text)] truncate flex-1 min-w-0">
                          {account.label}
                        </span>
                        {account.defaultForInstantPayout && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-400/10 text-violet-400 flex-shrink-0">
                            Default
                          </span>
                        )}
                        <PayoutAccountBadge status={account.status} />
                      </div>

                      {/* Account details */}
                      <div className="text-xs text-[color:var(--merchant-muted)] capitalize mb-0.5">
                        {account.accountType.replace(/_/g, ' ')} · {account.currency}
                      </div>
                      <div className="text-xs text-[color:var(--merchant-muted)] font-mono truncate">
                        {account.destination}
                      </div>

                      {/* Actions — appear on hover */}
                      <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-[color:var(--merchant-border)] opacity-0 group-hover:opacity-100 transition-opacity">
                        {!account.defaultForInstantPayout && (
                          <button
                            type="button"
                            onClick={() => setDefaultMut.mutate(account.id)}
                            disabled={setDefaultMut.isPending}
                            className="flex items-center gap-1 text-[11px] text-[color:var(--merchant-muted)] hover:text-[color:var(--merchant-text)] transition-colors disabled:opacity-40"
                          >
                            <Star size={11} />
                            Set default
                          </button>
                        )}
                        <span className="flex-1" />
                        <button
                          type="button"
                          onClick={() => setEditing(account)}
                          className="flex items-center gap-1 text-[11px] text-[color:var(--merchant-muted)] hover:text-[color:var(--merchant-text)] transition-colors"
                        >
                          <Pencil size={11} />
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(account)}
                          className="flex items-center gap-1 text-[11px] text-[color:var(--merchant-muted)] hover:text-rose-400 transition-colors"
                        >
                          <Trash2 size={11} />
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* Settlement schedule config */}
            <SettlementScheduleCard
              currentMode={session?.merchant?.defaultSettlementMode ?? 'instant_fiat'}
              currentSchedule={session?.merchant?.payoutSchedule ?? 'instant'}
            />
          </div>
        </div>
      </div>
    </>
  );
}
