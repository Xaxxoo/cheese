// src/email/templates/base.ts

export const BRAND = {
  gold: '#C9A84C',
  goldLight: '#E2C06A',
  goldDark: '#A8822C',
  black: '#0A0A0A',
  darkBg: '#111111',
  cardBg: '#1A1A1A',
  surface: '#222222',
  border: '#2E2E2E',
  textPrimary: '#F5F5F5',
  textMuted: '#999999',
  textLight: '#CCCCCC',
  white: '#FFFFFF',
  successGreen: '#22C55E',
  errorRed: '#EF4444',
};

// ── Lucide SVG Icons ──────────────────────────────────────
// All icons use inline SVG for maximum email client compatibility.
// stroke color is passed as a param so icons adapt to context.

export const ICONS = {
  dollar: (color = BRAND.gold, size = 18) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,

  zap: (color = BRAND.gold, size = 18) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,

  creditCard: (color = BRAND.gold, size = 18) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,

  send: (color = BRAND.gold, size = 18) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,

  wallet: (color = BRAND.gold, size = 18) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 3H8L4 7h16l-4-4z"/><circle cx="17" cy="14" r="1" fill="${color}"/></svg>`,

  trendingUp: (color = BRAND.gold, size = 18) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,

  landmark: (color = BRAND.gold, size = 18) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>`,

  target: (color = BRAND.gold, size = 18) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,

  lock: (color = BRAND.gold, size = 20) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,

  shieldOff: (color = '#F97316', size = 20) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`,

  key: (color = BRAND.gold, size = 44) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>`,

  checkCircle: (color = BRAND.successGreen, size = 52) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,

  check: (color = BRAND.successGreen, size = 16) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><polyline points="20 6 9 17 4 12"/></svg>`,

  star: (color = BRAND.gold, size = 14) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="${color}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,

  gift: (color = BRAND.successGreen, size = 48) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>`,

  user: (color = BRAND.gold, size = 28) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,

  trophy: (color = BRAND.textMuted, size = 13) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><polyline points="8 7 12 3 16 7"/><path d="M8 7H5a2 2 0 0 0-2 2v1a6 6 0 0 0 6 6h6a6 6 0 0 0 6-6V9a2 2 0 0 0-2-2h-3"/><line x1="12" y1="16" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/></svg>`,

  hourglass: (color = BRAND.gold, size = 13) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>`,

  clock: (color = BRAND.textMuted, size = 14) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,

  alertTriangle: (color = '#F59E0B', size = 16) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,

  info: (color = BRAND.gold, size = 16) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,

  arrowRight: (color = '#000000', size = 14) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,

  arrowUpRight: (color = BRAND.gold, size = 14) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>`,
};

// ── Icon wrapper for inline use ───────────────────────────
// Wraps SVG in a table cell so it aligns properly in email clients

export function iconCell(svg: string, width = 36): string {
  return `<td width="${width}" style="vertical-align:middle;padding-right:8px;">${svg}</td>`;
}

// ── Layout ────────────────────────────────────────────────

export function baseLayout(params: {
  preheader: string;
  body: string;
  year?: number;
}): string {
  const year = params.year ?? new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>Cheese Pay</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background-color: ${BRAND.black}; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased; }
    a { color: ${BRAND.gold}; text-decoration: none; }
    .btn:hover { opacity: 0.9; }
  </style>
