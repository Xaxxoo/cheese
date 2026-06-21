import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, ActivityIndicator, Share, Clipboard, RefreshControl,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/types'
import { getReferralInfo } from '../../api/wallet'
import type { ReferralInfo } from '../../types'

type Props = NativeStackScreenProps<AppStackParamList, 'Referral'>

export default function ReferralScreen({ navigation }: Props) {
  const [info,       setInfo]       = useState<ReferralInfo | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [copied,     setCopied]     = useState(false)

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    try {
      const data = await getReferralInfo()
      setInfo(data)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { void load() }, [])

  const onRefresh = useCallback(() => void load(true), [])

  function copyCode() {
    if (!info) return
    Clipboard.setString(info.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function shareLink() {
    if (!info) return
    await Share.share({
      message: `Join Cheese Pay and get started with crypto — use my referral link: ${info.link}`,
      url:     info.link,
    })
  }

  // ── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <ActivityIndicator color="#d4a843" size="large" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d4a843" />}
      >
        {/* Header */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Referrals</Text>
        <Text style={s.sub}>Invite friends and earn rewards when they join</Text>

        {/* Code card */}
        <View style={s.codeCard}>
          <Text style={s.codeLabel}>Your referral code</Text>
          <TouchableOpacity style={s.codeRow} onPress={copyCode} activeOpacity={0.7}>
            <Text style={s.code}>{info?.code ?? '—'}</Text>
            <View style={[s.copyBadge, copied && s.copyBadgeDone]}>
              <Text style={[s.copyText, copied && s.copyTextDone]}>
                {copied ? 'Copied!' : 'Copy'}
              </Text>
            </View>
          </TouchableOpacity>
          <Text style={s.codeHint}>Tap the code to copy it</Text>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statValue}>{info?.totalReferrals ?? 0}</Text>
            <Text style={s.statLabel}>Total referrals</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statValue, s.goldText]}>{info?.pendingReward ?? 0}</Text>
            <Text style={s.statLabel}>Pending points</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statValue, s.greenText]}>{info?.paidReward ?? 0}</Text>
            <Text style={s.statLabel}>Paid points</Text>
          </View>
        </View>

        {/* How it works */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>How it works</Text>
          {[
            { n: '1', text: 'Share your referral link or code with a friend' },
            { n: '2', text: 'They sign up using your link and verify their identity' },
            { n: '3', text: 'You both earn reward points automatically' },
          ].map(({ n, text }) => (
            <View key={n} style={s.step}>
              <View style={s.stepNum}>
                <Text style={s.stepNumText}>{n}</Text>
              </View>
              <Text style={s.stepText}>{text}</Text>
            </View>
          ))}
        </View>

        {/* Share button */}
        <TouchableOpacity style={s.shareBtn} onPress={shareLink}>
          <Text style={s.shareBtnText}>Share referral link</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: '#0a0a0a' },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container:     { padding: 20, paddingBottom: 48 },

  back:          { marginBottom: 20 },
  backText:      { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  title:         { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 6 },
  sub:           { fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 24, lineHeight: 20 },

  codeCard:      {
    backgroundColor: '#141414', borderRadius: 20, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  codeLabel:     { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.35)',
                   textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  codeRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  code:          { fontSize: 28, fontWeight: '700', color: '#d4a843', letterSpacing: 3 },
  copyBadge:     {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: 'rgba(212,168,67,0.12)',
    borderWidth: 1, borderColor: 'rgba(212,168,67,0.3)',
  },
  copyBadgeDone: { backgroundColor: 'rgba(74,222,128,0.12)', borderColor: 'rgba(74,222,128,0.3)' },
  copyText:      { fontSize: 12, fontWeight: '600', color: '#d4a843' },
  copyTextDone:  { color: '#4ade80' },
  codeHint:      { fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 10 },

  statsRow:      { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard:      {
    flex: 1, backgroundColor: '#141414', borderRadius: 16, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  statValue:     { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 4 },
  statLabel:     { fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center' },
  goldText:      { color: '#d4a843' },
  greenText:     { color: '#4ade80' },

  section:       {
    backgroundColor: '#141414', borderRadius: 16, padding: 20, marginBottom: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  sectionTitle:  { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 16 },
  step:          { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  stepNum:       {
    width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(212,168,67,0.15)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 1,
  },
  stepNumText:   { fontSize: 13, fontWeight: '700', color: '#d4a843' },
  stepText:      { flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 20 },

  shareBtn:      {
    backgroundColor: '#d4a843', borderRadius: 14, padding: 16,
    alignItems: 'center',
  },
  shareBtnText:  { color: '#000', fontWeight: '700', fontSize: 15 },
})
