'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAdminRate, getAdminHealth, type AdminHealth } from '@/lib/api/admin';
import {
  c,
  IcoHome, IcoUsers, IcoShield, IcoFile, IcoSend, IcoBank, IcoCard,
  IcoLink, IcoWallet, IcoChain, IcoAlert, IcoList, IcoStar, IcoBell,
  IcoChevron, IcoSettings, IcoSearch,
} from './_shared';
import { useAdminAuthStore, ROLE_LABELS, ROLE_COLORS } from '@/store/adminAuthStore';

// ─── CSS (injected once here, available to all child pages) ───────────────────
const STYLES = `
  @keyframes pulse-green { 0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.5)}50%{box-shadow:0 0 0 4px rgba(34,197,94,0)} }
  @keyframes pulse-amber { 0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,.5)}50%{box-shadow:0 0 0 4px rgba(245,158,11,0)} }
  @keyframes pulse-red   { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.5)}50%{box-shadow:0 0 0 5px rgba(239,68,68,0)} }
  .pulse-green { animation: pulse-green 2s ease-in-out infinite; }
  .pulse-amber { animation: pulse-amber 2s ease-in-out infinite; }
  .pulse-red   { animation: pulse-red 1.6s ease-in-out infinite; }

  .kpi-card { transition: border-color .2s, box-shadow .2s; }
  .kpi-amber:hover { border-color: rgba(245,158,11,.28)!important; box-shadow: 0 4px 32px rgba(245,158,11,.08)!important; }
  .kpi-green:hover { border-color: rgba(34,197,94,.28)!important;  box-shadow: 0 4px 32px rgba(34,197,94,.08)!important; }
  .kpi-blue:hover  { border-color: rgba(96,165,250,.28)!important; box-shadow: 0 4px 32px rgba(96,165,250,.08)!important; }
  .kpi-red:hover   { border-color: rgba(239,68,68,.28)!important;  box-shadow: 0 4px 32px rgba(239,68,68,.08)!important; }

  .mod-card { transition: border-color .15s, background .15s; }
  .mod-card:hover     { border-color: rgba(255,255,255,.13)!important; background: #16161a!important; }
  .mod-alert:hover    { border-color: rgba(239,68,68,.25)!important; background: rgba(239,68,68,.07)!important; }
  .mod-card .mod-go   { opacity: 0; transition: opacity .15s; }
  .mod-card:hover .mod-go { opacity: 1; }

  .range-btn { border:none; cursor:pointer; border-radius:6px; font-size:11px; font-weight:600; padding:3px 9px; transition:background .12s,color .12s; font-family:inherit; }
  .range-btn:hover { color:#f4f4f5!important; }

  .tab-btn { border:none; cursor:pointer; border-radius:6px; font-size:11.5px; font-weight:500; padding:5px 12px; transition:background .12s,color .12s; font-family:inherit; white-space:nowrap; }
  .filter-btn { border:none; cursor:pointer; border-radius:99px; font-size:11px; font-weight:500; padding:4px 11px; transition:background .12s,color .12s; font-family:inherit; white-space:nowrap; }

  .topbar-search { transition: border-color .15s; }
  .topbar-search:hover { border-color: rgba(255,255,255,.13)!important; }

  .topbar-icon { cursor:pointer; display:flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:8px; border:none; background:transparent; transition:background .12s; }
  .topbar-icon:hover { background: rgba(255,255,255,.07)!important; }

  .export-btn { transition: background .12s; }
  .export-btn:hover { background: #fbbf24!important; }
  .invite-btn { transition: background .12s, border-color .12s; }
  .invite-btn:hover { background: rgba(245,158,11,.12)!important; border-color: rgba(245,158,11,.35)!important; }

  .row-hover { transition: background .1s; }
  .row-hover:hover { background: #16161a!important; }

  .alert-toggle { border:none; cursor:pointer; background:transparent; color:inherit; display:flex; align-items:center; gap:4px; padding:0; font-family:inherit; transition:opacity .12s; }
  .alert-toggle:hover { opacity:.75; }

  .nav-link { display:flex; align-items:center; gap:8px; text-decoration:none; font-size:13px; border-radius:8px; transition:background .12s, color .12s; }
  .nav-link:hover:not(.nav-active) { background: rgba(255,255,255,.04)!important; color:#f4f4f5!important; }

  .action-btn { border:none; cursor:pointer; background:transparent; font-family:inherit; transition:opacity .12s; border-radius:6px; }
  .action-btn:hover { opacity:.75; }

  .user-search-input { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.065); border-radius:8px; padding:7px 12px 7px 34px; font-size:12.5px; color:#f4f4f5; font-family:inherit; outline:none; width:100%; box-sizing:border-box; transition:border-color .15s; }
  .user-search-input::placeholder { color:rgba(244,244,245,.3); }
  .user-search-input:focus { border-color: rgba(245,158,11,.35); }
`;

