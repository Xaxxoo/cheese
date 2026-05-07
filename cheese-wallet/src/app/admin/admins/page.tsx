'use client';

import { useState, useEffect } from 'react';
import { c, IcoPlus, IcoShield, Pill } from '../_shared';
import { useAdminAuthStore, ROLE_LABELS, ROLE_COLORS } from '@/store/adminAuthStore';
import type { AdminRole } from '@/store/adminAuthStore';
import {
  listAdmins,
  createAdmin,
  updateAdminRole,
  revokeAdmin,
  type AdminListItem,
} from '@/lib/api/admin';

const ALL_ROLES: AdminRole[] = ['super_admin', 'operator', 'treasurer', 'support'];

function roleStyle(r: AdminRole | null) {
  if (!r) return { color: c.textDim, bg: 'transparent', brd: 'transparent' };
  const col = ROLE_COLORS[r];
  return { color: col.text, bg: col.bg, brd: col.border };
}

// ─── Admins page ──────────────────────────────────────────────────────────────
export default function AdminsPage() {
  const { admin: me } = useAdminAuthStore();
  const isSuperAdmin = me?.adminRole === 'super_admin';

  const [admins,      setAdmins]      = useState<AdminListItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [fetchError,  setFetchError]  = useState('');

  const [formOpen,    setFormOpen]    = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [formError,   setFormError]   = useState('');

  const [email,       setEmail]       = useState('');
  const [fullName,    setFullName]    = useState('');
  const [password,    setPassword]    = useState('');
  const [newRole,     setNewRole]     = useState<AdminRole>('support');

  // ── Fetch on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    listAdmins()
      .then((data) => setAdmins(data))
      .catch((err: unknown) => setFetchError((err as Error).message ?? 'Failed to load admins'))
      .finally(() => setLoading(false));
  }, []);

  // ── Create ──────────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const created = await createAdmin({ email, fullName, password, adminRole: newRole });
      const item: AdminListItem = { ...created, createdAt: new Date().toISOString() };
      setAdmins((prev) => [item, ...prev]);
      setFormOpen(false);
      setEmail(''); setFullName(''); setPassword(''); setNewRole('support');
    } catch (err: unknown) {
      setFormError((err as Error).message ?? 'Failed to create admin');
    } finally {
      setSaving(false);
    }
  }

  // ── Update role ─────────────────────────────────────────────────────────
  async function handleRoleChange(id: string, role: AdminRole) {
    setAdmins((prev) => prev.map((a) => a.id === id ? { ...a, adminRole: role } : a));
    try {
      await updateAdminRole(id, role);
    } catch (err: unknown) {
      setFetchError((err as Error).message ?? 'Failed to update role');
    }
  }

  // ── Revoke ──────────────────────────────────────────────────────────────
  async function handleRevoke(id: string) {
    try {
      await revokeAdmin(id);
      setAdmins((prev) => prev.filter((a) => a.id !== id));
    } catch (err: unknown) {
      setFetchError((err as Error).message ?? 'Failed to revoke admin');
    }
  }

  const card = {
    background: c.surface,
    border:     `1px solid ${c.border}`,
    borderRadius: 14,
  };

  const inp = {
    background:   'rgba(255,255,255,0.04)',
    border:       `1px solid ${c.border}`,
    borderRadius: 8,
    padding:      '7px 11px',
    fontSize:     12.5,
    color:        c.text,
    fontFamily:   'inherit',
    outline:      'none',
    width:        '100%',
    boxSizing:    'border-box' as const,
  };

  const COLS = ['Name', 'Email', 'Role', 'Joined', ''];

  return (
    <div style={{ padding: '28px 28px', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>

      {/* ── Header ────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: c.text }}>Admins</div>
          <div style={{ fontSize: 12.5, color: c.textDim, marginTop: 3 }}>
            Manage admin accounts and roles
          </div>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => { setFormOpen((o) => !o); setFormError(''); }}
            style={{
              display:     'flex',
              alignItems:  'center',
              gap:          6,
              fontSize:     12.5,
              fontWeight:   600,
              color:        '#09090b',
              background:   c.amber,
              border:       'none',
              borderRadius: 8,
              padding:      '8px 16px',
              cursor:       'pointer',
              fontFamily:   'inherit',
            }}
          >
            <IcoPlus /> New admin
          </button>
        )}
      </div>

      {/* ── Create form ───────────────────────────────────── */}
      {formOpen && (
        <div style={{ ...card, padding: '20px 22px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 16 }}>
            Create admin
          </div>
          <form onSubmit={(e) => { void handleCreate(e); }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: c.textDim, display: 'block', marginBottom: 5 }}>Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@cheese.app"
                  style={inp}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: c.textDim, display: 'block', marginBottom: 5 }}>Full name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  style={inp}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: c.textDim, display: 'block', marginBottom: 5 }}>Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  style={inp}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: c.textDim, display: 'block', marginBottom: 5 }}>Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as AdminRole)}
                  style={{ ...inp, cursor: 'pointer' }}
                >
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
            </div>

            {formError && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: `1px solid rgba(239,68,68,0.2)`,
                borderRadius: 8, padding: '8px 12px', fontSize: 12, color: c.red, marginBottom: 12,
              }}>
                {formError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                style={{
                  fontSize: 12.5, fontWeight: 500, color: c.textMid,
                  background: 'transparent', border: `1px solid ${c.border}`,
                  borderRadius: 7, padding: '7px 16px', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  fontSize: 12.5, fontWeight: 600, color: '#09090b',
                  background: saving ? 'rgba(245,158,11,0.6)' : c.amber,
                  border: 'none', borderRadius: 7, padding: '7px 18px',
                  cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Error banner ──────────────────────────────────── */}
      {fetchError && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: `1px solid rgba(239,68,68,0.2)`,
          borderRadius: 8, padding: '10px 14px', fontSize: 12.5, color: c.red, marginBottom: 16,
        }}>
          {fetchError}
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────── */}
      <div style={card}>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.4fr 1fr 1fr auto',
          padding: '10px 18px',
          borderBottom: `1px solid ${c.border}`,
        }}>
          {COLS.map((col) => (
            <div key={col} style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: c.textDim }}>
              {col}
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '32px 18px', textAlign: 'center', fontSize: 13, color: c.textDim }}>
            Loading…
          </div>
        ) : admins.length === 0 ? (
          <div style={{ padding: '32px 18px', textAlign: 'center', fontSize: 13, color: c.textDim }}>
            No admins found.
          </div>
        ) : (
          admins.map((adm) => {
            const isMe = adm.id === me?.id;
            const rs   = roleStyle(adm.adminRole);
            const joined = adm.createdAt
              ? new Date(adm.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
              : '—';

            return (
              <div
                key={adm.id}
                className="row-hover"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1.4fr 1fr 1fr auto',
                  padding: '13px 18px',
                  borderBottom: `1px solid ${c.border}`,
                  alignItems: 'center',
                }}
              >
                {/* Name */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: c.text }}>{adm.name}</div>
                  {isMe && <div style={{ fontSize: 10, color: c.amber, marginTop: 2 }}>You</div>}
                </div>

                {/* Email */}
                <div style={{ fontSize: 12.5, color: c.textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12 }}>
                  {adm.email}
                </div>

                {/* Role dropdown */}
                <div>
                  {isSuperAdmin && !isMe ? (
                    <select
                      value={adm.adminRole ?? ''}
                      onChange={(e) => { void handleRoleChange(adm.id, e.target.value as AdminRole); }}
                      style={{
                        fontSize:     11.5,
                        fontWeight:   600,
                        color:        rs.color,
                        background:   rs.bg,
                        border:       `1px solid ${rs.brd}`,
                        borderRadius: 99,
                        padding:      '3px 10px',
                        cursor:       'pointer',
                        fontFamily:   'inherit',
                        outline:      'none',
                      }}
                    >
                      {ALL_ROLES.map((r) => (
                        <option key={r} value={r} style={{ background: c.surface, color: c.text }}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Pill
                      label={adm.adminRole ? ROLE_LABELS[adm.adminRole] : '—'}
                      color={rs.color}
                      bg={rs.bg}
                      brd={rs.brd}
                    />
                  )}
                </div>

                {/* Joined */}
                <div style={{ fontSize: 12, color: c.textDim }}>{joined}</div>

                {/* Revoke */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', minWidth: 72 }}>
                  {isSuperAdmin && !isMe && (
                    <button
                      onClick={() => { void handleRevoke(adm.id); }}
                      style={{
                        fontSize:     11.5,
                        fontWeight:   600,
                        color:        c.red,
                        background:   'rgba(239,68,68,0.08)',
                        border:       `1px solid rgba(239,68,68,0.2)`,
                        borderRadius: 7,
                        padding:      '4px 12px',
                        cursor:       'pointer',
                        fontFamily:   'inherit',
                      }}
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
