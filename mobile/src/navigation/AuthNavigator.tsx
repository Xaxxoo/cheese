import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { AuthStackParamList } from './types'

import LoginScreen        from '../screens/auth/LoginScreen'
import SignupScreen       from '../screens/auth/SignupScreen'
import VerifyOtpScreen    from '../screens/auth/VerifyOtpScreen'
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen'
import ResetPasswordScreen  from '../screens/auth/ResetPasswordScreen'

const Stack = createNativeStackNavigator<AuthStackParamList>()

export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login"          component={LoginScreen} />
      <Stack.Screen name="Signup"         component={SignupScreen} />
      <Stack.Screen name="VerifyOtp"      component={VerifyOtpScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword"  component={ResetPasswordScreen} />
    </Stack.Navigator>
  )
}
