// src/email/email.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import {
  waitlistConfirmation,
  appLaunch,
  signupOtp,
  signupSuccess,
  passwordResetOtp,
  passwordChanged,
  moneyReceived,
  moneySent,
  kycApproved,
  tierUpgrade,
} from './templates';

interface SendPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey: string;
  private readonly from: string;
  private readonly fromName: string;
  private readonly replyTo: string;
  private readonly resend: Resend;

  constructor(private readonly config: ConfigService) {
    this.apiKey = config.get<string>('email.resendApiKey', '');
    this.resend = new Resend(this.apiKey);
    this.from = config.get<string>('email.fromAddress', 'hi@cheesepay.xyz');
    this.fromName = config.get<string>('email.fromName', 'Cheese Pay');
    this.replyTo = config.get<string>('email.replyTo', 'hi@cheesepay.xyz');
  }

  private get frontendUrl() {
    return this.config.get<string>('app.frontendUrl', 'https://cheesepay.xyz');
  }

  // ── Core send ─────────────────────────────────────────────
  private async send(payload: SendPayload): Promise<void> {
    const apiKey = this.config.get<string>('email.resendApiKey', '');

    if (!apiKey) {
      // Dev mode: log email to console instead of sending
      this.logger.warn(
        `[EMAIL — dev preview] To: ${payload.to} | Subject: ${payload.subject}`,
      );
      return;
    }

    try {
      const { error } = await this.resend.emails.send({
        from: `${this.fromName} <${this.from}>`,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        replyTo: payload.replyTo || this.replyTo,
        headers: {
          'X-Entity-Ref-ID': `${Date.now()}-${payload.to}`,
          'List-Unsubscribe': `<mailto:${this.replyTo}?subject=unsubscribe>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });

      if (error) {
        this.logger.error(`Resend API error [to=${payload.to}]: ${JSON.stringify(error)}`);
        throw new Error(`Resend rejected email: ${(error as any).message ?? JSON.stringify(error)}`);
      }

      this.logger.log(`Email sent [to=${payload.to}] [subject="${payload.subject}"]`);
    } catch (err) {
      // Re-throw so callers can decide whether to swallow or surface the error
      throw err;
    }
  }

  // ── Template senders ──────────────────────────────────────

  async sendWaitlistConfirmation(params: {
    to: string;
    username: string;
    position?: number;
    
  }): Promise<void> {
    const { subject, html } = waitlistConfirmation({
      email: params.to,
      username: params.username,
      position: params.position,
     
    });
    await this.send({ to: params.to, subject, html });
  }

  async sendAppLaunch(params: {
    to: string;
    username: string;
    appUrl: string;
  }): Promise<void> {
    const { subject, html } = appLaunch(params);
    await this.send({ to: params.to, subject, html });
  }

  async sendSignupOtp(params: {
    to: string;
    fullName: string;
    otp: string;
    expiresIn?: string;
  }): Promise<void> {
    const { subject, html } = signupOtp({
      fullName: params.fullName,
      otp: params.otp,
      expiresIn: params.expiresIn || '5 minutes',
    });
    const text =
      `Hi ${params.fullName},\n\n` +
      `Your Cheese Wallet verification code is: ${params.otp}\n\n` +
      `This code expires in ${params.expiresIn || '5 minutes'}.\n` +
      `If you did not request this, ignore this email.\n\n` +
      `– The Cheese Team`;
    await this.send({ to: params.to, subject, html, text });
  }

  async sendSignupSuccess(params: {
    to: string;
    fullName: string | null;
    username: string;
    appUrl?: string;
  }): Promise<void> {
    const appUrl = params.appUrl || 'https://cheesewallet.app/wallet';
    const name = params.fullName || params.username;
    const { subject, html } = signupSuccess({
      fullName: name,
      username: params.username,
      appUrl,
    });
    const text =
      `Hi ${name},\n\n` +
      `Your Cheese Wallet account is ready.\n\n` +
      `Username: @${params.username}\n` +
      `Open your wallet: ${appUrl}\n\n` +
      `Get started:\n` +
      `1. Fund your wallet — deposit USDC via Stellar\n` +
      `2. Start earning — toggle Earn on for 5% APY\n` +
      `3. Withdraw anytime — send NGN to your bank\n\n` +
      `– The Cheese Team\n\n` +
      `To unsubscribe, reply with "unsubscribe" in the subject.`;
    await this.send({ to: params.to, subject, html, text });
  }

  async sendPasswordResetOtp(params: {
    to: string;
    fullName: string;
    otp: string;
    expiresIn?: string;
    ipAddress?: string;
  }): Promise<void> {
    const { subject, html } = passwordResetOtp({
      fullName: params.fullName,
      otp: params.otp,
      expiresIn: params.expiresIn || '5 minutes',
      ipAddress: params.ipAddress,
    });
    await this.send({ to: params.to, subject, html });
  }

  async sendPasswordChanged(params: {
    to: string;
    fullName: string | null;
    changedAt?: string;
    deviceName?: string;
  }): Promise<void> {
    const { subject, html } = passwordChanged({
      fullName: params.fullName || 'User',
      changedAt:
        params.changedAt ||
        new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
      deviceName: params.deviceName,
    });
    await this.send({ to: params.to, subject, html });
  }

  async sendMoneyReceived(params: {
    to: string;
    fullName: string | null;
    amountUsdc: string;
    amountNgn?: string;
    txHash?: string;
    network?: string;
    appUrl?: string;
  }): Promise<void> {
    const { subject, html } = moneyReceived({
      ...params,
      fullName: params.fullName || 'User',
      appUrl: params.appUrl || 'https://cheesewallet.app',
    });
    await this.send({ to: params.to, subject, html });
  }

  async sendMoneySent(params: {
    to: string;
    fullName: string | null;
    amountUsdc: string;
    amountNgn?: string;
    recipientName?: string;
    recipientUsername?: string;
    recipientAddress?: string;
    txHash?: string;
    reference: string;
    fee: string;
    appUrl?: string;
  }): Promise<void> {
    const { subject, html } = moneySent({
      ...params,
      fullName: params.fullName || 'User',
      appUrl: params.appUrl || 'https://cheesepay.xyz',
    });
    await this.send({ to: params.to, subject, html });
  }

  async sendKycApproved(params: {
    to: string;
    fullName: string;
    tier: string;
    appUrl?: string;
  }): Promise<void> {
    const tierBenefits: Record<string, string[]> = {
      silver: [
        'Up to ₦500,000 daily withdrawal limit',
        'Virtual Mastercard (up to $500 balance)',
        'Earn 5% APY on your USDC',
        'Send USDC by @username',
      ],
      gold: [
        'Up to ₦2,000,000 daily withdrawal limit',
        'Virtual Mastercard (up to $2,000 balance)',
        'Earn 5.5% APY with Gold boost',
        'Priority customer support',
        'Gold badge on your profile',
      ],
      black: [
        'Unlimited daily withdrawal limit',
        'Premium Virtual Black Mastercard',
        'Earn 6% APY — maximum yield',
        'Dedicated relationship manager',
        'Exclusive Black member events',
        'Early access to new features',
      ],
    };

    const { subject, html } = kycApproved({
      fullName: params.fullName,
      tier: params.tier,
      appUrl: params.appUrl || 'https://cheesewallet.app',
      benefits: tierBenefits[params.tier.toLowerCase()] || tierBenefits.silver,
    });
    await this.send({ to: params.to, subject, html });
  }

  async sendTierUpgrade(params: {
    to: string;
    fullName: string;
    fromTier: string;
    toTier: string;
    appUrl?: string;
  }): Promise<void> {
    const tierUpgradeBenefits: Record<string, string[]> = {
      gold: [
        'Withdrawal limit increased to ₦2,000,000/day',
        'Card spending limit raised to $2,000',
        'APY boosted to 5.5%',
        'Priority support queue',
        'Exclusive Gold badge',
      ],
      black: [
        'Unlimited withdrawal limit',
        'Premium Black virtual card — no spending cap',
        'Maximum 6% APY on all USDC',
        'Dedicated 1-on-1 support',
        'VIP event access',
        'First look at new products',
      ],
    };

    const { subject, html } = tierUpgrade({
      fullName: params.fullName,
      fromTier: params.fromTier,
      toTier: params.toTier,
      appUrl: params.appUrl || 'https://cheesewallet.app',
      benefits: tierUpgradeBenefits[params.toTier.toLowerCase()] || [],
    });
    await this.send({ to: params.to, subject, html });
  }

  async sendRegistrationEmail(user: any): Promise<void> {
    const link = `${this.frontendUrl || 'https://cheese.app'}/waitlist?ref=${user.referralCode}`;
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr>
        <td style="padding:48px 48px 32px;background:#111111;border-radius:16px 16px 0 0;border-bottom:1px solid #1f1f1f;">
          <p style="margin:0;font-size:24px;font-weight:700;color:#d4a843;">🧀 Cheese</p>
        </td>
      </tr>
      <tr>
        <td style="padding:40px 48px;background:#111111;">
          <h1 style="margin:0 0 8px;font-size:32px;font-weight:800;color:#fff;letter-spacing:-1px;">@${user.username} is yours.</h1>
          <p style="margin:0 0 32px;font-size:16px;color:#888;line-height:1.6;">Your Cheese username is officially reserved. No one else can take it.</p>
          <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:24px 28px;margin-bottom:32px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:1px;">YOUR USERNAME</p>
            <p style="margin:0;font-size:28px;font-weight:800;color:#d4a843;">@${user.username}</p>
          </div>
          <p style="margin:0 0 16px;font-size:15px;color:#ccc;font-weight:600;">Move up the leaderboard 🏆</p>
          <p style="margin:0 0 24px;font-size:14px;color:#888;line-height:1.6;">Share your link to earn points. Top spots get early access and exclusive perks.</p>
          <a href="${link}" style="display:inline-block;background:#d4a843;color:#000;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:700;">Share My Reservation →</a>
          <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:16px 20px;margin-top:32px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:1px;">YOUR REFERRAL LINK</p>
            <p style="margin:0;font-size:13px;color:#d4a843;word-break:break-all;">${link}</p>
          </div>
          <p style="margin:32px 0 0;font-size:13px;color:#555;line-height:1.7;">
            Referrals earn <strong style="color:#d4a843;">20 pts</strong> each.
            Twitter shares earn <strong style="color:#d4a843;">10 pts</strong>,
            LinkedIn <strong style="color:#d4a843;">8 pts</strong>, and more.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 48px;background:#0d0d0d;border-radius:0 0 16px 16px;border-top:1px solid #1f1f1f;">
          <p style="margin:0;font-size:12px;color:#444;line-height:1.6;">
            You're receiving this because you joined the Cheese Wallet waitlist.<br>
            © 2025 Cheese Wallet. All rights reserved.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
    await this.send({ to: user.email, subject: '🧀 Your Cheese username is reserved', html });
  }

  async sendWaitlistReminder(params: {
    to: string;
    username: string;
    signupUrl: string;
    daysOnList: number;
    position?: number;
  }): Promise<void> {
    const { waitlistReminder } = await import('./templates/index.js');
    const { subject, html } = waitlistReminder({
      email: params.to,
      username: params.username,
      signupUrl: params.signupUrl,
      daysOnList: params.daysOnList,
      position: params.position,
    });
    await this.send({ to: params.to, subject, html });
  }
}