</head>
<body style="background-color:${BRAND.black};margin:0;padding:0;width:100%;">
  <!-- preheader -->
  <div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0;font-size:1px;line-height:1px;">
    ${params.preheader}&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background-color:${BRAND.black};min-height:100vh;">
    <tr><td align="center" style="padding:32px 16px 48px;">

      <!-- Container -->
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
        style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="padding-bottom:36px;text-align:center;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
              <tr>
                <!-- Serif C monogram -->
                <td style="vertical-align:middle;padding-right:16px;">
                  <span style="font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-size:34px;font-weight:300;color:${BRAND.gold};letter-spacing:2px;line-height:1;">C</span>
                </td>
                <!-- Hairline divider -->
                <td style="vertical-align:middle;padding-right:16px;">
                  <div style="width:1px;height:34px;background:linear-gradient(180deg,transparent,${BRAND.gold}88,transparent);"></div>
                </td>
                <!-- Wordmark -->
                <td style="vertical-align:middle;">
                  <p style="font-size:11px;font-weight:500;letter-spacing:6px;color:${BRAND.gold};font-family:'Inter',-apple-system,sans-serif;text-transform:uppercase;line-height:1;margin:0;">CHEESE PAY</p>
                  <p style="font-size:7.5px;font-weight:300;letter-spacing:3px;color:#555555;font-family:'Inter',-apple-system,sans-serif;text-transform:uppercase;margin:5px 0 0 0;line-height:1;">THE GOLDEN STANDARD</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Card body -->
        <tr>
          <td style="background-color:${BRAND.cardBg};border-radius:20px;border:1px solid ${BRAND.border};overflow:hidden;">
            ${params.body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding-top:32px;text-align:center;">
            <p style="font-size:12px;color:${BRAND.textMuted};font-family:'Inter',sans-serif;line-height:1.8;">
              Cheese Pay &middot; The Golden Standard in Digital Finance<br/>
              <a href="https://cheesepay.xyz" style="color:${BRAND.gold};text-decoration:none;">cheesepay.xyz</a>
              &nbsp;&middot;&nbsp;
              <a href="https://cheesepay.xyz/privacy" style="color:${BRAND.textMuted};text-decoration:none;">Privacy</a>
              &nbsp;&middot;&nbsp;
              <a href="https://cheesepay.xyz/terms" style="color:${BRAND.textMuted};text-decoration:none;">Terms</a>
            </p>
            <p style="margin-top:12px;font-size:11px;color:${BRAND.border};font-family:'Inter',sans-serif;">
              &copy; ${year} Cheese Pay. All rights reserved.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Reusable components ───────────────────────────────────

export function goldDivider(): string {
  return `<tr><td style="padding:0 40px;">
    <div style="height:1px;background:linear-gradient(90deg,transparent,${BRAND.gold}55,transparent);"></div>
  </td></tr>`;
}

export function primaryButton(text: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
    <tr>
      <td style="border-radius:12px;background:linear-gradient(135deg,${BRAND.goldDark},${BRAND.gold});box-shadow:0 4px 24px ${BRAND.gold}40;">
        <a href="${href}" class="btn" target="_blank"
          style="display:inline-block;padding:16px 40px;font-size:15px;font-weight:600;
                 color:${BRAND.black};text-decoration:none;letter-spacing:-0.2px;
                 font-family:'Inter',sans-serif;border-radius:12px;">
          ${text} &nbsp;${ICONS.arrowRight()}
        </a>
      </td>
    </tr>
  </table>`;
}

export function otpBox(code: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
    <tr>
      <td style="background-color:${BRAND.surface};border:1px solid ${BRAND.gold}55;
                 border-radius:16px;padding:24px 48px;text-align:center;">
        <!-- One-time code label with lock icon -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 12px;">
          <tr>
            <td style="vertical-align:middle;padding-right:6px;">${ICONS.lock(BRAND.textMuted, 14)}</td>
            <td style="font-size:10px;letter-spacing:2px;color:${BRAND.textMuted};text-transform:uppercase;font-family:'Inter',sans-serif;vertical-align:middle;">One-time code</td>
          </tr>
        </table>
        <span style="font-size:48px;font-weight:700;letter-spacing:16px;
                     color:${BRAND.gold};font-family:'Inter',sans-serif;">
          ${code}
        </span>
      </td>
    </tr>
  </table>`;
}

export function amountDisplay(usdc: string, ngn?: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
    <tr>
      <td style="background:linear-gradient(135deg,${BRAND.surface},${BRAND.cardBg});
                 border:1px solid ${BRAND.gold}33;border-radius:16px;padding:24px 48px;text-align:center;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 8px;">
          <tr>
            <td style="vertical-align:middle;padding-right:10px;">${ICONS.dollar(BRAND.gold, 22)}</td>
            <td style="font-size:40px;font-weight:700;color:${BRAND.gold};font-family:'Inter',sans-serif;letter-spacing:-1px;vertical-align:middle;">
              ${usdc} <span style="font-size:20px;color:${BRAND.textMuted};">USDC</span>
            </td>
          </tr>
        </table>
        ${ngn ? `<p style="font-size:14px;color:${BRAND.textMuted};margin:0;font-family:'Inter',sans-serif;">&asymp; &#8358;${ngn}</p>` : ''}
      </td>
    </tr>
  </table>`;
}

export function detailRow(
  label: string,
  value: string,
  highlight = false,
): string {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="font-size:13px;color:${BRAND.textMuted};font-family:'Inter',sans-serif;">${label}</td>
          <td align="right" style="font-size:14px;font-weight:${highlight ? '600' : '400'};
                                   color:${highlight ? BRAND.gold : BRAND.textLight};
                                   font-family:'Inter',sans-serif;">${value}</td>
        </tr>
      </table>
    </td>
  </tr>`;
}

export function infoBox(
  text: string,
  type: 'info' | 'warning' | 'success' = 'info',
): string {
  const colors = {
    info:    { bg: `${BRAND.gold}15`,         border: `${BRAND.gold}40`,         icon: ICONS.info() },
    warning: { bg: '#F59E0B15',               border: '#F59E0B40',               icon: ICONS.alertTriangle() },
    success: { bg: `${BRAND.successGreen}15`, border: `${BRAND.successGreen}40`, icon: ICONS.check(BRAND.successGreen, 16) },
  };
  const c = colors[type];
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr>
      <td style="background:${c.bg};border:1px solid ${c.border};border-radius:10px;padding:14px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="24" style="vertical-align:top;padding-right:10px;padding-top:1px;">${c.icon}</td>
            <td style="font-size:13px;color:${BRAND.textLight};font-family:'Inter',sans-serif;line-height:1.6;">${text}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

// ── Section label with icon ───────────────────────────────

export function sectionLabel(text: string, icon: string, color = BRAND.gold): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
    <tr>
      <td style="vertical-align:middle;padding-right:8px;">${icon}</td>
      <td style="font-size:10px;font-weight:600;letter-spacing:3px;color:${color};text-transform:uppercase;font-family:'Inter',sans-serif;vertical-align:middle;">${text}</td>
    </tr>
  </table>`;
}

// ── Feature row with icon ─────────────────────────────────

export function featureRow(icon: string, title: string, desc: string): string {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td width="36" style="vertical-align:middle;">${icon}</td>
          <td style="padding-left:10px;">
            <p style="font-size:14px;font-weight:600;color:${BRAND.textLight};font-family:'Inter',sans-serif;margin:0 0 2px;">${title}</p>
            <p style="font-size:13px;color:${BRAND.textMuted};font-family:'Inter',sans-serif;margin:0;">${desc}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

// ── Benefit row with check icon ───────────────────────────

export function benefitRow(text: string, checkColor = BRAND.successGreen): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:8px;">
    <tr>
      <td width="24" style="vertical-align:top;padding-top:1px;">${ICONS.check(checkColor, 16)}</td>
      <td style="font-size:14px;color:${BRAND.textLight};font-family:'Inter',sans-serif;padding-left:4px;">${text}</td>
    </tr>
  </table>`;
}