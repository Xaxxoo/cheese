import React from 'react'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/types'
import BillPayFlow, { type BillFlowConfig } from './BillPayFlow'

type Props = NativeStackScreenProps<AppStackParamList, 'Data'>

const config: BillFlowConfig = {
  title: 'Buy Data',
  category: 'data',
  billersCodeLabel:       'Phone Number',
  billersCodePlaceholder: '08XXXXXXXXX',
  billersCodeKeyboard:    'phone-pad',
  needsVerify:     false,
  hasVariations:   true,
  hasCustomAmount: false,
}

export default function DataScreen({ navigation }: Props) {
  return <BillPayFlow config={config} onBack={() => navigation.goBack()} />
}
