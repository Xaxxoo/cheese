import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator }   from '@react-navigation/bottom-tabs'
import { Text, View } from 'react-native'
import type { AppStackParamList, TabParamList } from './types'
import { COLORS } from '../constants'

// Screens
import DashboardScreen    from '../screens/dashboard/DashboardScreen'
import HistoryScreen      from '../screens/history/HistoryScreen'
import ProfileScreen      from '../screens/profile/ProfileScreen'
import SendScreen         from '../screens/send/SendScreen'
import ReceiveScreen      from '../screens/receive/ReceiveScreen'
import BankTransferScreen from '../screens/bank-transfer/BankTransferScreen'
import PaylinkScreen      from '../screens/paylink/PaylinkScreen'
import BillsScreen        from '../screens/bills/BillsScreen'
import AirtimeScreen      from '../screens/bills/AirtimeScreen'
import DataScreen         from '../screens/bills/DataScreen'
import TvScreen           from '../screens/bills/TvScreen'
import ElectricityScreen  from '../screens/bills/ElectricityScreen'
import KycScreen          from '../screens/kyc/KycScreen'
import NotificationsScreen from '../screens/notifications/NotificationsScreen'
import EditProfileScreen  from '../screens/profile/EditProfileScreen'
import ChangePinScreen    from '../screens/pin/ChangePinScreen'
import ReferralScreen     from '../screens/referral/ReferralScreen'
import PayLinkPayScreen  from '../screens/paylink/PayLinkPayScreen'

// ── Tab icons (text-based until vector icons are added) ───
function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = { Dashboard: '⊞', History: '↻', Profile: '◉' }
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Text style={{ fontSize: 18, color: focused ? COLORS.gold : COLORS.textDim }}>
        {icons[label] ?? '•'}
      </Text>
    </View>
  )
}

// ── Bottom tab navigator ──────────────────────────────────
const Tab = createBottomTabNavigator<TabParamList>()

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
        tabBarActiveTintColor:   COLORS.gold,
        tabBarInactiveTintColor: COLORS.textDim,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor:  COLORS.border,
          borderTopWidth:  1,
          height: 62,
          paddingBottom: 10,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="History"   component={HistoryScreen} />
      <Tab.Screen name="Profile"   component={ProfileScreen} />
    </Tab.Navigator>
  )
}

// ── App stack ─────────────────────────────────────────────
const Stack = createNativeStackNavigator<AppStackParamList>()

export default function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Tabs"          component={TabNavigator} />
      <Stack.Screen name="Send"          component={SendScreen} />
      <Stack.Screen name="Receive"       component={ReceiveScreen} />
      <Stack.Screen name="BankTransfer"  component={BankTransferScreen} />
      <Stack.Screen name="Paylink"       component={PaylinkScreen} />
      <Stack.Screen name="Bills"         component={BillsScreen} />
      <Stack.Screen name="Airtime"       component={AirtimeScreen} />
      <Stack.Screen name="Data"          component={DataScreen} />
      <Stack.Screen name="Tv"            component={TvScreen} />
      <Stack.Screen name="Electricity"   component={ElectricityScreen} />
      <Stack.Screen name="KYC"           component={KycScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="EditProfile"   component={EditProfileScreen} />
      <Stack.Screen name="ChangePin"     component={ChangePinScreen} />
      <Stack.Screen name="Referral"      component={ReferralScreen} />
      <Stack.Screen name="PayLinkPay"   component={PayLinkPayScreen} />
    </Stack.Navigator>
  )
}
