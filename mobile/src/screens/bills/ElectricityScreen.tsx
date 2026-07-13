import React from 'react'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/types'
import BillPayFlow, { type BillFlowConfig } from './BillPayFlow'

type Props = NativeStackScreenProps<AppStackParamList, 'Electricity'>

const config: BillFlowConfig = {
  title: 'Electricity',
  category: 'electricity',
  billersCodeLabel:       'Meter Number',
  billersCodePlaceholder: 'Enter meter number',
  billersCodeKeyboard:    'number-pad',
  needsVerify:     true,
  hasVariations:   false,
  hasCustomAmount: true,
  resultHasToken:  true,
}

export default function ElectricityScreen({ navigation }: Props) {
  return <BillPayFlow config={config} onBack={() => navigation.goBack()} />
}
