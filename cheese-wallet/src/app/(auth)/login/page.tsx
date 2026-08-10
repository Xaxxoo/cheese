'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { notify } from '@/lib/toast';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';
import { login } from '@/lib/api/auth';
import { generateDeviceKey, signDeviceChallenge } from '@/lib/crypto/deviceSigning';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, ensureDeviceId, setBooting } = useAuthStore();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    identifier?: string;
    password?: string;
  }>({});
  const [deviceError, setDeviceError] = useState(false);

  // Auth boot: mark booting done (layout already checked user)
  useEffect(() => {
    setBooting(false);
  }, [setBooting]);

  function validate() {
    const e: typeof errors = {};
    if (!identifier.trim()) e.identifier = 'Email or username is required';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setDeviceError(false);

    try {
      const deviceId = ensureDeviceId();

      // Attempt to sign with the existing local key.
      // If IndexedDB was cleared the key won't be there — catch that case and
      // transparently recover by generating a fresh key pair for the same
      // deviceId, then asking the backend to update its stored public key.
      let deviceSignature: string;
      let keyRecovery = false;
      let newPublicKey: string | undefined;

      try {
        deviceSignature = await signDeviceChallenge(deviceId);
      } catch (keyErr) {
        const isKeyMissing =
          keyErr instanceof Error &&
          /device key not found/i.test(keyErr.message);
        if (!isKeyMissing) throw keyErr;

        // Regenerate key for the same deviceId — IndexedDB was cleared.
        const generated = await generateDeviceKey(deviceId);
        newPublicKey = generated.publicKey;
        deviceSignature = await signDeviceChallenge(deviceId);
        keyRecovery = true;
      }

      const { user, tokens } = await login({
        identifier: identifier.trim(),
        password,
        deviceId,
        deviceSignature,
        ...(keyRecovery && newPublicKey ? { keyRecovery: true, newPublicKey } : {}),
      });

      setAuth(user, tokens.accessToken);
      router.replace('/dashboard');
    } catch (err) {
      const authError = err as Error & {
        errorCode?: string;
        email?: string;
      };
      if (authError.errorCode === 'EMAIL_NOT_VERIFIED') {
        const email =
          authError.email ??
          (identifier.includes('@') ? identifier.trim().toLowerCase() : '');
        notify.error(
          "Verify your email before signing in. We've taken you back to the code screen.",
        );
        router.push(
          `/signup?mode=verify${email ? `&email=${encodeURIComponent(email)}` : ''}`,
        );
        return;
      }

      const msg =
        err instanceof Error ? err.message : 'Login failed. Please try again.';
      // If the backend rejects the device (e.g. device was deactivated, or
      // recovery failed), direct the user to the add-device flow.
      const isDeviceError = /device|signature|unrecognized/i.test(msg);
      if (isDeviceError) {
        setDeviceError(true);
      } else {
        notify.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-1">Welcome back</h1>
        <p className="text-sm text-white/45">Sign in to your Cheese account</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email or username"
          type="text"
          autoComplete="username"
          placeholder="you@example.com or @username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          error={errors.identifier}
          autoCapitalize="none"
          spellCheck={false}
        />

        <Input
          label="Password"
          type={showPw ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          suffix={
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="text-white/40 hover:text-white/70 transition-colors"
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        />

        {deviceError && (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <div className="w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center shrink-0 mt-0.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-400">Unrecognised device</p>
              <p className="text-xs text-white/50 mt-0.5">This device is not registered to your account. Register it below to continue.</p>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center">
          <Link
            href="/add-device"
            className={deviceError
              ? "text-sm font-semibold text-[#d4a843] underline underline-offset-2 animate-pulse"
              : "text-xs text-white/40 hover:text-white/70 transition-colors"
            }
          >
            {deviceError ? 'Register this device' : 'New device? Register it'}
          </Link>
          <Link
            href="/forgot-password"
            className="text-xs text-[#d4a843]/80 hover:text-[#d4a843] transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          fullWidth
          size="lg"
          loading={loading}
          className="mt-2"
        >
          Sign in
        </Button>
      </form>

      <p className="text-sm text-white/40 text-center mt-8">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-[#d4a843] hover:underline">
          Create account
        </Link>
      </p>
    </div>
  );
}
