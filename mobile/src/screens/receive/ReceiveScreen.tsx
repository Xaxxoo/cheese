import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, ActivityIndicator, Share,
} from 'react-native'
import { ArrowLeft } from 'lucide-react-native'
import * as Clipboard from 'expo-clipboard'
import QRCode from 'react-native-qrcode-svg'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/types'
import { getWalletAddress, getDepositNetworks, provisionWallet } from '../../api/wallet'
import type { WalletAddress, DepositNetwork, DepositToken, DepositTokenSymbol } from '../../types'

type Props = NativeStackScreenProps<AppStackParamList, 'Receive'>

type ChainKey = 'stellar' | 1 | 8453 | 42161 | 137 | 42220
type TokenSymbol = DepositTokenSymbol

const CHAIN_TABS: Array<{ key: ChainKey; label: string }> = [
  { key: 'stellar', label: 'Stellar' },
  { key: 1, label: 'Ethereum' },
  { key: 8453, label: 'Base' },
  { key: 42161, label: 'Arbitrum' },
  { key: 137, label: 'Polygon' },
  { key: 42220, label: 'Celo' },
]

const EVM_CHAIN_KEYS = CHAIN_TABS
  .filter((tab): tab is { key: Exclude<ChainKey, 'stellar'>; label: string } => tab.key !== 'stellar')
  .map((tab) => tab.key)

const FALLBACK_USDC_TOKEN: DepositToken = {
  symbol: 'USDC',
  address: null,
  decimals: 6,
}

