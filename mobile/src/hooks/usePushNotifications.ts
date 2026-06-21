import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { useAuthStore } from '../store/auth.store'
import { registerExpoToken } from '../api/wallet'

// ── Foreground notification behaviour ─────────────────────
// Show alert + play sound while the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
  }),
})

// ── Hook ──────────────────────────────────────────────────
export function usePushNotifications() {
  const userId = useAuthStore((s) => s.user?.id)
  const notifListenerRef   = useRef<Notifications.Subscription | null>(null)

  useEffect(() => {
    if (!userId) return

    async function register() {
      // Only works on physical devices
      if (!Device.isDevice) return

      // Android: create a default channel before requesting permission
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name:              'Default',
          importance:        Notifications.AndroidImportance.MAX,
          vibrationPattern:  [0, 250, 250, 250],
          lightColor:        '#d4a843',
          sound:             'default',
        })
      }

      // Request permission
      const { status: existing } = await Notifications.getPermissionsAsync()
      let finalStatus = existing
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
      }
      if (finalStatus !== 'granted') return

      // Get Expo push token and register with backend
      try {
        const { data: token } = await Notifications.getExpoPushTokenAsync()
        await registerExpoToken(token)
      } catch (err) {
        // Non-fatal: token registration failure should not crash the app
        console.warn('[Push] Token registration failed:', err)
      }
    }

    void register()

    // Listen for notifications received while app is in foreground
    notifListenerRef.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('[Push] Received:', notification.request.content.title)
      },
    )

    return () => {
      notifListenerRef.current?.remove()
    }
  }, [userId])
}