// ─── Nav groups with route hrefs ──────────────────────────────────────────────
const NAV_GROUPS = [
  { label: 'Platform', items: [
    { label: 'Overview',      Icon: IcoHome,   href: '/admin'              },
    { label: 'Users',         Icon: IcoUsers,  href: '/admin/users'        },
    { label: 'KYC & Tiers',   Icon: IcoShield, href: '/admin/kyc'          },
    { label: 'Admins',        Icon: IcoShield, href: '/admin/admins'       },
  ]},
  { label: 'Finance', items: [
    { label: 'Transactions',  Icon: IcoFile,     href: '/admin/transactions' },
    { label: 'Transfers',     Icon: IcoSend,     href: '/admin/transfers'    },
    { label: 'Fee Revenue',   Icon: IcoStar,     href: '/admin/fees'         },
    { label: 'Treasury',      Icon: IcoWallet,   href: '/admin/treasury'     },
    { label: 'Bank Payouts',  Icon: IcoBank,     href: '/admin/bank'         },
    { label: 'Cards',         Icon: IcoCard,     href: '/admin/cards'        },
    { label: 'Pay Links',     Icon: IcoLink,     href: '/admin/paylinks'     },
    { label: 'Exchange Rate', Icon: IcoSettings, href: '/admin/rates'        },
  ]},
  { label: 'Infrastructure', items: [
    { label: 'Wallets',       Icon: IcoWallet, href: '/admin/wallets'      },
    { label: 'Blockchain',    Icon: IcoChain,  href: '/admin/blockchain'   },
    { label: 'Fraud & Trust', Icon: IcoAlert,  href: '/admin/fraud'        },
  ]},
  { label: 'Growth', items: [
    { label: 'Waitlist',      Icon: IcoList,   href: '/admin/waitlist'     },
    { label: 'Referrals',     Icon: IcoStar,   href: '/admin/referrals'    },
    { label: 'Broadcast',     Icon: IcoBell,   href: '/admin/broadcast'    },
    { label: 'Notifications', Icon: IcoBell,   href: '/admin/notifs'       },
  ]},
];

