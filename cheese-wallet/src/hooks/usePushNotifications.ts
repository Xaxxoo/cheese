'use client'

import { useState, useEffect } from 'react'
import { subscribePush, unsubscribePush } from '@/lib/api/wallet'

type PushStatus = 'unsupported' | 'denied' | 'default' | 'subscribed'

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>('default')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!('Notification' in window) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setStatus('denied')
      return
    }
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => {
        setStatus(sub ? 'subscribed' : 'default')
      }),
    )
  }, [])

  async function subscribe() {
    try {
      setError(null)
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus('denied')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      })
      const { endpoint, keys } = sub.toJSON() as any
      await subscribePush({ endpoint, p256dh: keys.p256dh, authKey: keys.auth })
      setStatus('subscribed')
    } catch (err: any) {
      console.error('[push subscribe]', err)
      setError(err?.message ?? 'Failed to enable notifications')
    }
  }

  async function unsubscribe() {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await unsubscribePush(sub.endpoint)
      await sub.unsubscribe()
    }
    setStatus('default')
  }

  return { status, error, subscribe, unsubscribe }
}
