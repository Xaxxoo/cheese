'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function BankTransferRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/send')
  }, [router])
  return null
}
