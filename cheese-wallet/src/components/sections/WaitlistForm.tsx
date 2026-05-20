'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Check, X, AlertCircle, ChevronRight, Shield, Zap, Gift, type LucideIcon} from 'lucide-react';
import { registerWaitlist, checkUsername } from '@/lib/api';
import { notify } from '@/lib/toast';

function useDebounce<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}



export function WaitlistForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get('ref') || '';

  const [email, setEmail] = useState('');
  const [rawUsername, setRawUsername] = useState('');

  // Cleaned: lowercase, only a-z 0-9 _, max 20 chars
  const username = rawUsername.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().slice(0, 20);

  // Debounce the CLEANED username before hitting the API
  const debouncedUsername = useDebounce(username, 400);

  const { data: availability, isFetching: checking } = useQuery({
    queryKey: ['check-username', debouncedUsername],
    queryFn: () => checkUsername(debouncedUsername),
    enabled: debouncedUsername.length >= 3,
    retry: false,
    staleTime: 10_000,
  });


  const register = useMutation({
    mutationFn: registerWaitlist,
    onSuccess: (data) => {
      try {
        if (!data?.user) {
          console.error('Invalid registration response:', data);
          notify.error('Registration succeeded but response invalid');
          return;
        }
        sessionStorage.setItem('cheese_user', JSON.stringify(data.user));
        sessionStorage.setItem('cheese_referral_link', data.referralLink || '');
        router.push('/waitlist/confirmed');
      } catch (err: any) {
        console.error('Error processing registration:', err);
        notify.error(err?.message || 'Error processing registration');
      }
    },
    onError: (err: any) => {
      console.error('Registration error:', err);
      const msg = err?.response?.data?.message || err?.message;
      notify.error(Array.isArray(msg) ? msg.join(', ') : msg || 'Something went wrong.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { notify.error('Please enter your email'); return; }
    if (username.length < 3) { notify.error('Username must be at least 3 characters'); return; }
    if (availability && !availability.available) { 
      notify.error(availability.reason || 'That username is not available'); 
      return; 
    }

    register.mutate({ email: email.toLowerCase().trim(), username, referralCode: refCode || undefined });
  };

  const status = (() => {
    if (username.length < 3) return null;
    if (checking) return 'checking';
    if (!availability) return null;
    if (availability.reason && availability.reason.includes('Invalid')) return 'error';
    return availability.available ? 'available' : 'taken';
  })();

  return (
    <section id="waitlist" className="px-6 pb-24">
      <div className="max-w-lg mx-auto">
        <div className="relative bg-[#111] border border-white/[0.07] rounded-2xl p-8 opacity-0 animate-fade-up delay-500">
          <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_at_50%_0%,rgba(212,168,67,0.08)_0%,transparent_60%)] pointer-events-none" />

          <div className="relative">
            <h2 className="font-display text-3xl font-semibold text-white mb-1 tracking-tight">
              Claim your username
            </h2>
            <p className="text-sm text-[#666] mb-8">
              {refCode
                ? <span className="text-[#d4a843]">You were invited — you&apos;ll both earn bonus points.</span>
                : 'Free forever. No credit card required.'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-[10px] font-semibold text-[#666] uppercase tracking-widest mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={register.isPending}
                  className="w-full bg-[#1a1a1a] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white text-sm placeholder-[#444] focus:outline-none focus:border-[#d4a843]/40 transition-colors disabled:opacity-50"
                />
              </div>

              {/* Username */}
              <div>
                <label htmlFor="username" className="block text-[10px] font-semibold text-[#666] uppercase tracking-widest mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#d4a843] text-sm pointer-events-none font-medium">@</span>
                  <input
                    id="username"
                    type="text"
                    value={rawUsername}
                    onChange={(e) => setRawUsername(e.target.value)}
                    placeholder="username"
                    maxLength={24}
                    disabled={register.isPending}
                    className="w-full bg-[#1a1a1a] border border-white/[0.08] rounded-xl pl-8 pr-11 py-3.5 text-white text-sm font-mono placeholder-[#444] focus:outline-none focus:border-[#d4a843]/40 transition-colors disabled:opacity-50"
                    style={{
                      borderColor: status === 'available' ? 'rgba(212,168,67,0.45)'
                                 : status === 'taken'     ? 'rgba(239,68,68,0.4)'
                                 : status === 'error'     ? 'rgba(245,158,11,0.4)'
                                 : undefined,
                    }}
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    {status === 'checking'  && <Loader2 className="w-4 h-4 text-[#555] animate-spin" />}
                    {status === 'available' && <Check   className="w-4 h-4 text-[#00FF00]" />}
                    {status === 'taken'     && <X       className="w-4 h-4 text-red-400" />}
                    {status === 'error'     && <AlertCircle className="w-4 h-4 text-amber-400" />}
                  </div>
                </div>

                <div className="h-5 mt-1.5">
                  {status === 'available' && (
                    <p className="text-xs text-[#00FF00] opacity-0 animate-fade-in">✓ @{username} is available</p>
                  )}
                  {status === 'taken' && (
                    <p className="text-xs text-red-400 opacity-0 animate-fade-in">
                      {availability?.reason || `@${username} is already taken`}
                    </p>
                  )}
                  {status === 'error' && (
                    <p className="text-xs text-amber-400 opacity-0 animate-fade-in">
                      {availability?.reason}
                    </p>
                  )}
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={register.isPending || status === 'taken' || status === 'checking'}
                className="w-full flex items-center justify-center gap-2 bg-[#d4a843] hover:bg-[#c49535] disabled:opacity-50 disabled:cursor-not-allowed text-[#0a0a0a] font-bold text-sm py-4 rounded-xl mt-2 transition-all animate-pulse-gold"
              >
                {register.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Reserving…</>
                ) : (
                  <>Reserve My Username <ChevronRight className="w-4 h-4" /></>
                )}
              </button>
            </form>

            {/* Trust signals */}
            {/* <div className="flex items-center justify-center gap-6 mt-6 pt-6 border-t border-white/[0.05]">
              {[['🔒', 'Secure'], ['⚡', 'Instant'], ['🆓', 'Free']].map(([icon, text]) => (
                <div key={text} className="flex items-center gap-1.5 text-xs text-[#444]">
                  <span>{icon}</span><span>{text}</span>
                </div>
              ))}
            </div> */}
           <div className="flex items-center justify-center gap-6 mt-6 pt-6 border-t border-white/[0.05]">
  {([
    [Shield, 'Secure'],
    [Zap,    'Instant'],
    [Gift,   'Free'],
  ] as [LucideIcon, string][]).map(([Icon, text]) => (
    <div key={text} className="flex items-center gap-1.5 text-m text-[#d4a843]">
      <Icon size={13} />
      <span>{text}</span>
    </div>
  ))}
</div>
            <p className="text-center text-xs text-[#555] mt-5">
              Ready to create your full account?{' '}
              <a href="/signup" className="text-[#d4a843] hover:underline font-medium">Sign up</a>
              {' · '}
              <a href="/login" className="text-[#d4a843] hover:underline font-medium">Sign in</a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
