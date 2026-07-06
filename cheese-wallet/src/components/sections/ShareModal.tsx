'use client';

import { type ReactNode } from 'react';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, Check, ExternalLink, Trophy, MessageCircle, Send } from 'lucide-react';
import { trackShare, type SharePlatform } from '@/lib/api';
import { notify } from '@/lib/toast';

interface Platform {
  id: SharePlatform;
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
        `Just reserved @${u} on @CheeseWallet 🧀\n\nSend money with a username. Launching soon.\n\nSecure yours 👇\n${link}`,
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

interface Props {
  onClose: () => void;
}

export function ShareModal({ onClose }: Props) {
  const [sharedPlatforms, setSharedPlatforms] = useState<Set<string>>(new Set());

  // Read user from sessionStorage — only present after registration
  const storedUser = typeof window !== 'undefined'
    ? JSON.parse(sessionStorage.getItem('cheese_user') || 'null')
    : null;
  const referralLink = typeof window !== 'undefined'
    ? sessionStorage.getItem('cheese_referral_link') || ''
    : '';

  const shareMutation = useMutation({
    mutationFn: ({ platformId }: { platformId: SharePlatform }) =>
      trackShare({ userId: storedUser.id, platform: platformId }),
    onSuccess: (data, vars) => {
      setSharedPlatforms((prev) => new Set([...prev, vars.platformId]));
      notify.success(`+${data.pendingPoints} points pending verification!`);
    },
    onError: (err: any) => {
      notify.error(err?.response?.data?.message || 'Could not track share');
    },
  });

  const handleShare = (p: Platform) => {
    if (!storedUser) {
      notify.error('Reserve your username first to earn points');
      return;
    }
    window.open(p.shareUrl(referralLink, storedUser.username), '_blank', 'noopener,noreferrer');
    setTimeout(() => shareMutation.mutate({ platformId: p.id }), 1500);
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 mt-8"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-md bg-[#111] border border-white/[0.08] rounded-2xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-[#d4a843]" />
              <span className="text-xs text-[#d4a843] uppercase tracking-widest font-medium">
                Earn Points
              </span>
            </div>
            <h2 className="text-xl font-semibold text-white tracking-tight">
              Share to climb the leaderboard
            </h2>
            {storedUser && (
              <p className="text-xs text-[#555] mt-1">
                Sharing as <span className="text-[#d4a843]">@{storedUser.username}</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-[#555] hover:text-white transition-colors mt-0.5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Platforms */}
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
                  background:  shared ? '#1a1a1a' : p.bgColor + '18',
                  borderColor: shared ? 'rgba(255,255,255,0.06)' : p.bgColor + '50',
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

        {!storedUser && (
          <p className="text-center text-xs text-[#555] mt-5">
            <a href="/#waitlist" className="text-[#d4a843] hover:underline">
              Reserve your username
            </a>{' '}
            first to earn points from shares.
          </p>
        )}
      </div>
    </div>
  );
}
