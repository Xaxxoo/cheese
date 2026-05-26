// src/alerts/alerts.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';

export interface FailedTransferAlert {
  username: string;
  userEmail?: string;
  amountNgn: string | number;
  amountUsdc: string;
  feeUsdc: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  reference: string;
  failureReason: string;
  /** 'stellar' = USDC never left user. 'provider' or 'webhook' = USDC was refunded. */
  stage: 'stellar' | 'provider' | 'webhook';
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Fire-and-forget: send Telegram message + admin email for a failed bank transfer.
   * Call as: void this.alertsService.notifyFailedTransfer(alert).catch(...)
   */
  async notifyFailedTransfer(alert: FailedTransferAlert): Promise<void> {
    const results = await Promise.allSettled([
      this.sendTelegram(alert),
      this.sendEmail(alert),
    ]);

    for (const r of results) {
      if (r.status === 'rejected') {
        this.logger.error(
          `Alert delivery failed [ref=${alert.reference}]: ${String(r.reason)}`,
        );
      }
    }
  }

  // ── Telegram ──────────────────────────────────────────────────────────────

  private async sendTelegram(alert: FailedTransferAlert): Promise<void> {
    const token = this.config.get<string>('alerts.telegramBotToken');
    const chatId = this.config.get<string>('alerts.telegramChatId');

    if (!token || !chatId) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — skipping Telegram alert',
      );
      return;
    }

    const refunded =
      alert.stage === 'stellar'
        ? '❌ No — USDC never left user'
        : '✅ Yes — USDC returned to user';

    const stageLine =
      alert.stage === 'stellar'
        ? 'Stellar USDC debit failed (balance untouched)'
        : alert.stage === 'provider'
          ? 'Banking provider rejected (USDC refunded)'
          : 'Webhook failure / reversal (USDC refunded)';

    const maskedAccount =
      alert.accountNumber.length >= 4
        ? '*'.repeat(alert.accountNumber.length - 4) +
          alert.accountNumber.slice(-4)
        : alert.accountNumber;

    const amountNgn =
      typeof alert.amountNgn === 'number'
        ? alert.amountNgn.toLocaleString('en-NG')
        : parseFloat(String(alert.amountNgn)).toLocaleString('en-NG');

    const now = new Date().toLocaleString('en-NG', {
      timeZone: 'Africa/Lagos',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const text = [
      '⚠️ <b>Failed Bank Transfer</b>',
      '',
      `👤 User: <code>@${alert.username}</code>`,
      `💰 Amount: ₦${amountNgn} (~$${alert.amountUsdc} USDC)`,
      `💸 Fee charged: $${alert.feeUsdc} USDC`,
      `🏦 Bank: ${alert.bankName} — ${alert.accountName}`,
      `🔢 Account: <code>${maskedAccount}</code>`,
      `🔖 Reference: <code>${alert.reference}</code>`,
      `❌ Reason: ${alert.failureReason}`,
      `📍 Stage: ${stageLine}`,
      '',
      `↩️ Refunded: ${refunded}`,
      `🕐 Time: ${now} WAT`,
    ].join('\n');

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Telegram API error ${res.status}: ${body}`);
    }
  }

  // ── Email ─────────────────────────────────────────────────────────────────

  private async sendEmail(alert: FailedTransferAlert): Promise<void> {
    const adminEmail = this.config.get<string>('alerts.adminAlertEmail');
    if (!adminEmail) {
      this.logger.warn(
        'ADMIN_ALERT_EMAIL not set — skipping admin alert email',
      );
      return;
    }

    const refunded =
      alert.stage === 'stellar'
        ? '<span style="color:#ff6b6b;">No — USDC never left user</span>'
        : '<span style="color:#51cf66;">Yes — USDC returned to user</span>';

    const stageLine =
      alert.stage === 'stellar'
        ? 'Stellar USDC debit failed (balance untouched)'
        : alert.stage === 'provider'
          ? 'Banking provider rejected (USDC refunded)'
          : 'Webhook failure / reversal (USDC refunded)';

    const maskedAccount =
      alert.accountNumber.length >= 4
        ? '*'.repeat(alert.accountNumber.length - 4) +
          alert.accountNumber.slice(-4)
        : alert.accountNumber;

    const amountNgn =
      typeof alert.amountNgn === 'number'
        ? alert.amountNgn.toLocaleString('en-NG')
        : parseFloat(String(alert.amountNgn)).toLocaleString('en-NG');

    const now = new Date().toLocaleString('en-NG', {
      timeZone: 'Africa/Lagos',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const row = (label: string, value: string) => `
      <tr>
        <td style="padding:8px 0;font-size:12px;color:#888;width:140px;vertical-align:top;">${label}</td>
        <td style="padding:8px 0;font-size:13px;color:#fff;vertical-align:top;">${value}</td>
      </tr>`;

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

      <!-- Header -->
      <tr>
        <td style="background:#1a1a1a;border-radius:14px 14px 0 0;padding:28px 32px;border-bottom:1px solid #2a2a2a;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:1px;">Cheese Pay Admin Alert</p>
          <h1 style="margin:0;font-size:20px;font-weight:700;color:#ff6b6b;">⚠️ Failed Bank Transfer</h1>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="background:#111111;padding:28px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            ${row('User', `@${alert.username}`)}
            ${row('Amount', `₦${amountNgn} (~$${alert.amountUsdc} USDC)`)}
            ${row('Fee charged', `$${alert.feeUsdc} USDC`)}
            ${row('Bank', `${alert.bankName} — ${alert.accountName}`)}
            ${row('Account', maskedAccount)}
            ${row('Reference', `<code style="font-family:monospace;background:#1e1e1e;padding:2px 6px;border-radius:4px;font-size:12px;">${alert.reference}</code>`)}
            ${row('Failure reason', `<span style="color:#ffa94d;">${alert.failureReason}</span>`)}
            ${row('Stage', stageLine)}
            ${row('Refunded', refunded)}
            ${row('Time', `${now} WAT`)}
          </table>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#0d0d0d;border-radius:0 0 14px 14px;padding:18px 32px;border-top:1px solid #1f1f1f;">
          <p style="margin:0;font-size:11px;color:#444;">This is an automated admin alert from Cheese Pay. Do not reply to this email.</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

    await this.emailService.sendAdminAlert({
      to: adminEmail,
      subject: `⚠️ Failed Bank Transfer — @${alert.username} — ${alert.reference}`,
      html,
    });
  }
}
