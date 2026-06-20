import React from 'react'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/types'
import BillPayFlow, { type BillFlowConfig } from './BillPayFlow'

type Props = NativeStackScreenProps<AppStackParamList, 'Airtime'>

const config: BillFlowConfig = {
  title: 'Buy Airtime',
  providers: [
    { id: 'mtn',      name: 'MTN',     icon: '🟡' },
    { id: 'glo',      name: 'Glo',     icon: '🟢' },
    { id: 'airtel',   name: 'Airtel',  icon: '🔴' },
    { id: 'etisalat', name: '9mobile', icon: '🔵' },
  ],
  billersCodeLabel:       'Phone Number',
  billersCodePlaceholder: '08XXXXXXXXX',
  billersCodeKeyboard:    'phone-pad',
  needsVerify:     false,
  hasVariations:   false,
  hasCustomAmount: true,
}

export default function AirtimeScreen({ navigation }: Props) {
  return <BillPayFlow config={config} onBack={() => navigation.goBack()} />
}
