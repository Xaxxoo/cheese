'use client';

import { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Key,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Webhook as WebhookIcon,
  X,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  MerchantButton,
  MerchantInput,
  EmptyState,
} from '@/features/merchant/components/shared/primitives';
import {
  useMerchantApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
  useMerchantWebhooks,
  useCreateWebhook,
  useUpdateWebhook,
  useDeleteWebhook,
  useMerchantWebhookDeliveries,
} from '@/features/merchant/hooks/use-merchant-data';
import type { ApiKey, Webhook, WebhookDelivery } from '@/features/merchant/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_SCOPES = [
  { value: 'payments:read',    label: 'payments:read' },
  { value: 'payments:write',   label: 'payments:write' },
  { value: 'settlements:read', label: 'settlements:read' },
  { value: 'webhooks:read',    label: 'webhooks:read' },
  { value: 'webhooks:write',   label: 'webhooks:write' },
];

const ALL_EVENTS = [
  { value: 'payment.created',      label: 'payment.created' },
  { value: 'payment.confirmed',    label: 'payment.confirmed' },
  { value: 'payment.settled',      label: 'payment.settled' },
  { value: 'payment.failed',       label: 'payment.failed' },
  { value: 'payment.expired',      label: 'payment.expired' },
  { value: 'settlement.queued',    label: 'settlement.queued' },
  { value: 'settlement.completed', label: 'settlement.completed' },
  { value: 'settlement.failed',    label: 'settlement.failed' },
];

// ── Local UI primitives ───────────────────────────────────────────────────────

function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'positive' | 'negative' | 'neutral' | 'warning';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        tone === 'positive' && 'bg-emerald-500/10 text-emerald-500',
        tone === 'negative' && 'bg-rose-500/10 text-rose-400',
        tone === 'warning'  && 'bg-amber-500/10 text-amber-500',
        tone === 'neutral'  && 'bg-[color:var(--merchant-panel-strong)] text-[color:var(--merchant-muted)]',
      )}
    >
      {children}
    </span>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[color:var(--merchant-muted)] transition-colors hover:bg-[color:var(--merchant-panel-strong)] hover:text-[color:var(--merchant-text)]"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function CheckboxGroup({
  options,
  selected,
  onChange,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(value: string) {
    onChange(
      selected.includes(value) ? selected.filter((s) => s !== value) : [...selected, value],
    );
  }

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {options.map((opt) => (
        <label
          key={opt.value}
          className={cn(
            'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 transition-colors',
            selected.includes(opt.value)
              ? 'border-[color:var(--merchant-strong-border)] bg-[color:var(--merchant-panel-strong)]'
              : 'border-[color:var(--merchant-border)] hover:bg-[color:var(--merchant-panel-strong)]',
          )}
        >
          <input
            type="checkbox"
            className="h-3.5 w-3.5 shrink-0 rounded"
            checked={selected.includes(opt.value)}
            onChange={() => toggle(opt.value)}
          />
          <code className="text-[11px] text-[color:var(--merchant-text)]">{opt.label}</code>
        </label>
      ))}
    </div>
  );
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[color:var(--merchant-border)] px-6 py-4">
          <h2 className="text-base font-semibold text-[color:var(--merchant-text)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[color:var(--merchant-muted)] transition-colors hover:bg-[color:var(--merchant-panel-strong)] hover:text-[color:var(--merchant-text)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ── Card section header ───────────────────────────────────────────────────────

function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[color:var(--merchant-border)] px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-[color:var(--merchant-text)]">{title}</h2>
        <p className="mt-0.5 text-xs leading-5 text-[color:var(--merchant-muted)]">{description}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function RowSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="divide-y divide-[color:var(--merchant-border)]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <div className="h-3.5 w-32 animate-pulse rounded bg-[color:var(--merchant-border)]" />
          <div className="h-3.5 w-24 animate-pulse rounded bg-[color:var(--merchant-border)]" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-[color:var(--merchant-border)]" />
          <div className="ml-auto h-3.5 w-16 animate-pulse rounded bg-[color:var(--merchant-border)]" />
        </div>
      ))}
    </div>
  );
}

// ── Table head ────────────────────────────────────────────────────────────────

function TableHead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="border-b border-[color:var(--merchant-border)]">
        {cols.map((col) => (
          <th
            key={col}
            className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[color:var(--merchant-muted)]"
          >
            {col}
          </th>
        ))}
      </tr>
    </thead>
  );
}

