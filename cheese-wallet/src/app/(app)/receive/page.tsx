'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, Copy, CheckCheck, RefreshCw, Download, AlertTriangle,
} from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { useAuthStore } from '@/store/authStore'
import { getWalletAddress, getDepositNetworks } from '@/lib/api/wallet'
import { QUERY_KEYS, STALE_TIMES } from '@/constants'
import type { DepositNetwork, DepositToken, DepositTokenSymbol } from '@/types'
import { notify } from '@/lib/toast'

// ── Skeleton ───────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-white/8 rounded-xl animate-pulse', className)} />
}

// ── QR code via public API (public blockchain address) ─────
function QrCode({ value, size = 180 }: { value: string; size?: number }) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(value)}&size=${size}x${size}&bgcolor=1a1a1a&color=d4a843&margin=12&format=png`
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="QR code" width={size} height={size} className="rounded-2xl" />
  )
}

// ── Network info card ──────────────────────────────────────
function NetworkCard({ net }: { net: DepositNetwork }) {
  const assets = net.assets?.join(' / ') ?? net.asset
  const fee = net.fee === '0' || net.fee === '0.00' ? 'Free' : net.fee

  return (
    <div
      className="rounded-2xl border border-white/8 p-4"
      style={{ background: 'rgba(255,255,255,0.03)' }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">{net.name}</p>
          <p className="text-xs text-white/40 mt-0.5">{assets}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-white/60 font-medium">
            Fee: {fee}
          </p>
          <p className="text-[10px] text-white/30 mt-0.5">{net.estimatedTime}</p>
        </div>
      </div>
    </div>
  )
}

// ── Chain tabs definition ──────────────────────────────────
type EvmChainKey = 1 | 8453 | 42161 | 137 | 42220
type ChainKey = 'stellar' | EvmChainKey
type TokenSymbol = DepositTokenSymbol

const CHAIN_TABS: Array<{ key: ChainKey; label: string }> = [
  { key: 'stellar', label: 'Stellar'  },
  { key: 1,         label: 'Ethereum' },
  { key: 8453,      label: 'Base'     },
  { key: 42161,     label: 'Arbitrum' },
  { key: 137,       label: 'Polygon'  },
  { key: 42220,     label: 'Celo'     },
]

const EVM_CHAIN_KEYS = CHAIN_TABS
  .filter((tab): tab is { key: EvmChainKey; label: string } => tab.key !== 'stellar')
  .map((tab) => tab.key)

const FALLBACK_USDC_TOKEN: DepositToken = {
  symbol:   'USDC',
  address:  null,
  decimals: 6,
}

// ── Chain selector ─────────────────────────────────────────
function ChainSelector({
  selected,
  onSelect,
  availableEvmChainIds,
}: {
  selected: ChainKey
  onSelect: (c: ChainKey) => void
  availableEvmChainIds: number[]
}) {
  const visibleTabs = CHAIN_TABS.filter(
    (t) => t.key === 'stellar' || availableEvmChainIds.includes(t.key as number),
  )

  return (
    <div className="flex gap-1 w-full p-1 rounded-2xl bg-white/6 overflow-x-auto">
      {visibleTabs.map((t) => (
        <button
          key={String(t.key)}
          type="button"
          onClick={() => onSelect(t.key)}
          className={cn(
            'flex-shrink-0 flex-1 py-2 px-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap',
            selected === t.key
              ? 'bg-[#d4a843] text-black'
              : 'text-white/50 hover:text-white',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── Token selector ─────────────────────────────────────────
function TokenSelector({
  selected,
  onSelect,
  tokens,
}: {
  selected: TokenSymbol
  onSelect: (token: TokenSymbol) => void
  tokens: DepositToken[]
}) {
  const visibleTokens = tokens.length > 0 ? tokens : [FALLBACK_USDC_TOKEN]

  return (
    <div className="flex gap-2 w-full">
      {visibleTokens.map((token) => (
        <button
          key={token.symbol}
          type="button"
          onClick={() => onSelect(token.symbol)}
          className={cn(
            'flex-1 py-2 rounded-2xl border text-xs font-semibold transition-all',
            selected === token.symbol
              ? 'border-[#d4a843] bg-[#d4a843]/15 text-[#d4a843]'
              : 'border-white/8 bg-white/4 text-white/45 hover:text-white',
          )}
        >
          {token.symbol}
        </button>
      ))}
    </div>
  )
}

// ── Warning banner ─────────────────────────────────────────
function NetworkWarning({
  chainLabel,
  token,
  isEvmChain,
}: {
  chainLabel: string
  token: TokenSymbol
  isEvmChain: boolean
}) {
  return (
    <div className="w-full flex gap-2.5 rounded-2xl border border-amber-400/20 bg-amber-400/8 px-4 py-3">
      <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-200/80 leading-relaxed">
        Only send {token} on the{' '}
        <span className="font-semibold text-amber-300">{chainLabel} network</span>{' '}
        to this address. {isEvmChain
          ? 'EVM networks share one wallet address, but the selected network and token must still match.'
          : 'Sending any other asset may result in permanent loss.'}
      </p>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────
export default function ReceivePage() {
  const [copiedAddr, setCopiedAddr] = useState(false)
  const [copiedUser, setCopiedUser] = useState(false)
  const [activeTab, setActiveTab]   = useState<'address' | 'username'>('address')
  const [chain, setChain]           = useState<ChainKey>('stellar')
  const [token, setToken]           = useState<TokenSymbol>('USDC')

  const { user } = useAuthStore()

  const addrQ = useQuery({
    queryKey: QUERY_KEYS.ADDRESS,
    queryFn:  getWalletAddress,
    staleTime: STALE_TIMES.PROFILE,
    retry: 1,
  })

  const netsQ = useQuery({
    queryKey: QUERY_KEYS.DEPOSIT_NETWORKS,
    queryFn:  getDepositNetworks,
    staleTime: STALE_TIMES.PROFILE,
    retry: 1,
  })

  const stellarAddr = addrQ.data?.stellarAddress ?? ''
  const evmAddresses = addrQ.data?.evmAddresses ?? {}
  const configuredEvmChainIds = (netsQ.data ?? [])
    .filter((net) => net.networkType === 'evm' && typeof net.chainId === 'number')
    .map((net) => net.chainId as number)
  const availableEvmChainIds = Array.from(
    new Set([...configuredEvmChainIds, ...Object.keys(evmAddresses).map(Number)]),
  ).filter((chainId): chainId is EvmChainKey =>
    EVM_CHAIN_KEYS.includes(chainId as EvmChainKey),
  )
  const isEvmChain = chain !== 'stellar'
  const evmEntry = isEvmChain ? evmAddresses[chain as number] : null
  const selectedNetwork = (netsQ.data ?? []).find((net) =>
    chain === 'stellar'
      ? net.networkType === 'stellar' || net.id === 'stellar'
      : net.chainId === chain,
  )
  const supportedTokens = chain === 'stellar'
    ? [{ ...FALLBACK_USDC_TOKEN, decimals: 7 }]
    : evmEntry?.tokens?.length
      ? evmEntry.tokens
      : selectedNetwork?.tokens?.length
        ? selectedNetwork.tokens
        : [FALLBACK_USDC_TOKEN]
  const selectedToken = supportedTokens.some((item) => item.symbol === token)
    ? token
    : supportedTokens[0].symbol

  // Resolve active address for selected chain
  const activeAddr: string = (() => {
    if (chain === 'stellar') return stellarAddr
    return evmEntry?.address ?? ''
  })()

  // Resolve chain label for warning banner
  const chainLabel: string = (() => {
    if (chain === 'stellar') return 'Stellar'
    return CHAIN_TABS.find((t) => t.key === chain)?.label ?? 'EVM'
  })()

  const username = user?.username ?? ''

  async function copyAddress() {
    if (!activeAddr) return
    try {
      await navigator.clipboard.writeText(activeAddr)
      setCopiedAddr(true)
      setTimeout(() => setCopiedAddr(false), 2000)
    } catch {
      notify.error('Could not copy address')
    }
  }

  async function copyUsername() {
    if (!username) return
    try {
      await navigator.clipboard.writeText(`@${username}`)
      setCopiedUser(true)
      setTimeout(() => setCopiedUser(false), 2000)
    } catch {
      notify.error('Could not copy username')
    }
  }

  function handleChainSelect(c: ChainKey) {
    setChain(c)
    setCopiedAddr(false)
  }

  return (
    <div className="flex flex-col pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <Link
          href="/dashboard"
          className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/12 transition-all"
        >
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-base font-semibold text-white">Receive</h1>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 mx-4 mb-5 p-1 rounded-2xl bg-white/6">
        {(['address', 'username'] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 py-2 rounded-xl text-xs font-medium transition-all',
              activeTab === tab
                ? 'bg-[#d4a843] text-black'
                : 'text-white/50 hover:text-white',
            )}
          >
            {tab === 'address' ? 'Wallet Address' : 'Username'}
          </button>
        ))}
      </div>

      {/* Address tab */}
      {activeTab === 'address' && (
        <div className="flex flex-col items-center px-4 gap-5">
          {/* Chain selector */}
          <ChainSelector
            selected={chain}
            onSelect={handleChainSelect}
            availableEvmChainIds={availableEvmChainIds}
          />

          <TokenSelector
            selected={selectedToken}
            onSelect={setToken}
            tokens={supportedTokens}
          />

          {isEvmChain && (
            <div className="w-full rounded-2xl border border-violet-400/15 bg-violet-400/8 px-4 py-3">
              <p className="text-xs text-violet-100/75 leading-relaxed">
                Your EVM wallet address is the same across Ethereum, Base,
                Arbitrum, Polygon, and Celo. Select the exact network and token
                the sender will use.
              </p>
            </div>
          )}

          {/* QR */}
          <div className="rounded-3xl overflow-hidden border border-white/8 bg-[#1a1a1a] p-4 flex items-center justify-center">
            {addrQ.isLoading && (
              <div className="w-[180px] h-[180px] bg-white/5 rounded-2xl animate-pulse" />
            )}
            {addrQ.isError && (
              <div className="w-[180px] h-[180px] flex flex-col items-center justify-center gap-2">
                <p className="text-xs text-white/30">Could not load QR</p>
                <button
                  type="button"
                  onClick={() => addrQ.refetch()}
                  className="text-xs text-[#d4a843]/70 hover:text-[#d4a843] flex items-center gap-1 transition-colors"
                >
                  <RefreshCw size={11} />
                  Retry
                </button>
              </div>
            )}
            {addrQ.data && chain === 'stellar' && stellarAddr && (
              <QrCode value={stellarAddr} />
            )}
            {addrQ.data && isEvmChain && evmEntry?.address && (
              <QrCode value={evmEntry.address} />
            )}
            {addrQ.data && isEvmChain && !evmEntry?.address && (
              <div className="w-[180px] h-[180px] flex flex-col items-center justify-center gap-3 text-center px-4">
                <Spinner size="sm" />
                <p className="text-xs text-white/30 leading-relaxed">
                  {chainLabel} wallet is being set up. Check back shortly.
                </p>
              </div>
            )}
          </div>

          {/* Address display */}
          <div className="w-full rounded-2xl bg-white/5 border border-white/8 px-4 py-3.5">
            <p className="text-[10px] text-white/30 mb-1.5 tracking-widest uppercase">
              {selectedToken} · {chainLabel} address
            </p>
            {isEvmChain && !evmEntry?.address && !addrQ.isLoading ? (
              <p className="text-xs text-white/30 italic">Setting up…</p>
            ) : (
              <p className="text-xs text-white/60 font-mono leading-relaxed break-all">
                {activeAddr || '—'}
              </p>
            )}
          </div>

          {/* Copy button */}
          <button
            type="button"
            onClick={copyAddress}
            disabled={!activeAddr}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#d4a843] text-black text-sm font-semibold hover:bg-[#c49938] transition-colors disabled:opacity-40"
          >
            {copiedAddr
              ? <><CheckCheck size={16} /> Copied!</>
              : <><Copy size={16} /> Copy Address</>
            }
          </button>

          {/* Network warning */}
          <NetworkWarning
            chainLabel={chainLabel}
            token={selectedToken}
            isEvmChain={isEvmChain}
          />
        </div>
      )}

      {/* Username tab */}
      {activeTab === 'username' && (
        <div className="flex flex-col items-center px-4 gap-5">
          {/* QR */}
          <div className="rounded-3xl overflow-hidden border border-white/8 bg-[#1a1a1a] p-4">
            {username
              ? <QrCode value={`cheesepay:${username}`} />
              : <div className="w-[180px] h-[180px] bg-white/5 rounded-2xl animate-pulse" />
            }
          </div>

          {/* Username display */}
          <div className="w-full rounded-2xl bg-white/5 border border-white/8 px-4 py-4 text-center">
            <p className="text-[10px] text-white/30 mb-1 tracking-widest uppercase">Cheese Pay Username</p>
            <p className="text-xl font-semibold text-white mt-1">@{username || '—'}</p>
          </div>

          <button
            type="button"
            onClick={copyUsername}
            disabled={!username}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#d4a843] text-black text-sm font-semibold hover:bg-[#c49938] transition-colors disabled:opacity-40"
          >
            {copiedUser
              ? <><CheckCheck size={16} /> Copied!</>
              : <><Copy size={16} /> Copy Username</>
            }
          </button>

          {/* Warning */}
          <div className="w-full flex gap-2.5 rounded-2xl border border-amber-400/20 bg-amber-400/8 px-4 py-3">
            <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200/80 leading-relaxed">
              Username transfers only work between{' '}
              <span className="font-semibold text-amber-300">Cheese Pay users</span>.
              Make sure the sender is sending from a Cheese Pay account.
            </p>
          </div>
        </div>
      )}

      {/* Deposit networks */}
      <div className="mt-8 px-4">
        <h2 className="text-sm font-semibold text-white/60 mb-3 flex items-center gap-2">
          <Download size={14} />
          Deposit Networks
        </h2>

        {netsQ.isLoading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-2xl" />)}
          </div>
        )}

        {netsQ.isError && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <p className="text-xs text-white/30">Could not load networks</p>
            <button
              type="button"
              onClick={() => netsQ.refetch()}
              className="text-xs text-[#d4a843]/70 hover:text-[#d4a843] flex items-center gap-1 transition-colors"
            >
              <RefreshCw size={11} />
              Retry
            </button>
          </div>
        )}

        {netsQ.data && (
          <div className="flex flex-col gap-3">
            {netsQ.data.map(net => <NetworkCard key={net.id} net={net} />)}
          </div>
        )}
      </div>
    </div>
  )
}
