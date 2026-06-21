import React, { useEffect, useRef, useState } from 'react'
import { NavigationContainer, useNavigation, NavigationContainerRef } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import * as SplashScreen from 'expo-splash-screen'
import * as Notifications from 'expo-notifications'
import type { RootStackParamList, AppStackParamList } from './types'
import { useAuthStore } from '../store/auth.store'
import { tokenStore, onAuthExpired } from '../api/client'
import { getMe } from '../api/auth'
import { usePushNotifications } from '../hooks/usePushNotifications'

import AuthNavigator  from './AuthNavigator'
import AppNavigator   from './AppNavigator'
import SetPinScreen   from '../screens/pin/SetPinScreen'

const Root = createNativeStackNavigator<RootStackParamList>()

// ── Notification tap handler ──────────────────────────────
// Must be inside NavigationContainer to use useNavigation
function NotificationTapHandler() {
  const navigation = useNavigation<import('@react-navigation/native-stack').NativeStackNavigationProp<AppStackParamList>>()
  const lastResponse = Notifications.useLastNotificationResponse()
  const handledId    = useRef<string | null>(null)

  useEffect(() => {
    if (!lastResponse) return
    const id = lastResponse.notification.request.identifier
    if (handledId.current === id) return
    handledId.current = id
    // Always navigate to the Notifications screen on tap
    navigation.navigate('Notifications')
  }, [lastResponse])

  return null
}

// ── Deep link config ──────────────────────────────────────
const linking = {
  prefixes: ['cheesepay://'],
  config: {
    screens: {
      App: {
        screens: {
          PayLinkPay: 'pay/:token',
        },
      },
    },
  },
}

export default function RootNavigator() {
  const { isAuthenticated, user, setUser, clear } = useAuthStore()
  const [bootstrapped, setBootstrapped] = useState(false)

  // On launch: check for a stored token and load the current user
  useEffect(() => {
    async function bootstrap() {
      try {
        const token = await tokenStore.getAccess()
        if (token) {
          const user = await getMe()
          setUser(user)
        }
      } catch {
        await tokenStore.clear()
      } finally {
        setBootstrapped(true)
        await SplashScreen.hideAsync()
      }
    }
    void bootstrap()
  }, [])

  // Listen for token expiry and log out automatically
  useEffect(() => {
    const unsub = onAuthExpired(() => clear())
    return unsub
  }, [])

  // Register / refresh push token whenever user is authenticated
  usePushNotifications()

  if (!bootstrapped) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (
    <NavigationContainer linking={linking as any}>
      <Root.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          user?.hasPin === false ? (
            <Root.Screen name="SetPin" component={SetPinScreen} />
          ) : (
            <Root.Screen name="App" component={AppNavigator} />
          )
        ) : (
          <Root.Screen name="Auth" component={AuthNavigator} />
        )}
      </Root.Navigator>
      {/* Tap-to-navigate: only active when fully in the App stack */}
      {isAuthenticated && user?.hasPin !== false && <NotificationTapHandler />}
    </NavigationContainer>
  )
}