// ── API Keys tab ──────────────────────────────────────────────────────────────

function GenerateKeyModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['payments:read']);
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const createKey = useCreateApiKey();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || scopes.length === 0) return;
    const result = await createKey.mutateAsync({ name: name.trim(), scopes });
    setRawKey(result.apiKey.rawKey ?? null);
  }

  if (rawKey) {
    return (
      <Modal title="Save your API key" onClose={onClose}>
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-xs leading-5 text-amber-500/80">
              This key is shown once. Copy it now — you won't be able to see it again.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-[color:var(--merchant-border)] bg-[color:var(--merchant-input-bg)] px-3 py-2.5">
            <code className="flex-1 truncate text-xs text-[color:var(--merchant-text)]">
              {rawKey}
            </code>
            <CopyButton value={rawKey} />
          </div>
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 shrink-0 rounded"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span className="text-xs text-[color:var(--merchant-muted)]">
              I've copied this key and stored it securely
            </span>
          </label>
          <MerchantButton
            variant="primary"
            className="w-full"
            disabled={!confirmed}
            onClick={onClose}
          >
            Done
          </MerchantButton>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Generate API key" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <MerchantInput
          label="Key name"
          placeholder="e.g. Production server"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <div className="space-y-2">
          <p className="text-xs font-medium text-[color:var(--merchant-soft-text)]">Scopes</p>
          <CheckboxGroup options={ALL_SCOPES} selected={scopes} onChange={setScopes} />
        </div>
        <MerchantButton
          type="submit"
          variant="primary"
          className="w-full"
          loading={createKey.isPending}
          disabled={!name.trim() || scopes.length === 0 || createKey.isPending}
        >
          Generate key
        </MerchantButton>
      </form>
    </Modal>
  );
}

function RevokeConfirmModal({
  keyName,
  onConfirm,
  onClose,
  pending,
}: {
  keyName: string;
  onConfirm: () => void;
  onClose: () => void;
  pending: boolean;
}) {
  return (
    <Modal title="Revoke API key" onClose={onClose}>
      <div className="space-y-5">
        <p className="text-sm text-[color:var(--merchant-muted)]">
          Revoke{' '}
          <span className="font-semibold text-[color:var(--merchant-text)]">{keyName}</span>?
          Any requests using this key will immediately fail.
        </p>
        <div className="flex gap-2">
          <MerchantButton variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </MerchantButton>
          <MerchantButton
            variant="danger"
            className="flex-1"
            loading={pending}
            disabled={pending}
            onClick={onConfirm}
          >
            Revoke
          </MerchantButton>
        </div>
      </div>
    </Modal>
  );
}

