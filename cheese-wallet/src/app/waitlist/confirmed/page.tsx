'use client';

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Check, Copy, ExternalLink, Trophy, MessageCircle, Send } from 'lucide-react';
import { trackShare } from '@/lib/api';
import { notify } from '@/lib/toast';

interface StoredUser {
  id: string;
  username: string;
  email: string;
  referralCode: string;
  points: number;
  createdAt: string;
}

// All share functions take (link, username) — platforms that don't need username just ignore it
type PlatformId = 'twitter' | 'linkedin' | 'whatsapp' | 'telegram' | 'facebook';

import type { ReactNode } from 'react';

interface Platform {
  id: PlatformId;
  label: string;
  points: number;
  textColor: string;
  bgColor: string;
  icon: ReactNode;
  shareUrl: (link: string, username: string) => string;
}

const PLATFORMS: Platform[] = [
  {
    id: 'twitter', label: 'Twitter / X', points: 10,
    textColor: '#000', bgColor: '#fff', icon: '𝕏',
    shareUrl: (link, u) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        `Just reserved @${u} on @Cheesepayxyz 🧀\n\n Save in USDC spend in fiat. Cryto Made Easy. Launching soon.\n\nSecure yours 👇\n${link}`,
      )}`,
  },
  {
    id: 'linkedin', label: 'LinkedIn', points: 8,
    textColor: '#fff', bgColor: '#0077b5', icon: 'in',
    shareUrl: (link, _u) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`,
  },
  {
    id: 'whatsapp', label: 'WhatsApp', points: 5,
    textColor: '#fff', bgColor: '#25d366', icon: <MessageCircle size={14} />,
    shareUrl: (link, u) =>
      `https://wa.me/?text=${encodeURIComponent(
        `I just reserved @${u} on Cheese Wallet 🧀\n\nSend money with a username. Get yours: ${link}`,
      )}`,
  },
  {
    id: 'telegram', label: 'Telegram', points: 5,
    textColor: '#fff', bgColor: '#2aabee', icon: <Send size={14} />,
    shareUrl: (link, u) =>
      `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(
        `I reserved @${u} on Cheese Wallet 🧀`,
      )}`,
  },
  {
    id: 'facebook', label: 'Facebook', points: 6,
    textColor: '#fff', bgColor: '#1877f2', icon: 'f',
    shareUrl: (link, _u) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
  },
];

export default function ConfirmedPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [referralLink, setReferralLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [sharedPlatforms, setSharedPlatforms] = useState<Set<string>>(new Set());
  const [totalPoints, setTotalPoints] = useState(0);

  useEffect(() => {
    const stored = sessionStorage.getItem('cheese_user');
    const link   = sessionStorage.getItem('cheese_referral_link');
    if (!stored) { router.push('/'); return; }
    const parsed: StoredUser = JSON.parse(stored);
    setUser(parsed);
    setReferralLink(link || '');
    setTotalPoints(parsed.points || 0);
  }, [router]);

  const shareMutation = useMutation({
    mutationFn: ({ platformId }: { platformId: PlatformId }) =>
      trackShare({ userId: user!.id, platform: platformId }),
    onSuccess: (data, vars) => {
      setSharedPlatforms((prev) => new Set([...Array.from(prev), vars.platformId]));
      setTotalPoints((prev) => prev + (data.pendingPoints || 0));
      notify.success(`+${data.pendingPoints} points pending verification!`);
    },
    onError: (err: any) => {
      notify.error(err?.response?.data?.message || 'Could not track share');
    },
  });

  const handleShare = (p: Platform) => {
    if (!user) return;
    window.open(p.shareUrl(referralLink, user.username), '_blank', 'noopener,noreferrer');
    setTimeout(() => shareMutation.mutate({ platformId: p.id }), 1500);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    notify.success('Copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-6 py-16">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(212,168,67,0.1)_0%,transparent_70%)]" />
      </div>

      <div className="relative w-full max-w-lg">
        {/* Main card */}
        <div className="bg-[#111] border border-white/[0.07] rounded-2xl p-8 mb-4 opacity-0 animate-fade-up">

          {/* Check */}
          <div className="w-14 h-14 rounded-full bg-[#d4a843]/10 border border-[#d4a843]/25 flex items-center justify-center mb-6">
            <Check className="w-7 h-7 text-[#d4a843]" />
          </div>

          <h1 className="font-display text-4xl font-bold text-white tracking-tight mb-2">
            @{user.username} is yours.
          </h1>
          <p className="text-[#666] text-sm mb-8">
            Your username is officially reserved. No one else can take it.
          </p>

          {/* Points */}
          <div className="flex items-center gap-3 p-4 bg-[#1a1a1a] rounded-xl border border-[#d4a843]/20 mb-8">
            <Trophy className="w-5 h-5 text-[#d4a843] shrink-0" />
            <div>
              <p className="text-[10px] text-[#888] uppercase tracking-widest">Founding Member Points</p>
              <p className="text-2xl font-semibold text-[#d4a843] font-mono">
                {totalPoints.toLocaleString()} pts
              </p>
            </div>
          </div>

          {/* Referral link */}
          <div className="mb-8">
            <p className="text-[10px] text-[#888] uppercase tracking-widest mb-2">Your referral link</p>
            <div className="flex gap-2">
              <div className="flex-1 bg-[#1a1a1a] border border-white/[0.07] rounded-xl px-4 py-3 text-sm text-[#d4a843] font-mono truncate">
                {referralLink}
              </div>
              <button
                onClick={handleCopy}
                className="px-4 bg-[#1a1a1a] border border-white/[0.07] rounded-xl text-[#666] hover:text-white transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-[#d4a843]" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Share buttons */}
          <div>
            <p className="text-sm font-medium text-white mb-1">Share to earn points</p>
            <p className="text-xs text-[#555] mb-4">
              Each share earns points. Referrals earn you 20 pts each.
            </p>
            <div className="space-y-2.5">
              {PLATFORMS.map((p) => {
                const shared = sharedPlatforms.has(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => handleShare(p)}
                    disabled={shared}
                    className="flex items-center justify-between w-full px-4 py-3.5 rounded-xl border transition-all duration-200 disabled:opacity-50 disabled:cursor-default"
                    style={{
                      background:   shared ? '#1a1a1a' : p.bgColor + '18',
                      borderColor:  shared ? 'rgba(255,255,255,0.06)' : p.bgColor + '50',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: p.bgColor, color: p.textColor }}
                      >
                        {p.icon}
                      </span>
                      <span className="text-sm font-medium text-white">{p.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {shared ? (
                        <span className="text-xs text-[#d4a843] flex items-center gap-1">
                          <Check className="w-3 h-3" /> Shared
                        </span>
                      ) : (
                        <>
                          <span className="text-xs font-semibold text-[#d4a843]">+{p.points} pts</span>
                          <ExternalLink className="w-3.5 h-3.5 text-[#555]" />
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Leaderboard link */}
        <a
          href="/waitlist/leaderboard"
          className="flex items-center justify-center gap-2 w-full py-3.5 text-sm text-[#666] hover:text-white border border-white/[0.06] hover:border-white/10 rounded-xl transition-colors opacity-0 animate-fade-up delay-200"
        >
          <Trophy className="w-4 h-4" />
          View Founding Members Leaderboard
        </a>
      </div>
    </main>
  );
}
