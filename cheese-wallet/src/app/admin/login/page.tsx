'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuthStore, ROLE_LABELS, ROLE_COLORS } from '@/store/adminAuthStore';
import { c } from '../_shared';

const LOGIN_STYLES = `
  * { box-sizing: border-box; }

  .admin-input {
    width: 100%;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px;
    padding: 11px 14px;
    font-size: 13.5px;
    color: #f4f4f5;
    font-family: inherit;
    outline: none;
    transition: border-color .15s, background .15s;
  }
  .admin-input::placeholder { color: rgba(244,244,245,0.3); }
  .admin-input:focus {
    border-color: rgba(245,158,11,0.45);
    background: rgba(255,255,255,0.06);
  }

  .signin-btn {
    width: 100%;
    background: #f59e0b;
    color: #09090b;
    border: none;
    border-radius: 10px;
    padding: 11px;
    font-size: 13.5px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    transition: background .15s, opacity .15s;
  }
  .signin-btn:hover:not(:disabled) { background: #fbbf24; }
  .signin-btn:disabled { opacity: 0.55; cursor: not-allowed; }

  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner {
    width: 14px; height: 14px;
    border: 2px solid rgba(9,9,11,0.3);
    border-top-color: #09090b;
    border-radius: 50%;
    animation: spin .7s linear infinite;
    display: inline-block;
  }
`;

export default function AdminLoginPage() {
  const router  = useRouter();
  const login   = useAdminAuthStore((s) => s.login);

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);

    setLoading(false);

    if (result.ok) {
      router.replace('/admin');
    } else {
      setError(result.error ?? 'Login failed. Please try again.');
    }
  }

  return (
    <>
      <style>{LOGIN_STYLES}</style>
      <div style={{
        minHeight: '100vh',
        background: c.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', system-ui, sans-serif",
        padding: '24px 16px',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 36 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 13,
              background: c.amber,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 20, color: '#09090b',
              boxShadow: '0 0 20px rgba(245,158,11,0.3)',
              flexShrink: 0,
            }}>C</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: c.text, lineHeight: 1.1 }}>Cheese Pay</div>
              <div style={{ fontSize: 11.5, color: c.textDim, marginTop: 3 }}>Admin Console</div>
            </div>
          </div>

          {/* Card */}
          <div style={{
            background: c.surface,
            border: `1px solid ${c.border}`,
            borderRadius: 16,
            padding: '28px 28px 24px',
          }}>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: c.text, margin: 0, lineHeight: 1.2 }}>
                Sign in
              </h1>
              <p style={{ fontSize: 12.5, color: c.textMid, margin: '6px 0 0' }}>
                Access restricted to authorised personnel only.
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Email */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11.5, fontWeight: 500, color: c.textMid }}>
                  Email address
                </label>
                <input
                  className="admin-input"
                  type="email"
                  placeholder="admin@cheese.app"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              {/* Password */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11.5, fontWeight: 500, color: c.textMid }}>
                  Password
                </label>
                <input
                  className="admin-input"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 8,
                  padding: '9px 12px',
                  fontSize: 12.5,
                  color: '#ef4444',
                }}>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                className="signin-btn"
                type="submit"
                disabled={loading}
                style={{ marginTop: 4 }}
              >
                {loading
                  ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <span className="spinner" /> Signing in…
                    </span>
                  : 'Sign in'
                }
              </button>
            </form>
          </div>

          {/* Dev hint */}
          <div style={{
            marginTop: 20,
            background: 'rgba(167,139,250,0.06)',
            border: '1px solid rgba(167,139,250,0.15)',
            borderRadius: 10,
            padding: '12px 16px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(167,139,250,0.7)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Dev — role test emails
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(['super_admin', 'operator', 'treasurer', 'support'] as const).map((role) => {
                const col = ROLE_COLORS[role];
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setEmail(`${role}@cheese.app`)}
                    style={{
                      background: col.bg,
                      border: `1px solid ${col.border}`,
                      color: col.text,
                      borderRadius: 6,
                      padding: '3px 9px',
                      fontSize: 11,
                      fontWeight: 500,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    {ROLE_LABELS[role]}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 10.5, color: c.textDim, marginTop: 8 }}>
              Fill email only — enter the real password for this account.
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
