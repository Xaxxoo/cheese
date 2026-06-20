import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, ActivityIndicator, Share, Alert,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/types'
import { getWalletAddress, getDepositNetworks } from '../../api/wallet'
import type { WalletAddress, DepositNetwork } from '../../types'

type Props = NativeStackScreenProps<AppStackParamList, 'Receive'>

type NetworkTab = 'stellar' | 'evm'

function truncate(addr: string, chars = 10): string {
  if (addr.length <= chars * 2) return addr
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`
}

export default function ReceiveScreen({ navigation }: Props) {
  const [address,  setAddress]  = useState<WalletAddress | null>(null)
  const [networks, setNetworks] = useState<DepositNetwork[]>([])
  const [tab,      setTab]      = useState<NetworkTab>('stellar')
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getWalletAddress(), getDepositNetworks()])
      .then(([addr, nets]) => { setAddress(addr); setNetworks(nets) })
      .catch((e: unknown) => {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data?.message
          ?? (e as Error)?.message
          ?? 'Failed to load wallet address'
        setError(msg)
      })
      .finally(() => setLoading(false))
  }, [])

  const activeAddress = tab === 'stellar'
    ? address?.stellarAddress
    : Object.values(address?.evmAddresses ?? {})[0]?.address

  const activeNetworks = networks.filter((n) =>
    tab === 'stellar' ? n.id.toLowerCase().includes('stellar') || n.name.toLowerCase().includes('stellar')
      : !n.id.toLowerCase().includes('stellar') && !n.name.toLowerCase().includes('stellar'),
  )

  async function handleShare() {
    if (!activeAddress) return
    try {
      await Share.share({ message: activeAddress })
    } catch {
      // user dismissed
    }
  }

  function handleCopyAlert() {
    if (!activeAddress) return
    Alert.alert('Address', activeAddress, [{ text: 'OK' }])
  }

  const hasEvm = address && Object.keys(address.evmAddresses).length > 0

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Receive</Text>
        <Text style={s.sub}>Share your address to receive USDC</Text>

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
            <View style={s.tabs}>
              <TouchableOpacity
                style={[s.tab, tab === 'stellar' && s.tabActive]}
                onPress={() => setTab('stellar')}
              >
                <Text style={[s.tabText, tab === 'stellar' && s.tabTextActive]}>Stellar</Text>
              </TouchableOpacity>
              {hasEvm ? (
                <TouchableOpacity
                  style={[s.tab, tab === 'evm' && s.tabActive]}
                  onPress={() => setTab('evm')}
                >
                  <Text style={[s.tabText, tab === 'evm' && s.tabTextActive]}>EVM</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Address card */}
            <View style={s.addressCard}>
              <Text style={s.assetLabel}>USDC · {tab === 'stellar' ? 'Stellar Network' : 'EVM Network'}</Text>

              {/* QR placeholder */}
              <View style={s.qrBox}>
                <Text style={s.qrIcon}>⬛</Text>
                <Text style={s.qrHint}>QR code coming soon</Text>
              </View>

              <TouchableOpacity onPress={handleCopyAlert} style={s.addrWrap}>
                <Text style={s.addrText}>{activeAddress ? truncate(activeAddress, 12) : '—'}</Text>
                <Text style={s.addrHint}>Tap to view full address</Text>
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
                Only send USDC to this address. Sending any other asset may result in permanent loss.
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

  addressCard:   {
    backgroundColor: '#141414', borderRadius: 20, padding: 24,
    alignItems: 'center', marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  assetLabel:    { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: '600',
                   textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 20 },

  qrBox:         {
    width: 160, height: 160, backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  qrIcon:        { fontSize: 48, marginBottom: 8 },
  qrHint:        { fontSize: 11, color: 'rgba(255,255,255,0.2)' },

  addrWrap:      {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12,
    padding: 14, alignItems: 'center', width: '100%', marginBottom: 16,
  },
  addrText:      { fontSize: 13, color: '#fff', fontWeight: '500', fontFamily: 'monospace', marginBottom: 4 },
  addrHint:      { fontSize: 11, color: 'rgba(255,255,255,0.25)' },

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
