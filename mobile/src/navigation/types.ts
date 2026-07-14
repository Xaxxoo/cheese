import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'

// ── Auth stack ────────────────────────────────────────────
export type AuthStackParamList = {
  Login:           undefined
  Signup:          undefined
  VerifyOtp:       { email: string; type: 'email_verify' | 'password_reset' }
  ForgotPassword:  undefined
  ResetPassword:   { email: string }
}

// ── Main tab navigator ────────────────────────────────────
export type TabParamList = {
  Dashboard: undefined
  History:   undefined
  Profile:   undefined
}

// ── App stack (wraps tabs + modal screens) ────────────────
export type AppStackParamList = {
  Tabs:         undefined
  Send:         undefined
  Receive:      undefined
  BankTransfer: undefined
  Paylink:      undefined
  Bills:        undefined
  Airtime:      undefined
  Data:         undefined
  Tv:           undefined
  Electricity:  undefined
  KYC:          undefined
  Notifications:undefined
  EditProfile:  undefined
  ChangePin:    undefined
  Referral:     undefined
  AddMoney:     undefined
  Devices:      undefined
  Card:         undefined
  Trivia:       undefined
  PayLinkPay:   { token: string }
}

// ── Combined root ─────────────────────────────────────────
export type RootStackParamList = {
  Auth:   undefined
  App:    undefined
  SetPin: undefined
}

// ── Navigation prop helpers ───────────────────────────────
export type AuthNavProp    = NativeStackNavigationProp<AuthStackParamList>
export type AppNavProp     = NativeStackNavigationProp<AppStackParamList>
export type TabNavProp     = BottomTabNavigationProp<TabParamList>
