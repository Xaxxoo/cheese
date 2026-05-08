'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { c } from '../_shared';
import { useAdminAuthStore } from '@/store/adminAuthStore';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { changePassword, admin } = useAdminAuthStore();

  const [current,  setCurrent]  = useState('');
  const [next,     setNext]     = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (next.length < 8) { setError('New password must be at least 8 characters'); return; }
    if (next !== confirm) { setError('Passwords do not match'); return; }
    if (next === current) { setError('New password must differ from current password'); return; }

    setSaving(true);
    const { ok, error: err } = await changePassword(current, next);
    setSaving(false);

    if (!ok) { setError(err ?? 'Failed to update password'); return; }
    router.replace('/admin');
  };

  const inputStyle = {
    width: '100%', boxSizing: 'border-box' as const,
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${c.border}`,
    borderRadius: 8, padding: '10px 14px',
    fontSize: 14, color: c.text,
    fontFamily: 'inherit', outline: 'none',
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: c.bg, fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{
        width: '100%', maxWidth: 400,
        background: c.surface, border: `1px solid ${c.border}`,
        borderRadius: 16, padding: 32,
      }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: c.amber, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontWeight: 800, fontSize: 20,
            color: '#09090b', marginBottom: 16,
          }}>C</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: c.text, margin: '0 0 6px' }}>
            Set a new password
          </h1>
          <p style={{ fontSize: 13, color: c.textDim, margin: 0 }}>
            {admin?.name ? `Welcome, ${admin.name}.` : 'Welcome.'} You must change your password before continuing.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 11.5, color: c.textDim, display: 'block', marginBottom: 6 }}>
              Current password
            </label>
            <input
              type="password"
              value={current}
              onChange={e => setCurrent(e.target.value)}
              autoComplete="current-password"
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ fontSize: 11.5, color: c.textDim, display: 'block', marginBottom: 6 }}>
              New password <span style={{ opacity: 0.5 }}>(min 8 characters)</span>
            </label>
            <input
              type="password"
              value={next}
              onChange={e => setNext(e.target.value)}
              autoComplete="new-password"
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ fontSize: 11.5, color: c.textDim, display: 'block', marginBottom: 6 }}>
              Confirm new password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{
              fontSize: 12, color: c.red, background: c.redDim,
              border: `1px solid rgba(239,68,68,0.2)`,
              borderRadius: 8, padding: '8px 12px',
            }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              background: c.amber, color: '#09090b',
              border: 'none', borderRadius: 8,
              padding: '11px 20px', fontSize: 13, fontWeight: 700,
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.7 : 1,
              fontFamily: 'inherit', marginTop: 4,
            }}
          >
            {saving ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