function RevokeCell({ apiKeyId, keyName }: { apiKeyId: string; keyName: string }) {
  const [open, setOpen] = useState(false);
  const revoke = useRevokeApiKey();

  async function handleRevoke() {
    await revoke.mutateAsync(apiKeyId);
    setOpen(false);
  }

  return (
    <>
      <MerchantButton size="sm" variant="danger" onClick={() => setOpen(true)}>
        <Trash2 className="h-3 w-3" />
        Revoke
      </MerchantButton>
      {open && (
        <RevokeConfirmModal
          keyName={keyName}
          onConfirm={handleRevoke}
          onClose={() => setOpen(false)}
          pending={revoke.isPending}
        />
      )}
    </>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function ApiKeysTab() {
  const { data, isLoading } = useMerchantApiKeys();
  const [showGenerate, setShowGenerate] = useState(false);
  const [revokedOpen, setRevokedOpen] = useState(false);

  const active  = data?.active  ?? [];
  const revoked = data?.revoked ?? [];

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)]">
        <CardHeader
          title="API Keys"
          description="Use API keys to authenticate server-to-server requests."
          action={
            <MerchantButton size="sm" onClick={() => setShowGenerate(true)}>
              <Plus className="h-3.5 w-3.5" />
              Generate key
            </MerchantButton>
          }
        />

        {isLoading ? (
          <RowSkeleton />
        ) : active.length === 0 ? (
          <EmptyState
            icon={<Key className="h-5 w-5" />}
            title="No active API keys"
            description="Generate a key to start authenticating API requests."
            action={
              <MerchantButton size="sm" onClick={() => setShowGenerate(true)}>
                <Plus className="h-3.5 w-3.5" />
                Generate key
              </MerchantButton>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <TableHead cols={['Name', 'Key prefix', 'Scopes', 'Last used', 'Created', '']} />
              <tbody className="divide-y divide-[color:var(--merchant-border)]">
                {active.map((k) => (
                  <tr
                    key={k.id}
                    className="transition-colors hover:bg-[color:var(--merchant-panel-strong)]"
                  >
                    <td className="px-5 py-3 text-sm font-medium text-[color:var(--merchant-text)]">
                      {k.name}
                    </td>
                    <td className="px-5 py-3">
                      <code className="font-mono text-xs text-[color:var(--merchant-muted)]">
                        {k.prefix}…
                      </code>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {k.scopes.map((s) => (
                          <Badge key={s} tone="neutral">{s}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-[color:var(--merchant-muted)]">
                      {k.lastUsedAt ? fmtDate(k.lastUsedAt) : 'Never'}
                    </td>
                    <td className="px-5 py-3 text-xs text-[color:var(--merchant-muted)]">
                      {fmtDate(k.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <RevokeCell apiKeyId={k.id} keyName={k.name} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Revoked keys (collapsible) */}
      {revoked.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setRevokedOpen((o) => !o)}
            className="flex items-center gap-1.5 text-xs font-medium text-[color:var(--merchant-muted)] transition-colors hover:text-[color:var(--merchant-text)]"
          >
            {revokedOpen
              ? <ChevronDown className="h-3.5 w-3.5" />
              : <ChevronRight className="h-3.5 w-3.5" />
            }
            {revoked.length} revoked key{revoked.length !== 1 ? 's' : ''}
          </button>

          {revokedOpen && (
            <div className="mt-3 overflow-hidden rounded-xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)]">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <TableHead cols={['Name', 'Key prefix', 'Scopes', 'Revoked', 'Created']} />
                  <tbody className="divide-y divide-[color:var(--merchant-border)]">
                    {revoked.map((k) => (
                      <tr key={k.id} className="opacity-50">
                        <td className="px-5 py-3 text-sm font-medium text-[color:var(--merchant-text)] line-through">
                          {k.name}
                        </td>
                        <td className="px-5 py-3">
                          <code className="font-mono text-xs text-[color:var(--merchant-muted)]">
                            {k.prefix}…
                          </code>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-1">
                            {k.scopes.map((s) => (
                              <Badge key={s} tone="neutral">{s}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs text-[color:var(--merchant-muted)]">
                          {k.revokedAt ? fmtDate(k.revokedAt) : '—'}
                        </td>
                        <td className="px-5 py-3 text-xs text-[color:var(--merchant-muted)]">
                          {fmtDate(k.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {showGenerate && <GenerateKeyModal onClose={() => setShowGenerate(false)} />}
    </>
  );
}

// ── Webhooks tab ──────────────────────────────────────────────────────────────

function WebhookFormModal({
  initial,
  onClose,
}: {
  initial?: Webhook;
  onClose: () => void;
}) {
  const isEdit = !!initial;
  const [url, setUrl] = useState(initial?.url ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [events, setEvents] = useState<string[]>(initial?.events ?? []);
  const createWebhook = useCreateWebhook();
  const updateWebhook = useUpdateWebhook();
  const isPending = createWebhook.isPending || updateWebhook.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || events.length === 0) return;

    if (isEdit && initial) {
      await updateWebhook.mutateAsync({
        id: initial.id,
        url: url.trim(),
        description: description.trim() || undefined,
        events,
      });
    } else {
      await createWebhook.mutateAsync({
        url: url.trim(),
        description: description.trim() || undefined,
        events,
      });
    }
    onClose();
  }

  return (
    <Modal title={isEdit ? 'Edit endpoint' : 'Add endpoint'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <MerchantInput
          label="Endpoint URL"
          type="url"
          placeholder="https://example.com/webhooks"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          autoFocus
        />
        <MerchantInput
          label="Description (optional)"
          placeholder="e.g. Payment notifications"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="space-y-2">
          <p className="text-xs font-medium text-[color:var(--merchant-soft-text)]">
            Events to listen to
          </p>
          <CheckboxGroup options={ALL_EVENTS} selected={events} onChange={setEvents} />
        </div>
        <div className="flex gap-2">
          <MerchantButton type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </MerchantButton>
          <MerchantButton
            type="submit"
            variant="primary"
            className="flex-1"
            loading={isPending}
            disabled={!url.trim() || events.length === 0 || isPending}
          >
            {isEdit ? 'Save changes' : 'Add endpoint'}
          </MerchantButton>
        </div>
      </form>
    </Modal>
  );
}

function DeliveryLog({ webhookId }: { webhookId: string }) {
  const { data, isLoading, refetch, isFetching } = useMerchantWebhookDeliveries(webhookId);
  const deliveries: WebhookDelivery[] = data?.deliveries ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[color:var(--merchant-muted)]">
          Recent deliveries
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-1 text-[10px] text-[color:var(--merchant-muted)] transition-colors hover:text-[color:var(--merchant-text)]"
        >
          <RefreshCw className={cn('h-3 w-3', isFetching && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-lg bg-[color:var(--merchant-border)]" />
          ))}
        </div>
      ) : deliveries.length === 0 ? (
        <p className="py-4 text-center text-xs text-[color:var(--merchant-muted)]">
          No deliveries yet
        </p>
      ) : (
        <div className="divide-y divide-[color:var(--merchant-border)] rounded-lg border border-[color:var(--merchant-border)]">
          {deliveries.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-3 py-2.5 text-xs">
              <Badge tone={d.success ? 'positive' : 'negative'}>
                {d.responseStatus ?? '—'}
              </Badge>
              <code className="flex-1 truncate font-mono text-[color:var(--merchant-muted)]">
                {d.event}
              </code>
              <span className="shrink-0 text-[color:var(--merchant-muted)]">
                {new Date(d.createdAt).toLocaleString('en', {
                  month: 'short', day: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WebhookCard({ webhook }: { webhook: Webhook }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [showDeliveries, setShowDeliveries] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const updateWebhook = useUpdateWebhook();
  const deleteWebhook = useDeleteWebhook();

  async function handleToggle() {
    await updateWebhook.mutateAsync({ id: webhook.id, enabled: !webhook.enabled });
  }

  async function handleDelete() {
    await deleteWebhook.mutateAsync(webhook.id);
    setDeleteOpen(false);
  }

  return (
    <>
      <div className="space-y-4 rounded-xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-bg)] p-4">
        {/* URL + status + actions */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <code className="break-all font-mono text-sm font-medium text-[color:var(--merchant-text)]">
                {webhook.url}
              </code>
              <Badge tone={webhook.enabled ? 'positive' : 'neutral'}>
                {webhook.enabled ? 'enabled' : 'disabled'}
              </Badge>
            </div>
            {webhook.description && (
              <p className="mt-1 text-xs text-[color:var(--merchant-muted)]">
                {webhook.description}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggle}
              disabled={updateWebhook.isPending}
              aria-label={webhook.enabled ? 'Disable webhook' : 'Enable webhook'}
              className={cn(
                'relative inline-flex h-5 w-9 rounded-full transition-colors disabled:opacity-50',
                webhook.enabled ? 'bg-emerald-500' : 'bg-[color:var(--merchant-panel-strong)]',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                  webhook.enabled ? 'translate-x-4' : 'translate-x-0.5',
                )}
              />
            </button>
            <MerchantButton size="sm" variant="ghost" onClick={() => setEditOpen(true)}>
              Edit
            </MerchantButton>
            <MerchantButton size="sm" variant="danger" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-3.5 w-3.5" />
            </MerchantButton>
          </div>
        </div>

        {/* Event badges */}
        <div className="flex flex-wrap gap-1">
          {webhook.events.map((ev) => (
            <Badge key={ev} tone="neutral">{ev}</Badge>
          ))}
        </div>

        {/* Last delivery status */}
        {webhook.lastDelivery && (
          <div className="flex items-center gap-2 text-xs text-[color:var(--merchant-muted)]">
            <Badge tone={webhook.lastDelivery.success ? 'positive' : 'negative'}>
              {webhook.lastDelivery.responseStatus ?? '—'}
            </Badge>
            Last delivery: {webhook.lastDelivery.event}
            {' · '}
            {new Date(webhook.lastDelivery.createdAt).toLocaleString('en', {
              month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </div>
        )}

        {/* Signing secret */}
        {webhook.secret && (
          <div className="flex items-center gap-2 rounded-lg border border-[color:var(--merchant-border)] bg-[color:var(--merchant-input-bg)] px-3 py-2">
            <span className="shrink-0 text-xs text-[color:var(--merchant-muted)]">Secret</span>
            <code className="flex-1 truncate font-mono text-xs text-[color:var(--merchant-text)]">
              {showSecret ? webhook.secret : '••••••••••••••••••••••••'}
            </code>
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="shrink-0 text-[color:var(--merchant-muted)] transition-colors hover:text-[color:var(--merchant-text)]"
            >
              {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
            <CopyButton value={webhook.secret} />
          </div>
        )}

        {/* Delivery log */}
        <button
          type="button"
          onClick={() => setShowDeliveries((v) => !v)}
          className="flex items-center gap-1 text-xs font-medium text-[color:var(--merchant-muted)] transition-colors hover:text-[color:var(--merchant-text)]"
        >
          {showDeliveries
            ? <ChevronDown className="h-3.5 w-3.5" />
            : <ChevronRight className="h-3.5 w-3.5" />
          }
          View deliveries
        </button>

        {showDeliveries && <DeliveryLog webhookId={webhook.id} />}
      </div>

      {editOpen && (
        <WebhookFormModal initial={webhook} onClose={() => setEditOpen(false)} />
      )}

      {deleteOpen && (
        <Modal title="Delete endpoint" onClose={() => setDeleteOpen(false)}>
          <div className="space-y-5">
            <p className="text-sm text-[color:var(--merchant-muted)]">
              Delete{' '}
              <code className="font-mono text-xs text-[color:var(--merchant-text)]">
                {webhook.url}
              </code>
              ? All delivery history will be permanently removed.
            </p>
            <div className="flex gap-2">
              <MerchantButton
                variant="secondary"
                className="flex-1"
                onClick={() => setDeleteOpen(false)}
              >
                Cancel
              </MerchantButton>
              <MerchantButton
                variant="danger"
                className="flex-1"
                loading={deleteWebhook.isPending}
                disabled={deleteWebhook.isPending}
                onClick={handleDelete}
              >
                Delete
              </MerchantButton>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function WebhooksTab() {
  const { data, isLoading } = useMerchantWebhooks();
  const [showForm, setShowForm] = useState(false);
  const webhooks: Webhook[] = data?.webhooks ?? [];

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)]">
        <CardHeader
          title="Webhooks"
          description="Receive real-time event notifications at your HTTPS endpoints."
          action={
            <MerchantButton size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5" />
              Add endpoint
            </MerchantButton>
          }
        />

        {isLoading ? (
          <RowSkeleton />
        ) : webhooks.length === 0 ? (
          <EmptyState
            icon={<WebhookIcon className="h-5 w-5" />}
            title="No webhook endpoints"
            description="Add an endpoint to start receiving real-time event notifications."
            action={
              <MerchantButton size="sm" onClick={() => setShowForm(true)}>
                <Plus className="h-3.5 w-3.5" />
                Add endpoint
              </MerchantButton>
            }
          />
        ) : (
          <div className="space-y-3 p-4">
            {webhooks.map((w) => (
              <WebhookCard key={w.id} webhook={w} />
            ))}
          </div>
        )}
      </div>

      {showForm && <WebhookFormModal onClose={() => setShowForm(false)} />}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'api-keys' | 'webhooks';

export default function DeveloperPage() {
  const [tab, setTab] = useState<Tab>('api-keys');

  return (
    <div className="space-y-8 p-6 md:p-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[color:var(--merchant-text)]">
          Developer
        </h1>
        <p className="mt-1 text-sm text-[color:var(--merchant-muted)]">
          Manage API keys and webhook endpoints for programmatic access.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex w-fit gap-1 rounded-xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] p-1">
        {(
          [
            { id: 'api-keys' as Tab, label: 'API Keys', Icon: Key },
            { id: 'webhooks' as Tab, label: 'Webhooks', Icon: WebhookIcon },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-medium transition-all',
              tab === id
                ? 'bg-[color:var(--merchant-panel-strong)] text-[color:var(--merchant-text)] shadow-sm'
                : 'text-[color:var(--merchant-muted)] hover:text-[color:var(--merchant-text)]',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'api-keys' ? <ApiKeysTab /> : <WebhooksTab />}
    </div>
  );
}
