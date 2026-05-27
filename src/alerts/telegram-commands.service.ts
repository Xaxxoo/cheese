// src/alerts/telegram-commands.service.ts
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { EmailService } from '../email/email.service';

@Injectable()
export class TelegramCommandsService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(TelegramCommandsService.name);
  private token: string;
  private chatId: string;
  private offset = 0;
  private active = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly emailService: EmailService,
  ) {
    this.token = this.config.get<string>('alerts.telegramBotToken', '');
    this.chatId = this.config.get<string>('alerts.telegramChatId', '');
  }

  onApplicationBootstrap(): void {
    if (!this.token || !this.chatId) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — command handler disabled',
      );
      return;
    }
    this.active = true;
    this.logger.log('TelegramCommandsService polling for commands');
    void this.poll();
  }

  onApplicationShutdown(): void {
    this.active = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  // ── Polling ───────────────────────────────────────────────────────────────

  private async poll(): Promise<void> {
    if (!this.active) return;

    try {
      const url =
        `https://api.telegram.org/bot${this.token}/getUpdates` +
        `?timeout=10&offset=${this.offset}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as {
          ok: boolean;
          result: TelegramUpdate[];
        };
        if (data.ok && data.result.length > 0) {
          for (const update of data.result) {
            this.offset = update.update_id + 1;
            await this.handleUpdate(update);
          }
        }
      }
    } catch (err) {
      this.logger.error(`Polling error: ${String(err)}`);
    }

    if (this.active) {
      this.pollTimer = setTimeout(() => void this.poll(), 2_000);
    }
  }

  // ── Update handler ────────────────────────────────────────────────────────

  private async handleUpdate(update: TelegramUpdate): Promise<void> {
    const msg = update.message;
    if (!msg?.text) return;

    // Security: only accept messages from the configured admin chat
    const senderId = String(msg.chat.id);
    if (senderId !== this.chatId) return;

    const text = msg.text.trim();

    if (text.startsWith('/email')) {
      await this.handleEmailCommand(text, msg.chat.id);
    }
  }

  // ── /email command ────────────────────────────────────────────────────────

  private async handleEmailCommand(
    text: string,
    chatId: number,
  ): Promise<void> {
    // /email username message body here
    const parts = text.slice('/email'.length).trim().split(/\s+/);
    const username = parts[0];
    const body = parts.slice(1).join(' ').trim();

    if (!username || !body) {
      await this.reply(
        chatId,
        '❌ Usage: /email &lt;username&gt; &lt;message&gt;',
      );
      return;
    }

    let user: User | null;
    try {
      user = await this.userRepo.findOne({
        where: { username: username.toLowerCase() },
        select: ['id', 'username', 'email', 'fullName'],
      });
    } catch (err) {
      this.logger.error(`DB lookup failed: ${String(err)}`);
      await this.reply(chatId, '❌ Database error during user lookup.');
      return;
    }

    if (!user) {
      await this.reply(
        chatId,
        `❌ No user found with username @${username}`,
      );
      return;
    }

    if (!user.email) {
      await this.reply(
        chatId,
        `❌ @${username} has no email address on file.`,
      );
      return;
    }

    const name = user.fullName || user.username;
    const html = this.buildEmailHtml(name, body);

    try {
      await this.emailService.sendAdminAlert({
        to: user.email,
        subject: 'Message from Cheese Pay',
        html,
      });
    } catch (err) {
      this.logger.error(`Email send failed: ${String(err)}`);
      await this.reply(chatId, `❌ Failed to send email: ${String(err)}`);
      return;
    }

    const masked = this.maskEmail(user.email);
    await this.reply(
      chatId,
      `✅ Email sent to @${user.username} (${masked})`,
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async reply(chatId: number, text: string): Promise<void> {
    try {
      const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      });
    } catch (err) {
      this.logger.error(`Failed to send Telegram reply: ${String(err)}`);
    }
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '****';
    const masked =
      local.length <= 1 ? '*' : local[0] + '*'.repeat(local.length - 1);
    return `${masked}@${domain}`;
  }

  private buildEmailHtml(name: string, message: string): string {
    const escaped = message
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

      <!-- Header -->
      <tr>
        <td style="background:#1a1a1a;border-radius:14px 14px 0 0;padding:28px 32px;border-bottom:1px solid #2a2a2a;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:1px;">Cheese Pay</p>
          <h1 style="margin:0;font-size:20px;font-weight:700;color:#d4a843;">Message from Cheese Pay</h1>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="background:#111111;padding:28px 32px;">
          <p style="margin:0 0 20px;font-size:15px;color:#ccc;line-height:1.6;">Hi ${name},</p>
          <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
            <p style="margin:0;font-size:14px;color:#ddd;line-height:1.7;">${escaped}</p>
          </div>
          <p style="margin:0;font-size:13px;color:#555;line-height:1.6;">– The Cheese Pay Team</p>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#0d0d0d;border-radius:0 0 14px 14px;padding:18px 32px;border-top:1px solid #1f1f1f;">
          <p style="margin:0;font-size:11px;color:#444;line-height:1.6;">© 2025 Cheese Pay. All rights reserved.</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface TelegramUpdate {
  update_id: number;
  message?: {
    chat: { id: number };
    text?: string;
  };
}
