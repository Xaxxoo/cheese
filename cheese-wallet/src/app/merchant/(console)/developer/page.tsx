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
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Webhook as WebhookIcon,
  X,
} from 'lucide-react';
import { cn } from '@/lib/cn';
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
  { value: 'payments:read',    label: 'Payments — read' },
  { value: 'payments:write',   label: 'Payments — write' },
  { value: 'settlements:read', label: 'Settlements — read' },
  { value: 'webhooks:read',    label: 'Webhooks — read' },
  { value: 'webhooks:write',   label: 'Webhooks — write' },
];

const ALL_EVENTS = [
  { value: 'payment.created',       label: 'payment.created' },
  { value: 'payment.confirmed',     label: 'payment.confirmed' },
  { value: 'payment.settled',       label: 'payment.settled' },
  { value: 'payment.failed',        label: 'payment.failed' },
  { value: 'payment.expired',       label: 'payment.expired' },
  { value: 'settlement.queued',     label: 'settlement.queued' },
  { value: 'settlement.completed',  label: 'settlement.completed' },
  { value: 'settlement.failed',     label: 'settlement.failed' },
];

// ── Shared UI primitives ──────────────────────────────────────────────────────

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] p-5',
        className,
      )}
    >
      {children}
    </div>
  );
}

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
        tone === 'positive' && 'bg-emerald-500/12 text-emerald-500',
        tone === 'negative' && 'bg-red-500/12 text-red-500',
        tone === 'warning'  && 'bg-amber-500/12 text-amber-500',
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
    <div className="space-y-2">
      {options.map((opt) => (
        <label
          key={opt.value}
          className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[color:var(--merchant-border)] px-3 py-2 transition-colors hover:bg-[color:var(--merchant-panel-strong)]"
        >
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded accent-[#D4A843]"
            checked={selected.includes(opt.value)}
            onChange={() => toggle(opt.value)}
          />
          <span className="font-mono text-xs text-[color:var(--merchant-text)]">{opt.label}</span>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-side)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[color:var(--merchant-border)] px-5 py-4">
          <h2 className="text-sm font-semibold text-[color:var(--merchant-text)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[color:var(--merchant-muted)] transition-colors hover:bg-[color:var(--merchant-panel-strong)] hover:text-[color:var(--merchant-text)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
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
          <p className="text-xs text-[color:var(--merchant-muted)]">
            This key will only be shown once. Copy it now and store it securely.
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] px-3 py-2">
            <code className="flex-1 truncate font-mono text-xs text-[color:var(--merchant-text)]">
              {rawKey}
            </code>
            <CopyButton value={rawKey} />
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded accent-[#D4A843]"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span className="text-xs text-[color:var(--merchant-muted)]">
              I've copied this key and stored it safely
            </span>
          </label>
          <button
            type="button"
            disabled={!confirmed}
            onClick={onClose}
            className="w-full rounded-lg bg-[#D4A843] py-2 text-sm font-semibold text-[#09090C] transition-opacity disabled:opacity-40"
          >
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Generate API key" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[color:var(--merchant-text)]">
            Key name
          </label>
          <input
            type="text"
            placeholder="e.g. Production server"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] px-3 py-2 text-sm text-[color:var(--merchant-text)] placeholder:text-[color:var(--merchant-muted)] focus:outline-none focus:ring-2 focus:ring-[#D4A843]/40"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[color:var(--merchant-text)]">
            Scopes
          </label>
          <CheckboxGroup options={ALL_SCOPES} selected={scopes} onChange={setScopes} />
        </div>
        <button
          type="submit"
          disabled={!name.trim() || scopes.length === 0 || createKey.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#D4A843] py-2 text-sm font-semibold text-[#09090C] transition-opacity disabled:opacity-40"
        >
          {createKey.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Generate key
        </button>
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
      <div className="space-y-4">
        <p className="text-sm text-[color:var(--merchant-muted)]">
          Are you sure you want to revoke <span className="font-semibold text-[color:var(--merchant-text)]">{keyName}</span>?
          Any requests using this key will immediately fail.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-[color:var(--merchant-border)] py-2 text-sm font-medium text-[color:var(--merchant-muted)] transition-colors hover:bg-[color:var(--merchant-panel-strong)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
          >
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Revoke
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ApiKeyRow({ apiKey }: { apiKey: ApiKey }) {
  const [revokeTarget, setRevokeTarget] = useState(false);
  const revoke = useRevokeApiKey();
  const isRevoked = !!apiKey.revokedAt;

  async function handleRevoke() {
    await revoke.mutateAsync(apiKey.id);
    setRevokeTarget(false);
  }

  return (
    <>
      <tr className="border-t border-[color:var(--merchant-border)] text-xs">
        <td className="py-3 pr-4 font-medium text-[color:var(--merchant-text)]">{apiKey.name}</td>
        <td className="py-3 pr-4">
          <code className="font-mono text-[color:var(--merchant-muted)]">{apiKey.prefix}…</code>
        </td>
        <td className="py-3 pr-4">
          <div className="flex flex-wrap gap-1">
            {apiKey.scopes.map((s) => (
              <Badge key={s} tone="neutral">{s}</Badge>
            ))}
          </div>
        </td>
        <td className="py-3 pr-4 text-[color:var(--merchant-muted)]">
          {apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toLocaleDateString() : 'Never'}
        </td>
        <td className="py-3 pr-4 text-[color:var(--merchant-muted)]">
          {new Date(apiKey.createdAt).toLocaleDateString()}
        </td>
        <td className="py-3">
          {!isRevoked && (
            <button
              type="button"
              onClick={() => setRevokeTarget(true)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/10"
            >
              <Trash2 className="h-3 w-3" />
              Revoke
            </button>
          )}
        </td>
      </tr>
      {revokeTarget && (
        <RevokeConfirmModal
          keyName={apiKey.name}
          onConfirm={handleRevoke}
          onClose={() => setRevokeTarget(false)}
          pending={revoke.isPending}
        />
      )}
    </>
  );
}

function ApiKeysTab() {
  const { data, isLoading } = useMerchantApiKeys();
  const [showGenerate, setShowGenerate] = useState(false);
  const [revokedOpen, setRevokedOpen] = useState(false);

  const active  = data?.active  ?? [];
  const revoked = data?.revoked ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[color:var(--merchant-text)]">API Keys</p>
          <p className="text-xs text-[color:var(--merchant-muted)]">
            Use API keys to authenticate server-to-server requests.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowGenerate(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#D4A843] px-3 py-1.5 text-xs font-semibold text-[#09090C] transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          Generate key
        </button>
      </div>

      <Panel className="overflow-hidden p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-[color:var(--merchant-muted)]" />
          </div>
        ) : active.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10">
            <Key className="h-8 w-8 text-[color:var(--merchant-muted)]" />
            <p className="text-sm text-[color:var(--merchant-muted)]">No active API keys</p>
            <button
              type="button"
              onClick={() => setShowGenerate(true)}
              className="mt-1 text-xs font-medium text-[#D4A843] hover:underline"
            >
              Generate your first key
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-[10px] font-semibold uppercase tracking-widest text-[color:var(--merchant-muted)]">
                  <th className="px-5 py-3">Name</th>
                  <th className="py-3 pr-4">Key prefix</th>
                  <th className="py-3 pr-4">Scopes</th>
                  <th className="py-3 pr-4">Last used</th>
                  <th className="py-3 pr-4">Created</th>
                  <th className="py-3" />
                </tr>
              </thead>
              <tbody className="px-5">
                {active.map((k) => (
                  <tr key={k.id} className="border-t border-[color:var(--merchant-border)] text-xs">
                    <td className="px-5 py-3 font-medium text-[color:var(--merchant-text)]">{k.name}</td>
                    <td className="py-3 pr-4">
                      <code className="font-mono text-[color:var(--merchant-muted)]">{k.prefix}…</code>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {k.scopes.map((s) => (
                          <Badge key={s} tone="neutral">{s}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-[color:var(--merchant-muted)]">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="py-3 pr-4 text-[color:var(--merchant-muted)]">
                      {new Date(k.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 pr-5">
                      <RevokeCell apiKeyId={k.id} keyName={k.name} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Revoked keys */}
      {revoked.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setRevokedOpen((o) => !o)}
            className="flex items-center gap-1.5 text-xs font-medium text-[color:var(--merchant-muted)] hover:text-[color:var(--merchant-text)]"
          >
            {revokedOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {revoked.length} revoked key{revoked.length !== 1 ? 's' : ''}
          </button>
          {revokedOpen && (
            <Panel className="mt-2 overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-[10px] font-semibold uppercase tracking-widest text-[color:var(--merchant-muted)]">
                      <th className="px-5 py-3">Name</th>
                      <th className="py-3 pr-4">Key prefix</th>
                      <th className="py-3 pr-4">Scopes</th>
                      <th className="py-3 pr-4">Revoked</th>
                      <th className="py-3 pr-4">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revoked.map((k) => (
                      <tr key={k.id} className="border-t border-[color:var(--merchant-border)] text-xs opacity-60">
                        <td className="px-5 py-3 font-medium text-[color:var(--merchant-text)] line-through">{k.name}</td>
                        <td className="py-3 pr-4">
                          <code className="font-mono text-[color:var(--merchant-muted)]">{k.prefix}…</code>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-wrap gap-1">
                            {k.scopes.map((s) => (
                              <Badge key={s} tone="neutral">{s}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-[color:var(--merchant-muted)]">
                          {k.revokedAt ? new Date(k.revokedAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3 pr-4 text-[color:var(--merchant-muted)]">
                          {new Date(k.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </div>
      )}

      {showGenerate && <GenerateKeyModal onClose={() => setShowGenerate(false)} />}
    </div>
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/10"
      >
        <Trash2 className="h-3 w-3" />
        Revoke
      </button>
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
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[color:var(--merchant-text)]">
            Endpoint URL
          </label>
          <input
            type="url"
            placeholder="https://example.com/webhooks"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full rounded-lg border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] px-3 py-2 text-sm text-[color:var(--merchant-text)] placeholder:text-[color:var(--merchant-muted)] focus:outline-none focus:ring-2 focus:ring-[#D4A843]/40"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[color:var(--merchant-text)]">
            Description <span className="text-[color:var(--merchant-muted)]">(optional)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Payment notifications"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] px-3 py-2 text-sm text-[color:var(--merchant-text)] placeholder:text-[color:var(--merchant-muted)] focus:outline-none focus:ring-2 focus:ring-[#D4A843]/40"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[color:var(--merchant-text)]">
            Events to listen to
          </label>
          <CheckboxGroup options={ALL_EVENTS} selected={events} onChange={setEvents} />
        </div>
        <button
          type="submit"
          disabled={!url.trim() || events.length === 0 || isPending}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#D4A843] py-2 text-sm font-semibold text-[#09090C] transition-opacity disabled:opacity-40"
        >
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {isEdit ? 'Save changes' : 'Add endpoint'}
        </button>
      </form>
    </Modal>
  );
}

function DeliveryLog({ webhookId }: { webhookId: string }) {
  const { data, isLoading, refetch, isFetching } = useMerchantWebhookDeliveries(webhookId);
  const deliveries: WebhookDelivery[] = data?.deliveries ?? [];

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[color:var(--merchant-muted)]">Recent deliveries</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-1 text-[10px] text-[color:var(--merchant-muted)] hover:text-[color:var(--merchant-text)]"
        >
          <RefreshCw className={cn('h-3 w-3', isFetching && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-[color:var(--merchant-muted)]" />
        </div>
      ) : deliveries.length === 0 ? (
        <p className="py-4 text-center text-xs text-[color:var(--merchant-muted)]">No deliveries yet</p>
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
              <span className="text-[color:var(--merchant-muted)]">
                {new Date(d.createdAt).toLocaleString()}
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
      <Panel className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <code className="truncate font-mono text-sm font-medium text-[color:var(--merchant-text)]">
                {webhook.url}
              </code>
              <Badge tone={webhook.enabled ? 'positive' : 'neutral'}>
                {webhook.enabled ? 'enabled' : 'disabled'}
              </Badge>
            </div>
            {webhook.description && (
              <p className="mt-0.5 text-xs text-[color:var(--merchant-muted)]">{webhook.description}</p>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Enabled toggle */}
            <button
              type="button"
              onClick={handleToggle}
              disabled={updateWebhook.isPending}
              className={cn(
                'relative inline-flex h-5 w-9 rounded-full transition-colors',
                webhook.enabled ? 'bg-emerald-500' : 'bg-[color:var(--merchant-panel-strong)]',
              )}
              aria-label={webhook.enabled ? 'Disable webhook' : 'Enable webhook'}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                  webhook.enabled ? 'translate-x-4' : 'translate-x-0.5',
                )}
              />
            </button>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="rounded-md px-2 py-1 text-xs text-[color:var(--merchant-muted)] transition-colors hover:bg-[color:var(--merchant-panel-strong)] hover:text-[color:var(--merchant-text)]"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="rounded-md p-1 text-red-500 transition-colors hover:bg-red-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Events */}
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
            Last delivery: {webhook.lastDelivery.event} at{' '}
            {new Date(webhook.lastDelivery.createdAt).toLocaleString()}
          </div>
        )}

        {/* Signing secret */}
        {webhook.secret && (
          <div className="flex items-center gap-2 rounded-lg border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] px-3 py-2">
            <span className="text-xs text-[color:var(--merchant-muted)]">Signing secret:</span>
            <code className="flex-1 truncate font-mono text-xs text-[color:var(--merchant-text)]">
              {showSecret ? webhook.secret : '••••••••••••••••••••'}
            </code>
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="text-[color:var(--merchant-muted)] hover:text-[color:var(--merchant-text)]"
            >
              {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
            <CopyButton value={webhook.secret} />
          </div>
        )}

        {/* Delivery log toggle */}
        <button
          type="button"
          onClick={() => setShowDeliveries((v) => !v)}
          className="flex items-center gap-1 text-xs font-medium text-[color:var(--merchant-muted)] hover:text-[color:var(--merchant-text)]"
        >
          {showDeliveries ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          View deliveries
        </button>
        {showDeliveries && <DeliveryLog webhookId={webhook.id} />}
      </Panel>

      {editOpen && <WebhookFormModal initial={webhook} onClose={() => setEditOpen(false)} />}

      {deleteOpen && (
        <Modal title="Delete endpoint" onClose={() => setDeleteOpen(false)}>
          <div className="space-y-4">
            <p className="text-sm text-[color:var(--merchant-muted)]">
              Delete the endpoint at{' '}
              <code className="font-mono text-xs text-[color:var(--merchant-text)]">{webhook.url}</code>?
              All delivery history will be lost.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                className="flex-1 rounded-lg border border-[color:var(--merchant-border)] py-2 text-sm font-medium text-[color:var(--merchant-muted)] transition-colors hover:bg-[color:var(--merchant-panel-strong)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteWebhook.isPending}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
              >
                {deleteWebhook.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Delete
              </button>
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[color:var(--merchant-text)]">Webhooks</p>
          <p className="text-xs text-[color:var(--merchant-muted)]">
            Receive real-time event notifications at your HTTPS endpoints.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#D4A843] px-3 py-1.5 text-xs font-semibold text-[#09090C] transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          Add endpoint
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-[color:var(--merchant-muted)]" />
        </div>
      ) : webhooks.length === 0 ? (
        <Panel className="flex flex-col items-center gap-2 py-10">
          <WebhookIcon className="h-8 w-8 text-[color:var(--merchant-muted)]" />
          <p className="text-sm text-[color:var(--merchant-muted)]">No webhook endpoints</p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mt-1 text-xs font-medium text-[#D4A843] hover:underline"
          >
            Add your first endpoint
          </button>
        </Panel>
      ) : (
        <div className="space-y-3">
          {webhooks.map((w) => (
            <WebhookCard key={w.id} webhook={w} />
          ))}
        </div>
      )}

      {showForm && <WebhookFormModal onClose={() => setShowForm(false)} />}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'api-keys' | 'webhooks';

export default function DeveloperPage() {
  const [tab, setTab] = useState<Tab>('api-keys');

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-[color:var(--merchant-text)]">Developer</h1>
        <p className="mt-0.5 text-sm text-[color:var(--merchant-muted)]">
          Manage API keys and webhook endpoints for programmatic access.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] p-1 w-fit">
        {([
          { id: 'api-keys', label: 'API Keys',  icon: Key },
          { id: 'webhooks', label: 'Webhooks',  icon: WebhookIcon },
        ] as { id: Tab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
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
