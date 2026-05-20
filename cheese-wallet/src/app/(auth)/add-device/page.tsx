'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle } from 'lucide-react';
import { notify } from '@/lib/toast';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useAuthStore } from '@/store/authStore';
import { generateDeviceKey } from '@/lib/crypto/deviceSigning';
import {
  requestDeviceRegistration,
  completeDeviceRegistrationByLink,
} from '@/lib/api/auth';

// ── Magic-link handler ──────────────────────────────────────
// Runs when the page is opened with ?token=... in the URL.
// Generates a fresh deviceId + key pair on THIS device, then
// calls the backend to register it — no typing required.
function MagicLinkRegistration({ token }: { token: string }) {
  const { ensureDeviceId, setBooting } = useAuthStore();
  const [state, setState] = useState<'registering' | 'done' | 'error'>(
    'registering',
  );
  const [errorMsg, setErrorMsg] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    setBooting(false);
  }, [setBooting]);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    async function register() {
      try {
        // Generate a new deviceId and key pair on this device
        const deviceId = ensureDeviceId();
        const { publicKey } = await generateDeviceKey(deviceId);
        await completeDeviceRegistrationByLink({ token, deviceId, publicKey });
        setState('done');
      } catch (err) {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'The link is invalid or has expired.',
        );
        setState('error');
      }
    }

    register();
  }, [token, ensureDeviceId]);

  if (state === 'registering') {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <Spinner size="lg" />
        <p className="text-sm text-white/45">Registering this device…</p>
      </div>
    );
  }

  if (state === 'done') {
    return (
      <div className="flex flex-col items-center gap-5 py-12 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-400/10 flex items-center justify-center">
          <CheckCircle2 size={28} className="text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white mb-1">
            Device registered
          </h1>
          <p className="text-sm text-white/45">
            This device is now authorised. You can sign in normally.
          </p>
        </div>
        <Link
          href="/login"
          className="mt-2 inline-flex items-center justify-center h-12 px-8 rounded-2xl bg-[#d4a843] text-black text-sm font-semibold hover:bg-[#c49a38] transition-colors"
        >
          Go to login
        </Link>
      </div>
    );
  }

  // error
  return (
    <div className="flex flex-col items-center gap-5 py-12 text-center">
      <div className="w-14 h-14 rounded-full bg-red-400/10 flex items-center justify-center">
        <XCircle size={28} className="text-red-400" />
      </div>
      <div>
        <h1 className="text-xl font-semibold text-white mb-1">Link expired</h1>
        <p className="text-sm text-white/45">
          {errorMsg || 'This link is invalid or has already been used.'}
        </p>
      </div>
      <Link
        href="/add-device"
        className="text-sm text-[#d4a843] hover:underline"
      >
        Request a new link
      </Link>
    </div>
  );
}

// ── Request form ────────────────────────────────────────────
// Shown when the page is opened without a token — lets the user
// request a magic link to be sent to their email.
function RequestLinkForm() {
  const { setBooting } = useAuthStore();
  const [step, setStep] = useState<'form' | 'sent'>('form');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setBooting(false);
  }, [setBooting]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await requestDeviceRegistration(email.trim().toLowerCase());
      setStep('sent');
    } catch {
      notify.error('Could not send link. Check your email and try again.');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'sent') {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1">
            Check your email
          </h1>
          <p className="text-sm text-white/45">
            We sent a device registration link to{' '}
            <span className="text-white/70">{email}</span>.
          </p>
        </div>
        <p className="text-sm text-white/35">
          Open the email on the device you want to register and click the link.
          It will automatically set up this device — no code to type.
        </p>
        <button
          type="button"
          onClick={() => setStep('form')}
          className="text-xs text-white/40 hover:text-white/70 transition-colors text-left"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-white mb-1">
          Register this device
        </h1>
        <p className="text-sm text-white/45">
          Enter your account email. We&apos;ll send a link — open it on the
          device you want to authorise.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />
        <Button type="submit" fullWidth size="lg" loading={loading}>
          Send link
        </Button>
        <Link
          href="/login"
          className="text-xs text-center text-white/40 hover:text-white/70 transition-colors"
        >
          Back to login
        </Link>
      </form>
    </div>
  );
}

// ── Page shell ──────────────────────────────────────────────
function AddDeviceContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  if (token) {
    return <MagicLinkRegistration token={token} />;
  }

  return <RequestLinkForm />;
}

export default function AddDevicePage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center gap-4 py-16">
          <Spinner size="lg" />
        </div>
      }
    >
      <AddDeviceContent />
    </Suspense>
  );
}
