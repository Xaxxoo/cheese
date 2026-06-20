import React from 'react'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/types'
import BillPayFlow, { type BillFlowConfig } from './BillPayFlow'

type Props = NativeStackScreenProps<AppStackParamList, 'Tv'>

const config: BillFlowConfig = {
  title: 'TV Subscription',
  providers: [
    { id: 'dstv',       name: 'DStv',      icon: '📺' },
    { id: 'gotv',       name: 'GOtv',      icon: '📡' },
    { id: 'startimes',  name: 'StarTimes', icon: '⭐' },
  ],
  billersCodeLabel:       'Smart Card / IUC Number',
  billersCodePlaceholder: 'Enter smart card number',
  billersCodeKeyboard:    'number-pad',
  needsVerify:     true,
  hasVariations:   true,
  hasCustomAmount: false,
}

export default function TvScreen({ navigation }: Props) {
  return <BillPayFlow config={config} onBack={() => navigation.goBack()} />
}
