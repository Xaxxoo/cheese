import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  FlatList, RefreshControl, ActivityIndicator,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/types'
import { getNotifications, markNotificationsRead } from '../../api/wallet'
import { fmtDateTime } from '../../utils/format'
import type { AppNotification } from '../../types'

type Props = NativeStackScreenProps<AppStackParamList, 'Notifications'>

function notifIcon(type: string): string {
  if (type.includes('deposit')   || type.includes('receive')) return '↓'
  if (type.includes('send')      || type.includes('transfer')) return '↑'
  if (type.includes('kyc')       || type.includes('verify'))   return '🪪'
  if (type.includes('referral'))                                return '🎁'
  if (type.includes('card'))                                    return '💳'
  if (type.includes('bill'))                                    return '⚡'
  if (type.includes('security')  || type.includes('login'))    return '🔒'
  return '🔔'
}

function notifIconColor(type: string): string {
  if (type.includes('deposit') || type.includes('receive') || type.includes('referral')) return '#4ade80'
  if (type.includes('send') || type.includes('transfer'))  return '#f87171'
  if (type.includes('security') || type.includes('login')) return '#facc15'
  return '#d4a843'
}

export default function NotificationsScreen({ navigation }: Props) {
  const [items,      setItems]      = useState<AppNotification[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const load = useCallback(async (markRead = false) => {
    try {
      const data = await getNotifications()
      setItems(data)
      setError(null)
      if (markRead && data.some((n) => !n.read)) {
        void markNotificationsRead().catch(() => null)
        setItems(data.map((n) => ({ ...n, read: true })))
      }
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (e as Error)?.message
        ?? 'Failed to load notifications'
      setError(msg)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    load(true).finally(() => setLoading(false))
  }, [load])

  async function onRefresh() {
    setRefreshing(true)
    await load(false)
    setRefreshing(false)
  }

  const renderItem = ({ item }: { item: AppNotification }) => (
    <View style={[s.row, !item.read && s.rowUnread]}>
      <View style={[s.iconWrap, { backgroundColor: notifIconColor(item.type) + '1a' }]}>
        <Text style={[s.icon, { color: notifIconColor(item.type) }]}>
          {notifIcon(item.type)}
        </Text>
      </View>
      <View style={s.content}>
        <View style={s.titleRow}>
          <Text style={s.notifTitle} numberOfLines={1}>{item.title}</Text>
          {!item.read && <View style={s.unreadDot} />}
        </View>
        <Text style={s.body} numberOfLines={2}>{item.body}</Text>
        <Text style={s.time}>{fmtDateTime(item.createdAt)}</Text>
      </View>
    </View>
  )

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Notifications</Text>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color="#d4a843" size="large" />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity
            style={s.retryBtn}
            onPress={() => { setLoading(true); load(false).finally(() => setLoading(false)) }}
          >
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={items.length === 0 ? s.emptyContainer : s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d4a843" />}
          ItemSeparatorComponent={() => <View style={s.separator} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyIcon}>🔔</Text>
              <Text style={s.emptyTitle}>No notifications yet</Text>
              <Text style={s.emptyText}>We'll notify you about transactions and account activity here.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#0a0a0a' },
  header:      { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  back:        { marginBottom: 12 },
  backText:    { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  title:       { fontSize: 22, fontWeight: '700', color: '#fff' },

  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText:   { color: '#ff6b6b', fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryBtn:    { backgroundColor: '#d4a843', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
  retryText:   { color: '#000', fontWeight: '700', fontSize: 14 },

  listContent: { paddingHorizontal: 20, paddingBottom: 32 },
  emptyContainer: { flexGrow: 1 },
  separator:   { height: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginHorizontal: 20 },

  row:         {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  rowUnread:   { backgroundColor: 'rgba(212,168,67,0.04)' },
  iconWrap:    {
    width: 42, height: 42, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 1,
  },
  icon:        { fontSize: 17 },
  content:     { flex: 1 },
  titleRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  notifTitle:  { fontSize: 14, fontWeight: '600', color: '#fff', flex: 1 },
  unreadDot:   { width: 7, height: 7, borderRadius: 4, backgroundColor: '#d4a843' },
  body:        { fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 18, marginBottom: 5 },
  time:        { fontSize: 11, color: 'rgba(255,255,255,0.25)' },

  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, paddingTop: 80 },
  emptyIcon:   { fontSize: 44, marginBottom: 16 },
  emptyTitle:  { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 8 },
  emptyText:   { fontSize: 13, color: 'rgba(255,255,255,0.3)', textAlign: 'center', lineHeight: 20 },
})
