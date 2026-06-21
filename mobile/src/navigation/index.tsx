import React, { useEffect, useState } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import * as SplashScreen from 'expo-splash-screen'
import type { RootStackParamList } from './types'
import { useAuthStore } from '../store/auth.store'
import { tokenStore, onAuthExpired } from '../api/client'
import { getMe } from '../api/auth'

import AuthNavigator  from './AuthNavigator'
import AppNavigator   from './AppNavigator'
import SetPinScreen   from '../screens/pin/SetPinScreen'

const Root = createNativeStackNavigator<RootStackParamList>()

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

  if (!bootstrapped) return null

  return (
    <NavigationContainer>
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
    </NavigationContainer>
  )
}
