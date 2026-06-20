import React from 'react'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/types'
import BillPayFlow, { type BillFlowConfig } from './BillPayFlow'

type Props = NativeStackScreenProps<AppStackParamList, 'Electricity'>

const config: BillFlowConfig = {
  title: 'Electricity',
  providers: [
    { id: 'ikeja-electric',  name: 'Ikeja Electric',  icon: '⚡' },
    { id: 'eko-electric',    name: 'Eko Electric',    icon: '⚡' },
    { id: 'abuja-electric',  name: 'Abuja Electric',  icon: '⚡' },
    { id: 'kano-electric',   name: 'Kano Electric',   icon: '⚡' },
    { id: 'phed',            name: 'PHED',            icon: '⚡' },
    { id: 'ibadan-electric', name: 'IBEDC',           icon: '⚡' },
    { id: 'enugu-electric',  name: 'EEDC',            icon: '⚡' },
    { id: 'benin-electric',  name: 'BEDC',            icon: '⚡' },
  ],
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
