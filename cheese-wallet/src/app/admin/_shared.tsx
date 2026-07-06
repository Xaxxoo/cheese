// Shared palette, icons, and utility components for the admin panel.
// Not a route — underscore prefix keeps Next.js from treating it as one.

// ─── Palette ──────────────────────────────────────────────────────────────────
export const c = {
  bg:         '#09090b',
  surface:    '#111114',
  surfaceHov: '#16161a',
  border:     'rgba(255,255,255,0.065)',
  borderHov:  'rgba(255,255,255,0.13)',
  text:       '#f4f4f5',
  textMid:    'rgba(244,244,245,0.5)',
  textDim:    'rgba(244,244,245,0.25)',
  amber:      '#f59e0b',
  amberDim:   'rgba(245,158,11,0.12)',
  amberBrd:   'rgba(245,158,11,0.22)',
  green:      '#22c55e',
  greenDim:   'rgba(34,197,94,0.1)',
  red:        '#ef4444',
  redDim:     'rgba(239,68,68,0.1)',
  blue:       '#60a5fa',
  blueDim:    'rgba(96,165,250,0.1)',
  purple:     '#a78bfa',
  purpleDim:  'rgba(167,139,250,0.1)',
  sidebar:    '#0a0a0e',
};

// ─── Icon factory ─────────────────────────────────────────────────────────────
export const I = (d: string, extra?: string) => () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
    {extra && <path d={extra} />}
  </svg>
);

// ─── Icons ────────────────────────────────────────────────────────────────────
export const IcoHome      = I('M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z', 'M9 22V12h6v10');
export const IcoUsers     = I('M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2', 'M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75');
export const IcoShield    = I('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z');
export const IcoFile      = I('M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z', 'M14 2v6h6M16 13H8M16 17H8');
export const IcoSend      = I('M22 2L11 13', 'M22 2l-7 20-4-9-9-4 20-7z');
export const IcoBank      = I('M3 9l9-4 9 4v1H3V9zM5 10v7M9 10v7M15 10v7M19 10v7M3 17h18');
export const IcoCard      = I('M1 4h22v16H1z', 'M1 10h22');
export const IcoLink      = I('M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71');
export const IcoWallet    = I('M21 12V7H5a2 2 0 010-4h14v4', 'M3 5v14a2 2 0 002 2h16v-5M18 12a2 2 0 000 4h4v-4z');
export const IcoChain     = I('M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z', 'M6 1v3M10 1v3M14 1v3');
export const IcoAlert     = I('M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z', 'M12 9v4M12 17h.01');
export const IcoList      = I('M8 6h13M8 12h13M8 18h13', 'M3 6h.01M3 12h.01M3 18h.01');
export const IcoStar      = I('M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z');
export const IcoBell      = I('M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9', 'M13.73 21a2 2 0 01-3.46 0');
export const IcoChevron   = I('M9 18l6-6-6-6');
export const IcoChevDown  = I('M6 9l6 6 6-6');
export const IcoArrowUp   = I('M12 19V5M5 12l7-7 7 7');
export const IcoArrowDn   = I('M12 5v14M19 12l-7 7-7-7');
export const IcoSettings  = I('M12 15a3 3 0 100-6 3 3 0 000 6z', 'M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z');
export const IcoPlus      = I('M12 5v14M5 12h14');
export const IcoChevLeft  = I('M15 18l-6-6 6-6');
export const IcoCheck     = I('M20 6 9 17l-5-5');
export const IcoX         = I('M18 6 6 18', 'M6 6l12 12');
export const IcoMail      = I('M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z', 'M22 6l-10 7L2 6');
export const IcoRefresh   = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
    <path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
  </svg>
);
export const IcoClock     = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
export const IcoSnowflake = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
    <line x1="2" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="22"/>
    <path d="m20 16-4-4 4-4"/><path d="m4 8 4 4-4 4"/>
    <path d="m16 4-4 4-4-4"/><path d="m8 20 4-4 4 4"/>
  </svg>
);

export const IcoSearch = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export const IcoMore = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="5"  r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="12" cy="19" r="1.4" />
  </svg>
);

// ─── Common components ────────────────────────────────────────────────────────
export function Dot({ color }: { color: string }) {
  return <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />;
}

export function Pill({ label, color, bg, brd }: { label: string; color: string; bg: string; brd?: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, letterSpacing: '0.02em',
      color, background: bg, border: `1px solid ${brd ?? 'transparent'}`,
      padding: '2px 9px', borderRadius: 99, display: 'inline-block', whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

export function FeedLabel({ label }: { label: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    Critical: { color: c.red,   bg: 'rgba(239,68,68,0.15)'  },
    Warning:  { color: c.amber, bg: 'rgba(245,158,11,0.15)' },
    Info:     { color: c.blue,  bg: 'rgba(96,165,250,0.12)' },
  };
  const s = map[label] ?? { color: c.textDim, bg: 'transparent' };
  return (
    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', color: s.color, background: s.bg, padding: '2px 5px', borderRadius: 4, flexShrink: 0 }}>
      {label.toUpperCase()}
    </span>
  );
}

// ─── Style helpers ────────────────────────────────────────────────────────────
export function tierStyle(t: string) {
  if (t === 'Black')  return { color: '#e4e4e7', bg: 'rgba(255,255,255,0.07)', brd: 'rgba(255,255,255,0.1)' };
  if (t === 'Gold')   return { color: c.amber,   bg: c.amberDim,               brd: c.amberBrd };
  return                     { color: c.textMid, bg: 'rgba(255,255,255,0.05)', brd: 'transparent' };
}
export function kycStyle(k: string) {
  if (k === 'Verified')  return { color: c.green,   bg: c.greenDim,  brd: 'rgba(34,197,94,0.2)'  };
  if (k === 'Reviewing') return { color: c.amber,   bg: c.amberDim,  brd: c.amberBrd              };
  if (k === 'Failed')    return { color: c.red,     bg: c.redDim,    brd: 'rgba(239,68,68,0.2)'  };
  return                        { color: c.textMid, bg: 'rgba(255,255,255,0.05)', brd: 'transparent' };
}
export function walletStyle(w: string) {
  if (w === 'Active')  return { color: c.green, bg: c.greenDim, brd: 'rgba(34,197,94,0.2)' };
  if (w === 'Pending') return { color: c.amber, bg: c.amberDim, brd: c.amberBrd             };
  return                      { color: c.red,   bg: c.redDim,   brd: 'rgba(239,68,68,0.2)'  };
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