// ─── Layout ───────────────────────────────────────────────────────────────────
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname         = usePathname();
  const router           = useRouter();
  const { admin, isAuthenticated, logout, restoreSession, canAccess } = useAdminAuthStore();
  const [clock,       setClock]       = useState('');
  const [liveRate,    setLiveRate]    = useState<string | null>(null);
  const [health,      setHealth]      = useState<AdminHealth | null>(null);

  // ── Auth-expired listener — always registered so token expiry is handled ────
  useEffect(() => {
    const onExpired = () => { logout(); router.replace('/admin/login'); };
    window.addEventListener('admin:auth:expired', onExpired);
    return () => window.removeEventListener('admin:auth:expired', onExpired);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Session restore — validate stored session against backend on mount ──────
  useEffect(() => {
    if (pathname === '/admin/login') return;
    restoreSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated && pathname !== '/admin/login') {
      router.replace('/admin/login');
    } else if (
      isAuthenticated && admin?.mustChangePassword &&
      pathname !== '/admin/change-password'
    ) {
      router.replace('/admin/change-password');
    }
  }, [isAuthenticated, admin, pathname, router]);

  useEffect(() => {
    const fmt = () => new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
    setClock(fmt());
    const id = setInterval(() => setClock(fmt()), 60_000);
    return () => clearInterval(id);
  }, []);

  const fetchLiveRate = useCallback(async () => {
    try {
      const r = await getAdminRate();
      const val = parseFloat(r.effectiveRate);
      setLiveRate(val.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 }));
    } catch { /* show nothing on failure */ }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchLiveRate();
      const id = setInterval(fetchLiveRate, 60_000);
      return () => clearInterval(id);
    }
  }, [isAuthenticated, fetchLiveRate]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchHealth = () => getAdminHealth().then(setHealth).catch(console.error);
    fetchHealth();
    const id = setInterval(fetchHealth, 60_000);
    return () => clearInterval(id);
  }, [isAuthenticated]);

  // ── Login page — render without sidebar ───────────────────────────────────
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  // ── Waiting for redirect if not authed ────────────────────────────────────
  if (!isAuthenticated || !admin) return null;
  const effectiveAdmin = admin;

  const services = health ? [
    { name: 'Stellar Horizon', ok: health.stellar  },
    { name: 'EVM RPC',         ok: health.evm      },
    { name: 'PulseMFB API',    ok: health.pulsemfb },
    { name: 'Redis / BullMQ',  ok: health.redis    },
    { name: 'PostgreSQL',      ok: health.database },
  ] : [];
  const servicesDegraded = services.filter((s) => !s.ok).length;

  const activeLabel =
    NAV_GROUPS.flatMap((g) => g.items).find((i) => i.href === pathname)?.label ?? 'Overview';

  const roleCol     = ROLE_COLORS[effectiveAdmin.adminRole];
  const roleLabel   = ROLE_LABELS[effectiveAdmin.adminRole];
  const initials    = effectiveAdmin.name.slice(0, 2).toUpperCase();

  return (
    <>
      <style>{STYLES}</style>
      <div style={{
        display: 'flex', height: '100vh',
        background: c.bg, fontFamily: "'Inter', system-ui, sans-serif",
        overflow: 'hidden', color: c.text,
      }}>

        {/* ── Sidebar ───────────────────────────────────────────────── */}
        <aside style={{
          width: 216, background: c.sidebar,
          borderRight: `1px solid ${c.border}`,
          display: 'flex', flexDirection: 'column', flexShrink: 0,
          overflowY: 'auto',
        }}>

          {/* Logo */}
          <div style={{ padding: '18px 16px 14px', borderBottom: `1px solid ${c.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: c.amber,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 16, color: '#09090b',
                boxShadow: `0 0 14px rgba(245,158,11,0.25)`,
              }}>C</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: c.text, lineHeight: 1 }}>Cheese Pay</div>
                <div style={{ fontSize: 10, color: c.textDim, marginTop: 3 }}>Admin Console</div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {NAV_GROUPS.map((group) => {
              const visibleItems = group.items.filter((item) => canAccess(item.href));
              if (visibleItems.length === 0) return null;
              return (
                <div key={group.label}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: c.textDim, padding: '0 8px', marginBottom: 3 }}>
                    {group.label}
                  </div>
                  {visibleItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`nav-link${isActive ? ' nav-active' : ''}`}
                        style={{
                          padding: isActive ? '6.5px 8px 6.5px 6px' : '6.5px 8px',
                          borderLeft: isActive ? `2px solid ${c.amber}` : '2px solid transparent',
                          background: isActive ? 'rgba(245,158,11,0.08)' : 'transparent',
                          color: isActive ? c.text : c.textMid,
                          fontWeight: isActive ? 500 : 400,
                        }}
                      >
                        <item.Icon />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          {/* Services health */}
          <div style={{ padding: '10px 16px 6px', borderTop: `1px solid ${c.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: c.textDim }}>
                Services
              </div>
              {servicesDegraded > 0 && (
                <span style={{ fontSize: 9.5, fontWeight: 600, color: c.amber, background: c.amberDim, border: `1px solid ${c.amberBrd}`, padding: '1px 6px', borderRadius: 99 }}>
                  {servicesDegraded} degraded
                </span>
              )}
            </div>
            {services.map((svc) => (
              <div key={svc.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: svc.ok ? c.textDim : c.textMid }}>{svc.name}</span>
                <span
                  className={svc.ok ? '' : 'pulse-amber'}
                  style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: svc.ok ? c.green : c.amber, display: 'inline-block' }}
                />
              </div>
            ))}
          </div>

          {/* Profile */}
          <div style={{ padding: '10px 14px 14px', borderTop: `1px solid ${c.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: roleCol.bg, border: `1px solid ${roleCol.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: roleCol.text, flexShrink: 0,
              }}>{initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: c.text }}>{effectiveAdmin.name}</div>
                <div style={{ fontSize: 10, color: c.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {effectiveAdmin.email}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 }}>
              <span style={{
                fontSize: 10.5, fontWeight: 600,
                background: roleCol.bg, color: roleCol.text, border: `1px solid ${roleCol.border}`,
                padding: '2px 8px', borderRadius: 99,
              }}>{roleLabel}</span>
              <button
                onClick={async () => { await logout(); router.replace('/admin/login'); }}
                style={{
                  fontSize: 11, color: c.textDim, background: 'transparent',
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  padding: '2px 4px',
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </aside>

        {/* ── Right panel ───────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Topbar */}
          <div style={{
            height: 54, borderBottom: `1px solid ${c.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 24px', flexShrink: 0, gap: 16,
          }}>
            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: c.textDim, flexShrink: 0 }}>
              <span>Dashboard</span>
              <span style={{ opacity: 0.4 }}><IcoChevron /></span>
              <span style={{ color: c.text, fontWeight: 500 }}>{activeLabel}</span>
            </div>

            {/* Search */}
            <div className="topbar-search" style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${c.border}`,
              borderRadius: 8, padding: '5px 12px',
              width: 210, cursor: 'default', flexShrink: 0,
            }}>
              <span style={{ color: c.textDim, display: 'flex' }}><IcoSearch /></span>
              <span style={{ fontSize: 12, color: c.textDim, flex: 1 }}>Search...</span>
              <span style={{ fontSize: 10, color: c.textDim, background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: 4, fontFamily: 'monospace' }}>⌘K</span>
            </div>

            {/* Right cluster */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              {liveRate && (
                <div style={{ fontSize: 11, color: c.textMid, background: 'rgba(255,255,255,0.04)', border: `1px solid ${c.border}`, padding: '4px 11px', borderRadius: 99, fontWeight: 500 }}>
                  ₦{liveRate} <span style={{ opacity: 0.4 }}>/</span> USD
                </div>
              )}
              {clock && (
                <div style={{ fontSize: 11.5, color: c.textDim, fontVariantNumeric: 'tabular-nums', minWidth: 34, textAlign: 'right' }}>{clock}</div>
              )}
              <button className="topbar-icon" style={{ position: 'relative', color: c.textMid }}>
                <IcoBell />
                {servicesDegraded > 0 && (
                  <span style={{
                    position: 'absolute', top: 5, right: 5,
                    width: 14, height: 14, borderRadius: '50%',
                    background: c.red, color: '#fff',
                    fontSize: 8, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `2px solid ${c.bg}`, lineHeight: 1,
                  }}>{servicesDegraded}</span>
                )}
              </button>
              {servicesDegraded > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: c.amberDim, border: `1px solid ${c.amberBrd}`, borderRadius: 99, padding: '4px 11px' }}>
                  <span className="pulse-amber" style={{ width: 5, height: 5, borderRadius: '50%', background: c.amber, display: 'inline-block' }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: c.amber }}>{servicesDegraded} service{servicesDegraded !== 1 ? 's' : ''} degraded</span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: c.greenDim, border: `1px solid rgba(34,197,94,0.18)`, borderRadius: 99, padding: '4px 11px' }}>
                  <span className="pulse-green" style={{ width: 5, height: 5, borderRadius: '50%', background: c.green, display: 'inline-block' }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: c.green }}>All systems live</span>
                </div>
              )}
              <button className="export-btn" style={{
                fontSize: 12, fontWeight: 600, color: '#09090b',
                background: c.amber, border: 'none',
                padding: '6px 16px', borderRadius: 8, cursor: 'pointer',
              }}>Export</button>
            </div>
          </div>

          {/* Page content */}
          <main style={{ flex: 1, overflow: 'hidden' }}>
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
