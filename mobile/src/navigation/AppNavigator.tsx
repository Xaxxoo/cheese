import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator }   from '@react-navigation/bottom-tabs'
import { LayoutGrid, Clock, User } from 'lucide-react-native'
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
import AddMoneyScreen    from '../screens/add-money/AddMoneyScreen'
import DevicesScreen     from '../screens/devices/DevicesScreen'
import CardScreen        from '../screens/card/CardScreen'
import PayLinkPayScreen  from '../screens/paylink/PayLinkPayScreen'
import TriviaScreen      from '../screens/trivia/TriviaScreen'

// ── Bottom tab navigator ──────────────────────────────────
const Tab = createBottomTabNavigator<TabParamList>()

type TabIconComponent = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
const TAB_ICONS: Record<string, TabIconComponent> = {
  Dashboard: LayoutGrid,
  History:   Clock,
  Profile:   User,
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color }) => {
          const Icon = TAB_ICONS[route.name] ?? LayoutGrid
          return <Icon size={22} color={color} strokeWidth={1.5} />
        },
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
      <Tab.Screen name="Dashboard" component={DashboardScreen as React.ComponentType<object>} />
      <Tab.Screen name="History"   component={HistoryScreen} />
      <Tab.Screen name="Profile"   component={ProfileScreen  as React.ComponentType<object>} />
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
      <Stack.Screen name="AddMoney"      component={AddMoneyScreen} />
      <Stack.Screen name="Devices"       component={DevicesScreen} />
      <Stack.Screen name="Card"          component={CardScreen} />
      <Stack.Screen name="Trivia"       component={TriviaScreen} />
      <Stack.Screen name="PayLinkPay"   component={PayLinkPayScreen} />
    </Stack.Navigator>
  )
}
