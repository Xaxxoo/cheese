// src/email/templates/index.ts
import {
  BRAND,
  ICONS,
  baseLayout,
  goldDivider,
  primaryButton,
  otpBox,
  amountDisplay,
  detailRow,
  infoBox,
  sectionLabel,
  featureRow,
  benefitRow,
} from './base';

// ─────────────────────────────────────────────────────────
// 1. WAITLIST RESERVATION CONFIRMATION
// ─────────────────────────────────────────────────────────
export function waitlistConfirmation(params: {
  username: string;
  email: string;
  position?: number;
}): { subject: string; html: string } {
  const subject = `@${params.username} is yours — Welcome to Cheese Wallet`;
  const html = baseLayout({
    preheader: `Your username @${params.username} has been reserved. You're among the first.`,
    body: `
      <div style="height:4px;background:linear-gradient(90deg,${BRAND.goldDark},${BRAND.gold},${BRAND.goldLight});"></div>
      <div style="padding:48px 40px 40px;">

        ${sectionLabel('Early Access Reserved', ICONS.clock(BRAND.gold, 14))}

        <h1 style="font-size:34px;font-weight:700;color:${BRAND.textPrimary};
                   font-family:'Inter',sans-serif;line-height:1.2;letter-spacing:-1px;margin-bottom:12px;">
          Welcome to the<br/>
          <span style="background:linear-gradient(135deg,${BRAND.goldDark},${BRAND.goldLight});
                       -webkit-background-clip:text;-webkit-text-fill-color:transparent;">
            Golden List.
          </span>
        </h1>
        <p style="font-size:16px;color:${BRAND.textMuted};font-family:'Inter',sans-serif;
                  line-height:1.7;margin-bottom:36px;">
          You've secured your spot before the world finds out. When Cheese Wallet launches,
          your username will be waiting — reserved exclusively for you.
        </p>

        <!-- Username card -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:36px;">
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND.surface},${BRAND.cardBg});
                       border:1px solid ${BRAND.gold}44;border-radius:16px;padding:28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding-bottom:8px;">${ICONS.user(BRAND.gold, 28)}</td>
                </tr>
              </table>
              <p style="font-size:12px;letter-spacing:2px;color:${BRAND.textMuted};
                         text-transform:uppercase;font-family:'Inter',sans-serif;margin-bottom:8px;">
                Your Reserved Handle
              </p>
              <p style="font-size:32px;font-weight:700;color:${BRAND.gold};
                         font-family:'Inter',sans-serif;letter-spacing:-0.5px;margin:0 0 12px;">
                @${params.username}
              </p>
              ${params.position ? `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:6px;">${ICONS.trophy(BRAND.textMuted, 13)}</td>
                  <td style="font-size:13px;color:${BRAND.textMuted};font-family:'Inter',sans-serif;vertical-align:middle;">
                    You're <strong style="color:${BRAND.textLight};">#${params.position.toLocaleString()}</strong> on the waitlist
                  </td>
                </tr>
              </table>` : ''}
            </td>
          </tr>
        </table>

        <!-- What's coming -->
        <p style="font-size:14px;font-weight:600;color:${BRAND.textLight};
                  font-family:'Inter',sans-serif;margin-bottom:16px;letter-spacing:-0.2px;">
          What to expect when we launch
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:36px;">
          ${featureRow(ICONS.dollar(), 'Hold & earn on USDC', 'Up to 5% APY — no lock-ups')}
          ${featureRow(ICONS.zap(), 'Instant NGN withdrawals', 'Send to any Nigerian bank in seconds')}
          ${featureRow(ICONS.creditCard(), 'Virtual dollar card', 'Pay globally with your USDC balance')}
          ${featureRow(ICONS.send(), 'Send money by username', 'Just @username — no account numbers')}
        </table>

        ${infoBox(`We'll email you at <strong style="color:${BRAND.textLight};">${params.email}</strong> the moment we go live. Early reservers get priority access and exclusive launch bonuses.`)}
      </div>
    `,
  });
  return { subject, html };
}

// ─────────────────────────────────────────────────────────
// 2. APP LAUNCH
// ─────────────────────────────────────────────────────────
export function appLaunch(params: { username: string; appUrl: string }): {
  subject: string;
  html: string;
} {
  const subject = `Cheese Wallet is LIVE — @${params.username}, your turn.`;
  const html = baseLayout({
    preheader: 'The wait is over. Your wallet is ready. Claim your username now.',
    body: `
      <div style="height:4px;background:linear-gradient(90deg,${BRAND.goldDark},${BRAND.gold},${BRAND.goldLight});"></div>
      <div style="padding:48px 40px 40px;">

        ${sectionLabel("We're Live", ICONS.arrowUpRight(BRAND.gold, 14))}

        <h1 style="font-size:36px;font-weight:700;color:${BRAND.textPrimary};
                   font-family:'Inter',sans-serif;line-height:1.15;letter-spacing:-1.5px;margin-bottom:16px;">
          The wait is over,<br/>
          <span style="background:linear-gradient(135deg,${BRAND.goldDark},${BRAND.goldLight});
                       -webkit-background-clip:text;-webkit-text-fill-color:transparent;">
            @${params.username}.
          </span>
        </h1>
        <p style="font-size:16px;color:${BRAND.textMuted};font-family:'Inter',sans-serif;
                  line-height:1.7;margin-bottom:36px;">
          Cheese Wallet is officially open. You reserved your spot early — your username is locked,
          your wallet is ready. All that's left is you.
        </p>

        <div style="margin-bottom:36px;">
          ${primaryButton('Claim @' + params.username + ' Now', params.appUrl)}
        </div>

        <!-- Feature grid -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:32px;">
          <tr>
            <td width="50%" style="padding:0 6px 12px 0;vertical-align:top;">
              <div style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:12px;padding:20px;">
                <div style="margin-bottom:10px;">${ICONS.trendingUp(BRAND.gold, 20)}</div>
                <p style="font-size:14px;font-weight:600;color:${BRAND.textLight};font-family:'Inter',sans-serif;margin:0 0 4px;">Earn 5% APY</p>
                <p style="font-size:12px;color:${BRAND.textMuted};font-family:'Inter',sans-serif;margin:0;">On your USDC balance</p>
              </div>
            </td>
            <td width="50%" style="padding:0 0 12px 6px;vertical-align:top;">
              <div style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:12px;padding:20px;">
                <div style="margin-bottom:10px;">${ICONS.zap(BRAND.gold, 20)}</div>
                <p style="font-size:14px;font-weight:600;color:${BRAND.textLight};font-family:'Inter',sans-serif;margin:0 0 4px;">Instant Withdrawals</p>
                <p style="font-size:12px;color:${BRAND.textMuted};font-family:'Inter',sans-serif;margin:0;">To any Nigerian bank</p>
              </div>
            </td>
          </tr>
          <tr>
            <td width="50%" style="padding:0 6px 0 0;vertical-align:top;">
              <div style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:12px;padding:20px;">
                <div style="margin-bottom:10px;">${ICONS.creditCard(BRAND.gold, 20)}</div>
                <p style="font-size:14px;font-weight:600;color:${BRAND.textLight};font-family:'Inter',sans-serif;margin:0 0 4px;">Virtual Dollar Card</p>
                <p style="font-size:12px;color:${BRAND.textMuted};font-family:'Inter',sans-serif;margin:0;">Shop globally, instantly</p>
              </div>
            </td>
            <td width="50%" style="padding:0 0 0 6px;vertical-align:top;">
              <div style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:12px;padding:20px;">
                <div style="margin-bottom:10px;">${ICONS.target(BRAND.gold, 20)}</div>
                <p style="font-size:14px;font-weight:600;color:${BRAND.textLight};font-family:'Inter',sans-serif;margin:0 0 4px;">Send by Username</p>
                <p style="font-size:12px;color:${BRAND.textMuted};font-family:'Inter',sans-serif;margin:0;">No account numbers needed</p>
              </div>
            </td>
          </tr>
        </table>

        ${infoBox(`As an early reserver, your first 3 months of earn are at <strong style="color:${BRAND.gold};">boosted 6% APY</strong>. This offer expires 30 days after launch.`, 'success')}
      </div>
    `,
  });
  return { subject, html };
}

// ─────────────────────────────────────────────────────────
// 3. SIGNUP OTP
// ─────────────────────────────────────────────────────────
export function signupOtp(params: {
  fullName: string;
  otp: string;
  expiresIn: string;
}): { subject: string; html: string } {
  const subject = `${params.otp} — your Cheese Wallet verification code`;
  const html = baseLayout({
    preheader: `Your verification code is ${params.otp}. Valid for ${params.expiresIn}.`,
    body: `
      <div style="height:4px;background:linear-gradient(90deg,${BRAND.goldDark},${BRAND.gold},${BRAND.goldLight});"></div>
      <div style="padding:48px 40px 40px;">

        ${sectionLabel('Verify Your Account', ICONS.lock(BRAND.gold, 14))}

        <h1 style="font-size:30px;font-weight:700;color:${BRAND.textPrimary};
                   font-family:'Inter',sans-serif;letter-spacing:-0.8px;margin-bottom:12px;">
          Hey ${params.fullName.split(' ')[0]}
        </h1>
        <p style="font-size:15px;color:${BRAND.textMuted};font-family:'Inter',sans-serif;
                  line-height:1.7;margin-bottom:36px;">
          Enter the code below to verify your email and activate your Cheese Wallet account.
        </p>

        <div style="margin-bottom:32px;">${otpBox(params.otp)}</div>

        <!-- Expiry row -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 32px;">
          <tr>
            <td style="vertical-align:middle;padding-right:6px;">${ICONS.clock(BRAND.textMuted, 14)}</td>
            <td style="font-size:13px;color:${BRAND.textMuted};font-family:'Inter',sans-serif;vertical-align:middle;">
              This code expires in <strong style="color:${BRAND.textLight};">${params.expiresIn}</strong>
            </td>
          </tr>
        </table>

        ${goldDivider()}

        <div style="padding:28px 0 0;">
          ${infoBox('If you did not create a Cheese Wallet account, you can safely ignore this email. Your information is secure.', 'warning')}
        </div>
      </div>
    `,
  });
  return { subject, html };
}

// ─────────────────────────────────────────────────────────
// 4. SUCCESSFUL SIGNUP
// ─────────────────────────────────────────────────────────
export function signupSuccess(params: {
  fullName: string;
  username: string;
  appUrl: string;
}): { subject: string; html: string } {
  const subject = `Your Cheese Wallet account is ready, @${params.username}`;
  const html = baseLayout({
    preheader: 'Your account is live. Fund your wallet and start earning.',
    body: `
      <div style="height:4px;background:linear-gradient(90deg,${BRAND.goldDark},${BRAND.gold},${BRAND.goldLight});"></div>
      <div style="padding:48px 40px 40px;">
        <div style="text-align:center;margin-bottom:32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 20px;">
            <tr>
              <td style="background:${BRAND.successGreen}20;border:1px solid ${BRAND.successGreen}44;
                          border-radius:50%;width:72px;height:72px;text-align:center;vertical-align:middle;">
                ${ICONS.checkCircle(BRAND.successGreen, 40)}
              </td>
            </tr>
          </table>
          <h1 style="font-size:30px;font-weight:700;color:${BRAND.textPrimary};
                     font-family:'Inter',sans-serif;letter-spacing:-0.8px;margin-bottom:8px;">
            You're in, ${params.fullName.split(' ')[0]}!
          </h1>
          <p style="font-size:15px;color:${BRAND.textMuted};font-family:'Inter',sans-serif;line-height:1.7;">
            Your Cheese Wallet is set up and ready. The golden standard of digital finance is now yours.
          </p>
        </div>

        <!-- Username card -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:32px;">
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND.surface},${BRAND.cardBg});
                       border:1px solid ${BRAND.gold}44;border-radius:16px;padding:24px;text-align:center;">
              <div style="margin-bottom:8px;">${ICONS.user(BRAND.gold, 24)}</div>
              <p style="font-size:12px;letter-spacing:2px;color:${BRAND.textMuted};
                         text-transform:uppercase;font-family:'Inter',sans-serif;margin-bottom:6px;">Your Handle</p>
              <p style="font-size:28px;font-weight:700;color:${BRAND.gold};
                         font-family:'Inter',sans-serif;letter-spacing:-0.5px;margin:0;">
                @${params.username}
              </p>
            </td>
          </tr>
        </table>

        <!-- Steps -->
        <p style="font-size:14px;font-weight:600;color:${BRAND.textLight};
                  font-family:'Inter',sans-serif;margin-bottom:16px;">Get started in 3 steps</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:32px;">
          ${[
            [ICONS.wallet(), 'Fund your wallet', 'Deposit USDC via Stellar network'],
            [ICONS.trendingUp(), 'Start earning', 'Toggle Earn on to get 5% APY instantly'],
            [ICONS.landmark(), 'Withdraw anytime', 'Send NGN directly to your bank account'],
          ].map(([icon, title, desc], i) => `
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid ${BRAND.border};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td width="40" style="vertical-align:middle;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="width:28px;height:28px;border-radius:14px;
                                    background:linear-gradient(135deg,${BRAND.goldDark},${BRAND.gold});
                                    text-align:center;vertical-align:middle;">
                          <span style="font-size:13px;font-weight:700;color:${BRAND.black};
                                       font-family:'Inter',sans-serif;line-height:28px;display:block;">${i + 1}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="padding-left:12px;">
                    <p style="font-size:14px;font-weight:600;color:${BRAND.textLight};
                               font-family:'Inter',sans-serif;margin:0 0 2px;">${title}</p>
                    <p style="font-size:13px;color:${BRAND.textMuted};
                               font-family:'Inter',sans-serif;margin:0;">${desc}</p>
                  </td>
                  <td width="28" align="right">${icon}</td>
                </tr>
              </table>
            </td>
          </tr>`).join('')}
        </table>

        ${primaryButton('Open My Wallet', params.appUrl)}
      </div>
    `,
  });
  return { subject, html };
}

// ─────────────────────────────────────────────────────────
// 5. PASSWORD RESET OTP
// ─────────────────────────────────────────────────────────
export function passwordResetOtp(params: {
  fullName: string;
  otp: string;
  expiresIn: string;
  ipAddress?: string;
}): { subject: string; html: string } {
  const subject = `Reset your Cheese Wallet password`;
  const html = baseLayout({
    preheader: `Your password reset code is ${params.otp}. Valid for ${params.expiresIn}.`,
    body: `
      <div style="height:4px;background:linear-gradient(90deg,#EF4444,#F97316);"></div>
      <div style="padding:48px 40px 40px;">

        ${sectionLabel('Security', ICONS.shieldOff('#F97316', 14), '#F97316')}

        <h1 style="font-size:30px;font-weight:700;color:${BRAND.textPrimary};
                   font-family:'Inter',sans-serif;letter-spacing:-0.8px;margin-bottom:12px;">
          Password Reset
        </h1>
        <p style="font-size:15px;color:${BRAND.textMuted};font-family:'Inter',sans-serif;
                  line-height:1.7;margin-bottom:36px;">
          We received a request to reset the password for your Cheese Wallet account.
          Use the code below to complete the process.
        </p>

        <div style="margin-bottom:32px;">${otpBox(params.otp)}</div>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 32px;">
          <tr>
            <td style="vertical-align:middle;padding-right:6px;">${ICONS.clock(BRAND.textMuted, 14)}</td>
            <td style="font-size:13px;color:${BRAND.textMuted};font-family:'Inter',sans-serif;vertical-align:middle;">
              This code expires in <strong style="color:${BRAND.textLight};">${params.expiresIn}</strong>
            </td>
          </tr>
        </table>

        ${goldDivider()}

        <div style="padding:28px 0 0;">
          ${infoBox(
            `<strong>Wasn't you?</strong> If you didn't request a password reset, secure your account immediately by logging in and changing your password.${params.ipAddress ? ` This request came from IP: <strong style="color:${BRAND.textLight};">${params.ipAddress}</strong>` : ''}`,
            'warning',
          )}
        </div>
      </div>
    `,
  });
  return { subject, html };
}

// ─────────────────────────────────────────────────────────
// 6. SUCCESSFUL PASSWORD CHANGE
// ─────────────────────────────────────────────────────────
export function passwordChanged(params: {
  fullName: string;
  changedAt: string;
  deviceName?: string;
}): { subject: string; html: string } {
  const subject = `Your Cheese Wallet password was changed`;
  const html = baseLayout({
    preheader: `Your password was successfully updated on ${params.changedAt}.`,
    body: `
      <div style="height:4px;background:linear-gradient(90deg,${BRAND.successGreen}88,${BRAND.successGreen});"></div>
      <div style="padding:48px 40px 40px;">
        <div style="text-align:center;margin-bottom:32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 16px;">
            <tr>
              <td style="background:${BRAND.gold}15;border:1px solid ${BRAND.gold}33;
                          border-radius:50%;width:72px;height:72px;text-align:center;vertical-align:middle;">
                ${ICONS.key(BRAND.gold, 40)}
              </td>
            </tr>
          </table>
          <h1 style="font-size:28px;font-weight:700;color:${BRAND.textPrimary};
                     font-family:'Inter',sans-serif;letter-spacing:-0.8px;margin-bottom:10px;">
            Password Updated
          </h1>
          <p style="font-size:15px;color:${BRAND.textMuted};font-family:'Inter',sans-serif;line-height:1.7;">
            Your Cheese Wallet password was successfully changed.
          </p>
        </div>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:32px;">
          <tbody>
            ${detailRow('Account', params.fullName)}
            ${detailRow('Changed At', params.changedAt, true)}
            ${params.deviceName ? detailRow('Device', params.deviceName) : ''}
          </tbody>
        </table>

        ${infoBox(`If you did not make this change, your account may be compromised. Please contact support immediately at <a href="mailto:support@cheesewallet.app" style="color:${BRAND.gold};">support@cheesewallet.app</a>`, 'warning')}
      </div>
    `,
  });
  return { subject, html };
}

// ─────────────────────────────────────────────────────────
// 7. MONEY RECEIVED
// ─────────────────────────────────────────────────────────
export function moneyReceived(params: {
  fullName: string;
  amountUsdc: string;
  amountNgn?: string;
  txHash?: string;
  network?: string;
  appUrl: string;
}): { subject: string; html: string } {
  const subject = `$${params.amountUsdc} USDC received — start spending`;
  const html = baseLayout({
    preheader: `$${params.amountUsdc} USDC has been credited to your Cheese Wallet.`,
    body: `
      <div style="height:4px;background:linear-gradient(90deg,${BRAND.goldDark},${BRAND.gold},${BRAND.goldLight});"></div>
      <div style="padding:48px 40px 40px;">

        ${sectionLabel('Money Received', ICONS.wallet(BRAND.gold, 14))}

        <h1 style="font-size:30px;font-weight:700;color:${BRAND.textPrimary};
                   font-family:'Inter',sans-serif;letter-spacing:-0.8px;margin-bottom:12px;">
          Your wallet just got richer.
        </h1>
        <p style="font-size:15px;color:${BRAND.textMuted};font-family:'Inter',sans-serif;
                  line-height:1.7;margin-bottom:36px;">
          A USDC deposit has landed in your Cheese Wallet. Your funds are safe and ready to use.
        </p>

        <div style="margin-bottom:32px;">${amountDisplay(params.amountUsdc, params.amountNgn)}</div>

        ${params.txHash ? `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:32px;">
          <tbody>
            ${params.network ? detailRow('Network', params.network) : ''}
            ${detailRow('Transaction Hash', `${params.txHash.slice(0, 12)}...${params.txHash.slice(-8)}`)}
            ${detailRow('Status', 'Confirmed', true)}
          </tbody>
        </table>` : ''}

        <!-- Suggestions -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:32px;">
          <tr>
            <td style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:12px;padding:20px;">
              <p style="font-size:13px;font-weight:600;color:${BRAND.textLight};
                         font-family:'Inter',sans-serif;margin:0 0 12px;">Put your money to work</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                ${featureRow(ICONS.trendingUp(), 'Earn 5% APY', 'Toggle Earn to grow your balance daily')}
                ${featureRow(ICONS.creditCard(), 'Spend with card', 'Use your virtual Mastercard anywhere')}
                ${featureRow(ICONS.landmark(), 'Withdraw to bank', 'Convert USDC to NGN instantly')}
              </table>
            </td>
          </tr>
        </table>

        ${primaryButton('Start Spending', params.appUrl)}
      </div>
    `,
  });
  return { subject, html };
}

// ─────────────────────────────────────────────────────────
// 8. MONEY SENT
// ─────────────────────────────────────────────────────────
export function moneySent(params: {
  fullName: string;
  amountUsdc: string;
  amountNgn?: string;
  recipientName?: string;
  recipientUsername?: string;
  recipientAddress?: string;
  txHash?: string;
  reference: string;
  fee: string;
  appUrl: string;
}): { subject: string; html: string } {
  const recipient = params.recipientUsername
    ? `@${params.recipientUsername}`
    : params.recipientName || 'recipient';
  const subject = `You sent $${params.amountUsdc} USDC to ${recipient}`;
  const html = baseLayout({
    preheader: `$${params.amountUsdc} USDC sent. Reference: ${params.reference}.`,
    body: `
      <div style="height:4px;background:linear-gradient(90deg,${BRAND.goldDark},${BRAND.gold},${BRAND.goldLight});"></div>
      <div style="padding:48px 40px 40px;">

        ${sectionLabel('Money Sent', ICONS.send(BRAND.gold, 14))}

        <h1 style="font-size:30px;font-weight:700;color:${BRAND.textPrimary};
                   font-family:'Inter',sans-serif;letter-spacing:-0.8px;margin-bottom:12px;">
          Transfer complete.
        </h1>
        <p style="font-size:15px;color:${BRAND.textMuted};font-family:'Inter',sans-serif;
                  line-height:1.7;margin-bottom:36px;">
          Your transfer has been processed and delivered on the Stellar network.
        </p>

        <div style="margin-bottom:32px;">${amountDisplay(params.amountUsdc, params.amountNgn)}</div>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:32px;">
          <tbody>
            ${detailRow('Sent To', recipient, true)}
            ${params.recipientAddress ? detailRow('Address', `${params.recipientAddress.slice(0, 8)}...${params.recipientAddress.slice(-8)}`) : ''}
            ${detailRow('Network Fee', `$${params.fee} USDC`)}
            ${detailRow('Reference', params.reference)}
            ${params.txHash ? detailRow('Tx Hash', `${params.txHash.slice(0, 12)}...${params.txHash.slice(-8)}`) : ''}
            ${detailRow('Status', 'Confirmed', true)}
          </tbody>
        </table>

        ${primaryButton('View Transaction', `${params.appUrl}/history`)}
      </div>
    `,
  });
  return { subject, html };
}

// ─────────────────────────────────────────────────────────
// 9. KYC APPROVED
// ─────────────────────────────────────────────────────────
export function kycApproved(params: {
  fullName: string;
  tier: string;
  appUrl: string;
  benefits: string[];
}): { subject: string; html: string } {
  const subject = `Identity verified — your ${params.tier} account is unlocked`;
  const html = baseLayout({
    preheader: `KYC approved! Your ${params.tier} tier is now fully active.`,
    body: `
      <div style="height:4px;background:linear-gradient(90deg,${BRAND.successGreen}88,${BRAND.successGreen});"></div>
      <div style="padding:48px 40px 40px;">
        <div style="text-align:center;margin-bottom:32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 16px;">
            <tr>
              <td style="background:${BRAND.successGreen}20;border:1px solid ${BRAND.successGreen}44;
                          border-radius:50%;width:80px;height:80px;text-align:center;vertical-align:middle;">
                ${ICONS.gift(BRAND.successGreen, 44)}
              </td>
            </tr>
          </table>
          ${sectionLabel('Identity Verified', ICONS.check(BRAND.successGreen, 14), BRAND.successGreen)}
          <h1 style="font-size:30px;font-weight:700;color:${BRAND.textPrimary};
                     font-family:'Inter',sans-serif;letter-spacing:-0.8px;margin-bottom:12px;">
            Welcome to ${params.tier} Tier
          </h1>
          <p style="font-size:15px;color:${BRAND.textMuted};font-family:'Inter',sans-serif;line-height:1.7;">
            ${params.fullName.split(' ')[0]}, your identity has been verified. Higher limits and
            exclusive features are now unlocked.
          </p>
        </div>

        <!-- Benefits list -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
          style="background:${BRAND.surface};border:1px solid ${BRAND.gold}33;border-radius:16px;
                 padding:24px;margin-bottom:32px;">
          <tr><td>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
              <tr>
                <td style="vertical-align:middle;padding-right:8px;">${ICONS.star(BRAND.gold, 14)}</td>
                <td style="font-size:12px;letter-spacing:2px;color:${BRAND.gold};text-transform:uppercase;font-family:'Inter',sans-serif;vertical-align:middle;">
                  Your ${params.tier} Benefits
                </td>
              </tr>
            </table>
            ${params.benefits.map((b) => benefitRow(b)).join('')}
          </td></tr>
        </table>

        ${primaryButton('Explore Your Account', params.appUrl)}
      </div>
    `,
  });
  return { subject, html };
}

// ─────────────────────────────────────────────────────────
// 10. ACCOUNT TIER UPGRADE
// ─────────────────────────────────────────────────────────
export function tierUpgrade(params: {
  fullName: string;
  fromTier: string;
  toTier: string;
  appUrl: string;
  benefits: string[];
}): { subject: string; html: string } {
  const tierColors: Record<string, string> = {
    silver: '#9CA3AF',
    gold: BRAND.gold,
    black: '#F5F5F5',
  };
  const color = tierColors[params.toTier.toLowerCase()] || BRAND.gold;
  const subject = `You've been upgraded to ${params.toTier} tier`;
  const html = baseLayout({
    preheader: `Congratulations! You've unlocked ${params.toTier} — higher limits, more power.`,
    body: `
      <div style="height:4px;background:linear-gradient(90deg,${color}88,${color});"></div>
      <div style="padding:48px 40px 40px;">

        <!-- Tier upgrade visual -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:32px;">
          <tr>
            <td style="text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td style="background:${BRAND.surface};border:1px solid ${BRAND.border};
                              border-radius:10px;padding:10px 20px;">
                    <span style="font-size:14px;font-weight:600;color:${BRAND.textMuted};
                                 font-family:'Inter',sans-serif;">${params.fromTier}</span>
                  </td>
                  <td style="padding:0 12px;">
                    ${ICONS.arrowRight(color, 18)}
                  </td>
                  <td style="background:${color}20;border:1px solid ${color}66;
                              border-radius:10px;padding:10px 20px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="vertical-align:middle;">
                          <span style="font-size:14px;font-weight:700;color:${color};
                                       font-family:'Inter',sans-serif;">${params.toTier}</span>
                        </td>
                        <td style="vertical-align:middle;padding-left:6px;">
                          ${ICONS.star(color, 12)}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <h1 style="font-size:30px;font-weight:700;color:${BRAND.textPrimary};
                   font-family:'Inter',sans-serif;letter-spacing:-0.8px;margin-bottom:12px;text-align:center;">
          You've levelled up,<br/>
          <span style="background:linear-gradient(135deg,${color}88,${color});
                       -webkit-background-clip:text;-webkit-text-fill-color:transparent;">
            ${params.fullName.split(' ')[0]}.
          </span>
        </h1>
        <p style="font-size:15px;color:${BRAND.textMuted};font-family:'Inter',sans-serif;
                  line-height:1.7;margin-bottom:36px;text-align:center;">
          Your account has been upgraded to <strong style="color:${color};">${params.toTier}</strong>.
          Higher limits, exclusive features, and more power are now yours.
        </p>

        <!-- New benefits -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
          style="background:${BRAND.surface};border:1px solid ${color}33;border-radius:16px;
                 padding:24px;margin-bottom:32px;">
          <tr><td>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
              <tr>
                <td style="vertical-align:middle;padding-right:8px;">${ICONS.star(color, 14)}</td>
                <td style="font-size:12px;letter-spacing:2px;color:${color};text-transform:uppercase;font-family:'Inter',sans-serif;vertical-align:middle;">
                  ${params.toTier} Unlocks
                </td>
              </tr>
            </table>
            ${params.benefits.map((b) => benefitRow(b, color)).join('')}
          </td></tr>
        </table>

        ${primaryButton(`Explore ${params.toTier} Features`, params.appUrl)}
      </div>
    `,
  });
  return { subject, html };
}

