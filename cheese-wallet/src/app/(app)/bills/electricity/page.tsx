'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { PinPad } from '@/components/ui/PinPad'
import { useAuthStore } from '@/store/authStore'
import { useQuery } from '@tanstack/react-query'
import { getExchangeRate } from '@/lib/api/wallet'
import { getBillers, verifyBillCustomer, payBill } from '@/lib/api/bills'
import { signPayload, hashPin } from '@/lib/crypto/deviceSigning'
import { QUERY_KEYS, STALE_TIMES } from '@/constants'
import type { PayBillResponse, Biller } from '@/lib/api/bills'

// ─────────────────────────────────────────────────────────
type Step = 'provider' | 'details' | 'verify' | 'amount' | 'summary' | 'pin' | 'success' | 'error'

interface Provider {
  id: string
  label: string
  color: string
}

export default function ElectricityPage() {
  const router = useRouter()
  const { user, deviceId } = useAuthStore()

  const [step, setStep] = useState<Step>('provider')
  const [providers, setProviders] = useState<Provider[]>([])
  const [provider, setProvider] = useState('')
  const [meterNumber, setMeterNumber] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [amount, setAmount] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PayBillResponse | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const billersQ = useQuery({
    queryKey: ['billers', 'electricity'],
    queryFn: () => getBillers('electricity'),
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    if (billersQ.data) {
      setProviders(billersQ.data.map((b: Biller) => ({
        id: b.biller_code,
        label: b.name || b.biller_name || b.short_name,
        color: 'text-white',
      })))
    }
  }, [billersQ.data])

  const rateQ = useQuery({
    queryKey: QUERY_KEYS.EXCHANGE_RATE,
    queryFn: getExchangeRate,
    staleTime: STALE_TIMES.EXCHANGE_RATE,
  })
  const rate = rateQ.data ? parseFloat(rateQ.data.effectiveRate) : 0

  // Auto-submit on 6-digit PIN
  useEffect(() => {
    if (pin.length === 6 && step === 'pin') {
      void handlePay()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  async function handleVerify() {
    setVerifying(true)
    setVerifyError('')
    try {
      const res = await verifyBillCustomer({ serviceId: provider, billersCode: meterNumber })
      const details = res.details as Record<string, unknown>
      setCustomerName(res.customerName ?? (details?.name as string) ?? '')
      setCustomerAddress((details?.address as string) ?? (details?.Address as string) ?? '')
      setStep('amount')
    } catch {
      setVerifyError('Could not verify meter. Please check the number and try again.')
    } finally {
      setVerifying(false)
    }
  }

  async function handlePay() {
    if (!user?.id || !deviceId) return
    setLoading(true)
    try {
      const pinHash = await hashPin(pin, user.id)

      const timestamp = Date.now()
      const nonceBytes = new Uint8Array(16)
      crypto.getRandomValues(nonceBytes)
      const nonce = btoa(String.fromCharCode(...nonceBytes))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

      const sigPayload: Record<string, string> = {
        action: 'bill_payment',
        amount,
        nonce,
        recipient: meterNumber,
        serviceId: provider,
        timestamp: String(timestamp),
        userId: user.id,
      }
      const deviceSignature = await signPayload(deviceId, sigPayload)

      const res = await payBill({
        serviceId: provider,
        billersCode: meterNumber,
        amount,
        pinHash,
        deviceSignature,
        deviceId,
        timestamp: String(timestamp),
        nonce,
      })
      setResult(res)
      setStep('success')
    } catch (err: unknown) {
      setErrorMsg(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          (err as Error)?.message ??
          'Payment failed. Please try again.',
      )
      setStep('error')
    } finally {
      setLoading(false)
      setPin('')
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <button
          type="button"
          onClick={() => {
            if (step === 'provider') router.back()
            else if (step === 'details') setStep('provider')
            else if (step === 'verify') setStep('details')
            else if (step === 'amount') setStep('verify')
            else if (step === 'summary') setStep('amount')
            else if (step === 'pin') setStep('summary')
            else router.push('/bills')
          }}
          className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/12 transition-all"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-semibold text-white">Electricity</h1>
      </div>

      <div className="flex-1 px-4">

        {/* Step: Provider */}
        {step === 'provider' && (
          <div className="flex flex-col gap-3 mt-2">
            <p className="text-sm text-white/50 mb-2">Select your electricity provider</p>
            {billersQ.isLoading && (
              <div className="flex justify-center py-8">
                <Spinner size="md" />
              </div>
            )}
            {billersQ.isError && (
              <p className="text-sm text-red-400/70 text-center py-4">
                Could not load providers. Please try again.
              </p>
            )}
            {providers.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setProvider(p.id); setStep('details') }}
                className={cn(
                  'flex items-center gap-4 px-4 py-4 rounded-2xl border transition-colors text-left',
                  provider === p.id
                    ? 'border-[#d4a843] bg-[#d4a843]/8'
                    : 'border-white/8 bg-white/4 hover:bg-white/7',
                )}
              >
                <div className="w-10 h-10 rounded-full bg-white/8 flex items-center justify-center">
                  <span className={cn('text-sm font-bold', p.color)}>{p.label[0]}</span>
                </div>
                <span className="text-sm font-medium text-white">{p.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Step: Details */}
        {step === 'details' && (
          <div className="flex flex-col gap-4 mt-2">
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Meter number</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Enter your meter number"
                value={meterNumber}
                onChange={e => setMeterNumber(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3.5 rounded-2xl bg-white/6 border border-white/10 text-white placeholder-white/25 text-sm focus:outline-none focus:border-[#d4a843]/50"
              />
            </div>
            <Button
              disabled={meterNumber.length < 5}
              onClick={() => setStep('verify')}
              className="mt-2"
            >
              Verify Meter
            </Button>
          </div>
        )}

        {/* Step: Verify */}
        {step === 'verify' && (
          <div className="flex flex-col items-center gap-6 mt-8 text-center">
            {verifying ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <Spinner size="lg" />
                <p className="text-sm text-white/50">Verifying meter…</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-white/50">Tap below to verify your meter number</p>
                {verifyError && (
                  <p className="text-sm text-red-400/80">{verifyError}</p>
                )}
                <Button onClick={handleVerify} className="w-full">Verify Now</Button>
              </>
            )}
          </div>
        )}

        {/* Step: Amount */}
        {step === 'amount' && (
          <div className="flex flex-col gap-4 mt-2">
            {(customerName || customerAddress) && (
              <div className="px-4 py-3 rounded-2xl bg-emerald-400/8 border border-emerald-400/20">
                <p className="text-xs text-emerald-400/70">Meter verified</p>
                {customerName && <p className="text-sm font-medium text-white">{customerName}</p>}
                {customerAddress && <p className="text-xs text-white/50 mt-0.5">{customerAddress}</p>}
              </div>
            )}
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Amount (NGN)</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 5000"
                value={amount}
                onChange={e => setAmount(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3.5 rounded-2xl bg-white/6 border border-white/10 text-white placeholder-white/25 text-sm focus:outline-none focus:border-[#d4a843]/50"
              />
              {rate && amount && (
                <p className="text-xs text-white/35 mt-1.5 px-1">
                  ≈ ${(parseInt(amount) / rate).toFixed(4)} USDC
                </p>
              )}
            </div>
            <Button
              disabled={!amount || parseInt(amount) < 500}
              onClick={() => setStep('summary')}
              className="mt-2"
            >
              Continue
            </Button>
          </div>
        )}

        {/* Step: Summary */}
        {step === 'summary' && (
          <div className="flex flex-col gap-4 mt-2">
            <p className="text-sm text-white/50 mb-1">Confirm your payment</p>
            <div className="rounded-2xl border border-white/8 bg-white/4 overflow-hidden">
              {[
                { label: 'Provider', value: providers.find(p => p.id === provider)?.label ?? provider },
                { label: 'Meter', value: meterNumber },
                ...(customerName ? [{ label: 'Customer', value: customerName }] : []),
                { label: 'Amount', value: `₦${parseInt(amount).toLocaleString()}` },
                { label: 'USDC cost', value: rate ? `$${(parseInt(amount) / rate).toFixed(4)} USDC` : '—' },
                { label: 'Fee', value: '$0.02 USDC' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between px-4 py-3 border-b border-white/6 last:border-0">
                  <span className="text-xs text-white/45">{label}</span>
                  <span className="text-sm text-white font-medium">{value}</span>
                </div>
              ))}
            </div>
            <Button onClick={() => setStep('pin')} className="mt-2">
              Proceed to PIN
            </Button>
          </div>
        )}

        {/* Step: PIN */}
        {step === 'pin' && (
          <div className="flex flex-col items-center gap-6 mt-8">
            {loading ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <Spinner size="lg" />
                <p className="text-sm text-white/50">Processing payment…</p>
              </div>
            ) : (
              <PinPad
                value={pin}
                onChange={setPin}
                label="Enter your 6-digit PIN to confirm"
              />
            )}
          </div>
        )}

        {/* Step: Success */}
        {step === 'success' && result && (
          <div className="flex flex-col items-center gap-6 mt-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-400/15 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-lg font-semibold text-white">Payment Successful!</p>
              <p className="text-sm text-white/50 mt-1">
                ₦{parseInt(result.amountNgn).toLocaleString()} electricity units purchased
              </p>
            </div>
            {result.purchasedCode && (
              <div className="w-full px-4 py-3 rounded-2xl bg-[#d4a843]/8 border border-[#d4a843]/20 text-center">
                <p className="text-xs text-[#d4a843]/70 mb-1">Token</p>
                <p className="text-base font-mono font-semibold text-white tracking-wider">
                  {result.purchasedCode}
                </p>
              </div>
            )}
            <div className="w-full rounded-2xl border border-white/8 bg-white/4 overflow-hidden">
              {[
                { label: 'Amount', value: `₦${parseInt(result.amountNgn).toLocaleString()}` },
                { label: 'USDC deducted', value: `$${parseFloat(result.amountUsdc).toFixed(4)}` },
                { label: 'Reference', value: result.reference },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between px-4 py-3 border-b border-white/6 last:border-0">
                  <span className="text-xs text-white/45">{label}</span>
                  <span className="text-sm text-white font-medium">{value}</span>
                </div>
              ))}
            </div>
            <Button onClick={() => router.push('/dashboard')} className="w-full">
              Back to Dashboard
            </Button>
          </div>
        )}

        {/* Step: Error */}
        {step === 'error' && (
          <div className="flex flex-col items-center gap-6 mt-8 text-center">
            <div className="w-16 h-16 rounded-full bg-red-400/15 flex items-center justify-center">
              <AlertCircle size={32} className="text-red-400" />
            </div>
            <div>
              <p className="text-lg font-semibold text-white">Payment Failed</p>
              <p className="text-sm text-white/50 mt-1">{errorMsg}</p>
            </div>
            <Button onClick={() => setStep('summary')} variant="secondary" className="w-full">
              Try Again
            </Button>
            <button
              type="button"
              onClick={() => router.push('/bills')}
              className="text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              Back to Bills
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