function truncate(addr: string, chars = 10): string {
  if (addr.length <= chars * 2) return addr
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`
}

export default function ReceiveScreen({ navigation }: Props) {
  const [address,  setAddress]  = useState<WalletAddress | null>(null)
  const [networks, setNetworks] = useState<DepositNetwork[]>([])
  const [chain,    setChain]    = useState<ChainKey>('stellar')
  const [token,    setToken]    = useState<TokenSymbol>('USDC')
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    const loadReceiveData = async () => {
      try {
        await provisionWallet().catch(() => undefined)
        const [addr, nets] = await Promise.all([getWalletAddress(), getDepositNetworks()])
        setAddress(addr)
        setNetworks(nets)
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data?.message
          ?? (e as Error)?.message
          ?? 'Failed to load wallet address'
        setError(msg)
      } finally {
        setLoading(false)
      }
    }

    void loadReceiveData()
  }, [])

  const evmAddresses = address?.evmAddresses ?? {}
  const configuredEvmChainIds = networks
    .filter((net) => net.networkType === 'evm' && typeof net.chainId === 'number')
    .map((net) => net.chainId as number)
  const availableEvmChainIds = Array.from(
    new Set([...configuredEvmChainIds, ...Object.keys(evmAddresses).map(Number)]),
  ).filter((chainId): chainId is Exclude<ChainKey, 'stellar'> =>
    EVM_CHAIN_KEYS.includes(chainId as Exclude<ChainKey, 'stellar'>),
  )
  const visibleTabs = CHAIN_TABS.filter(
    (item) => item.key === 'stellar' || availableEvmChainIds.includes(item.key),
  )
  const isEvmChain = chain !== 'stellar'
  const evmEntry = isEvmChain ? evmAddresses[chain] : null
  const chainLabel = CHAIN_TABS.find((item) => item.key === chain)?.label ?? 'EVM'
  const selectedNetwork = networks.find((net) =>
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
  const activeAddress = chain === 'stellar'
    ? address?.stellarAddress
    : evmEntry?.address

  const activeNetworks = networks.filter((n) =>
    chain === 'stellar'
      ? n.networkType === 'stellar' || n.id.toLowerCase().includes('stellar') || n.name.toLowerCase().includes('stellar')
      : n.chainId === chain,
  )

  const [copied, setCopied] = useState(false)

  async function handleShare() {
    if (!activeAddress) return
    try {
      await Share.share({ message: activeAddress })
    } catch {
      // user dismissed
    }
  }

  async function handleCopy() {
    if (!activeAddress) return
    await Clipboard.setStringAsync(activeAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <ArrowLeft size={16} color="rgba(255,255,255,0.5)" strokeWidth={1.5} />
            <Text style={s.backText}>Back</Text>
          </View>
        </TouchableOpacity>
        <Text style={s.title}>Receive</Text>
        <Text style={s.sub}>Share your address to receive USDC or USDT</Text>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator color="#d4a843" size="large" />
          </View>
        ) : error ? (
          <View style={s.center}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : (
          <>
            {/* Network tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.tabs}
            >
              {visibleTabs.map((item) => (
                <TouchableOpacity
                  key={String(item.key)}
                  style={[s.tab, chain === item.key && s.tabActive]}
                  onPress={() => {
                    setChain(item.key)
                    setCopied(false)
                  }}
                >
                  <Text style={[s.tabText, chain === item.key && s.tabTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={s.tokenRow}>
              {supportedTokens.map((item) => (
                <TouchableOpacity
                  key={item.symbol}
                  style={[s.tokenChip, selectedToken === item.symbol && s.tokenChipActive]}
                  onPress={() => setToken(item.symbol)}
                >
                  <Text style={[s.tokenText, selectedToken === item.symbol && s.tokenTextActive]}>
                    {item.symbol}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {isEvmChain ? (
              <View style={s.infoCard}>
                <Text style={s.infoText}>
                  Your EVM wallet address is the same across Ethereum, Base, Arbitrum,
                  Polygon, and Celo. Select the exact network and token the sender will use.
                </Text>
              </View>
            ) : null}

            {/* Address card */}
            <View style={s.addressCard}>
              <Text style={s.assetLabel}>{selectedToken} · {chainLabel} Network</Text>

              {/* QR code */}
              {activeAddress ? (
                <View style={s.qrBox}>
                  <QRCode
                    value={activeAddress}
                    size={180}
                    backgroundColor="#ffffff"
                    color="#000000"
                  />
                </View>
              ) : (
                <View style={s.qrPending}>
                  {isEvmChain ? <ActivityIndicator color="#d4a843" size="small" /> : null}
                  <Text style={s.pendingText}>
                    {isEvmChain ? `${chainLabel} wallet is being set up.` : 'Address unavailable.'}
                  </Text>
                </View>
              )}

              <TouchableOpacity onPress={handleCopy} style={s.addrWrap}>
                <Text style={s.addrText}>{activeAddress ? truncate(activeAddress, 12) : '—'}</Text>
                <Text style={copied ? s.addrHintCopied : s.addrHint}>{copied ? 'Copied!' : 'Tap to copy'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.shareBtn} onPress={handleShare}>
                <Text style={s.shareBtnText}>Share Address</Text>
              </TouchableOpacity>
            </View>

            {/* Network info */}
            {activeNetworks.length > 0 ? (
              <View style={s.section}>
                <Text style={s.sectionLabel}>Deposit Info</Text>
                {activeNetworks.map((net) => (
                  <View key={net.id} style={s.netCard}>
                    <Text style={s.netName}>{net.name}</Text>
                    {net.note ? <Text style={s.netNote}>{net.note}</Text> : null}
                    <View style={s.netGrid}>
                      <View style={s.netItem}>
                        <Text style={s.netItemLabel}>Min Deposit</Text>
                        <Text style={s.netItemValue}>{net.minDeposit} {net.asset}</Text>
                      </View>
                      <View style={s.netItem}>
                        <Text style={s.netItemLabel}>Fee</Text>
                        <Text style={s.netItemValue}>{net.fee}</Text>
                      </View>
                      <View style={s.netItem}>
                        <Text style={s.netItemLabel}>Confirmations</Text>
                        <Text style={s.netItemValue}>{net.confirmations}</Text>
                      </View>
                      <View style={s.netItem}>
                        <Text style={s.netItemLabel}>Est. Time</Text>
                        <Text style={s.netItemValue}>{net.estimatedTime}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={s.warningCard}>
              <Text style={s.warningText}>
                Only send {selectedToken} on {chainLabel}. {isEvmChain
                  ? 'EVM networks share one wallet address, but the selected network and token must still match.'
                  : 'Sending any other asset may result in permanent loss.'}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: '#0a0a0a' },
  container:     { padding: 20, paddingBottom: 48 },
  back:          { marginBottom: 24 },
  backText:      { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  title:         { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 4 },
  sub:           { fontSize: 14, color: 'rgba(255,255,255,0.35)', marginBottom: 24 },
  center:        { paddingTop: 60, alignItems: 'center' },
  errorText:     { color: '#ff6b6b', fontSize: 14, textAlign: 'center' },

  tabs:          { flexDirection: 'row', gap: 8, marginBottom: 20 },
  tab:           {
    paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#141414', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  tabActive:     { backgroundColor: '#d4a843', borderColor: '#d4a843' },
  tabText:       { fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  tabTextActive: { color: '#000' },
  tokenRow:      { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tokenChip:     {
    flex: 1, paddingVertical: 9, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center',
  },
  tokenChipActive: { borderColor: '#d4a843', backgroundColor: 'rgba(212,168,67,0.14)' },
  tokenText:     { fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: '700' },
  tokenTextActive: { color: '#d4a843' },
  infoCard:      {
    backgroundColor: 'rgba(167,139,250,0.08)', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.16)', marginBottom: 16,
  },
  infoText:      { color: 'rgba(237,233,254,0.8)', fontSize: 12, lineHeight: 18 },

  addressCard:   {
    backgroundColor: '#141414', borderRadius: 20, padding: 24,
    alignItems: 'center', marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  assetLabel:    { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: '600',
                   textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 20 },

  qrBox:         {
    backgroundColor: '#ffffff', borderRadius: 16, padding: 12,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  qrPending:     {
    width: 204, height: 204, borderRadius: 16, marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 20, gap: 8,
  },
  pendingText:   { color: 'rgba(255,255,255,0.35)', fontSize: 12, textAlign: 'center' },

  addrWrap:      {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12,
    padding: 14, alignItems: 'center', width: '100%', marginBottom: 16,
  },
  addrText:      { fontSize: 13, color: '#fff', fontWeight: '500', fontFamily: 'monospace', marginBottom: 4 },
  addrHint:      { fontSize: 11, color: 'rgba(255,255,255,0.25)' },
  addrHintCopied:{ fontSize: 11, color: '#4ade80' },

  shareBtn:      {
    backgroundColor: '#d4a843', borderRadius: 14, paddingVertical: 14,
    paddingHorizontal: 32, width: '100%', alignItems: 'center',
  },
  shareBtnText:  { color: '#000', fontWeight: '700', fontSize: 15 },

  section:       { marginBottom: 16 },
  sectionLabel:  { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.35)',
                   textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },

  netCard:       {
    backgroundColor: '#141414', borderRadius: 16, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  netName:       { fontSize: 15, color: '#fff', fontWeight: '600', marginBottom: 4 },
  netNote:       { fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 12 },
  netGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  netItem:       { width: '45%' },
  netItemLabel:  { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 2 },
  netItemValue:  { fontSize: 13, color: '#fff', fontWeight: '500' },

  warningCard:   {
    backgroundColor: 'rgba(250,204,21,0.08)', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(250,204,21,0.2)',
  },
  warningText:   { color: '#facc15', fontSize: 12, lineHeight: 18 },
})