// ─────────────────────────────────────────────────────────
// 11. WAITLIST REMINDER
// ─────────────────────────────────────────────────────────
export function waitlistReminder(params: {
  username: string;
  email: string;
  signupUrl: string;
  daysOnList: number;
  position?: number;
}): { subject: string; html: string } {
  const subject = `@${params.username} is still yours — don't let it expire`;
  const html = baseLayout({
    preheader: `Your username @${params.username} is reserved. Complete your signup before it's released.`,
    body: `
      <div style="height:4px;background:linear-gradient(90deg,${BRAND.goldDark},${BRAND.gold},${BRAND.goldLight});"></div>
      <div style="padding:48px 40px 40px;">

        ${sectionLabel('Gentle Reminder', ICONS.hourglass(BRAND.gold, 13))}

        <h1 style="font-size:32px;font-weight:700;color:${BRAND.textPrimary};
                   font-family:'Inter',sans-serif;line-height:1.2;letter-spacing:-1px;margin-bottom:12px;">
          Your username is<br/>
          <span style="background:linear-gradient(135deg,${BRAND.goldDark},${BRAND.goldLight});
                       -webkit-background-clip:text;-webkit-text-fill-color:transparent;">
            waiting for you.
          </span>
        </h1>
        <p style="font-size:15px;color:${BRAND.textMuted};font-family:'Inter',sans-serif;
                  line-height:1.7;margin-bottom:32px;">
          You reserved <strong style="color:${BRAND.gold};">@${params.username}</strong> ${params.daysOnList} day${params.daysOnList !== 1 ? 's' : ''} ago.
          Cheese Wallet is live — your spot is still held, but unclaimed usernames
          are released periodically to keep the namespace fresh.
        </p>

        <!-- Username card with urgency -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:32px;">
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND.surface},${BRAND.cardBg});
                       border:1px solid ${BRAND.gold}55;border-radius:16px;padding:28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <div style="margin-bottom:6px;">${ICONS.user(BRAND.gold, 24)}</div>
                    <p style="font-size:12px;letter-spacing:2px;color:${BRAND.textMuted};
                               text-transform:uppercase;font-family:'Inter',sans-serif;margin:0 0 6px;">
                      Reserved For You
                    </p>
                    <p style="font-size:30px;font-weight:700;color:${BRAND.gold};
                               font-family:'Inter',sans-serif;letter-spacing:-0.5px;margin:0 0 8px;">
                      @${params.username}
                    </p>
                    ${params.position ? `
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="vertical-align:middle;padding-right:6px;">${ICONS.trophy(BRAND.textMuted, 13)}</td>
                        <td style="font-size:13px;color:${BRAND.textMuted};font-family:'Inter',sans-serif;vertical-align:middle;">
                          Waitlist position <strong style="color:${BRAND.textLight};">#${params.position.toLocaleString()}</strong>
                        </td>
                      </tr>
                    </table>` : ''}
                  </td>
                  <td align="right" style="vertical-align:top;">
                    <div style="background:#F59E0B20;border:1px solid #F59E0B44;border-radius:8px;
                                padding:8px 14px;">
                      <span style="font-size:12px;font-weight:600;color:#F59E0B;
                                   font-family:'Inter',sans-serif;">Unclaimed</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <div style="margin-bottom:32px;">${primaryButton('Claim @' + params.username, params.signupUrl)}</div>

        <!-- What you get -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
          style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:14px;
                 padding:20px;margin-bottom:32px;">
          <tr><td>
            <p style="font-size:12px;letter-spacing:2px;color:${BRAND.textMuted};
                       text-transform:uppercase;font-family:'Inter',sans-serif;margin:0 0 14px;">
              Waiting inside your wallet
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              ${featureRow(ICONS.zap(), 'Instant NGN withdrawals to any bank', '')}
              ${featureRow(ICONS.trendingUp(), '5% APY on your USDC — earn while you sleep', '')}
              ${featureRow(ICONS.creditCard(), 'Virtual Mastercard for global spending', '')}
              ${featureRow(ICONS.star(), 'Early-reserver bonuses expire soon', '')}
            </table>
          </td></tr>
        </table>

        ${infoBox(`Signup only takes 2 minutes. Your email <strong style="color:${BRAND.textLight};">${params.email}</strong> is pre-verified — we just need a few details to get you in.`)}
      </div>
    `,
  });
  return { subject, html };
}