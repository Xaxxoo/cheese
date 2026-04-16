// src/email/templates/tier-eligible.ts
import {
  BRAND,
  ICONS,
  baseLayout,
  primaryButton,
  sectionLabel,
  benefitRow,
} from './base';

export function tierEligible(params: {
  fullName: string;
  currentTier: string;
  nextTier: string;
  ctaUrl: string;
  kycStep: string;
  newLimits: string[];
}): { subject: string; html: string } {
  const tierColors: Record<string, string> = {
    gold: BRAND.gold,
    black: '#F5F5F5',
  };
  const color = tierColors[params.nextTier.toLowerCase()] || BRAND.gold;
  const subject = `You've unlocked ${params.nextTier} tier — one step left`;
  const html = baseLayout({
    preheader: `You've hit the ${params.nextTier} milestone. Complete ${params.kycStep} to unlock it.`,
    body: `
      <div style="height:4px;background:linear-gradient(90deg,${color}88,${color});"></div>
      <div style="padding:48px 40px 40px;">

        <div style="text-align:center;margin-bottom:32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 16px;">
            <tr>
              <td style="background:${color}20;border:1px solid ${color}44;
                          border-radius:50%;width:80px;height:80px;text-align:center;vertical-align:middle;">
                ${ICONS.star(color, 44)}
              </td>
            </tr>
          </table>
          ${sectionLabel('Milestone Reached', ICONS.check(color, 14), color)}
          <h1 style="font-size:28px;font-weight:700;color:${BRAND.textPrimary};
                     font-family:'Inter',sans-serif;letter-spacing:-0.8px;margin-bottom:12px;">
            ${params.fullName.split(' ')[0]}, you've earned ${params.nextTier}!
          </h1>
          <p style="font-size:15px;color:${BRAND.textMuted};font-family:'Inter',sans-serif;line-height:1.7;">
            You've hit the transaction milestone for <strong style="color:${color};">${params.nextTier}</strong>.
            Complete one quick step to unlock your higher limits.
          </p>
        </div>

        <!-- New limits -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
          style="background:${BRAND.surface};border:1px solid ${color}33;border-radius:16px;
                 padding:24px;margin-bottom:32px;">
          <tr><td>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
              <tr>
                <td style="vertical-align:middle;padding-right:8px;">${ICONS.star(color, 14)}</td>
                <td style="font-size:12px;letter-spacing:2px;color:${color};text-transform:uppercase;
                           font-family:'Inter',sans-serif;vertical-align:middle;">
                  Your ${params.nextTier} Limits
                </td>
              </tr>
            </table>
            ${params.newLimits.map((l) => benefitRow(l)).join('')}
          </td></tr>
        </table>

        <!-- What to do -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
          style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:16px;
                 padding:24px;margin-bottom:32px;">
          <tr><td>
            <p style="font-size:14px;color:${BRAND.textMuted};font-family:'Inter',sans-serif;
                      line-height:1.6;margin:0;">
              To unlock your ${params.nextTier} tier, complete a quick
              <strong style="color:${BRAND.textPrimary};">${params.kycStep}</strong>
              inside the app. It takes less than 2 minutes.
            </p>
          </td></tr>
        </table>

        ${primaryButton(`Unlock ${params.nextTier} Tier`, params.ctaUrl)}
      </div>
    `,
  });
  return { subject, html };
}
