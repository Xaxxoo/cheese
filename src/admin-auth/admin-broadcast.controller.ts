// src/admin-auth/admin-broadcast.controller.ts
//
// One-off broadcast endpoint.  Remove or gate behind a feature flag once
// the beta-welcome campaign is complete.
//
import {
  Body,
  Controller,
  ForbiddenException,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, AdminRole } from '../auth/entities/user.entity';
import { WaitlistEntry, WaitlistStatus } from '../waitlist/entities/waitlist-entry.entity';
import { EmailService } from '../email/email.service';
import { appLaunch } from '../email/templates';

const PREVIEW_ADDRESS = 'bnahmad83@gmail.com';

function buildBetaWelcomeEmail(name: string): { subject: string; html: string; text: string } {
  const subject = 'A personal note from Cheese Pay';
  const year = new Date().getFullYear();

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="dark" />
  <title>Cheese Pay</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background-color: #0A0A0A; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    a { color: #C9A84C; text-decoration: none; }
  </style>
</head>
<body style="background-color:#0A0A0A;margin:0;padding:0;width:100%;">
  <div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0;font-size:1px;line-height:1px;">
    A personal note from Rejoice at Cheese Pay — your beta access explained.&nbsp;&#8204;&nbsp;&#8204;&nbsp;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background-color:#0A0A0A;min-height:100vh;">
    <tr><td align="center" style="padding:32px 16px 48px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
        style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="padding-bottom:36px;text-align:center;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
              <tr>
                <td style="vertical-align:middle;padding-right:16px;">
                  <span style="font-family:Georgia,serif;font-size:34px;font-weight:300;color:#C9A84C;letter-spacing:2px;line-height:1;">C</span>
                </td>
                <td style="vertical-align:middle;padding-right:16px;">
                  <div style="width:1px;height:34px;background:linear-gradient(180deg,transparent,#C9A84C88,transparent);"></div>
                </td>
                <td style="vertical-align:middle;">
                  <p style="font-size:11px;font-weight:500;letter-spacing:6px;color:#C9A84C;font-family:'Inter',sans-serif;text-transform:uppercase;line-height:1;margin:0;">CHEESE PAY</p>
                  <p style="font-size:7.5px;font-weight:300;letter-spacing:3px;color:#555555;font-family:'Inter',sans-serif;text-transform:uppercase;margin:5px 0 0 0;line-height:1;">THE GOLDEN STANDARD</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Card -->
        <tr>
          <td style="background-color:#1A1A1A;border-radius:20px;border:1px solid #2E2E2E;overflow:hidden;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

              <!-- Heading -->
              <tr>
                <td style="padding:40px 40px 28px;">
                  <p style="font-size:12px;font-weight:600;letter-spacing:3px;color:#C9A84C;text-transform:uppercase;font-family:'Inter',sans-serif;margin:0 0 14px;">A personal note</p>
                  <h1 style="font-size:26px;font-weight:700;color:#F5F5F5;font-family:'Inter',sans-serif;line-height:1.35;margin:0;letter-spacing:-0.5px;">
                    Hi ${name}, welcome to the family.
                  </h1>
                </td>
              </tr>
              <tr><td style="padding:0 40px;"><div style="height:1px;background:linear-gradient(90deg,transparent,#C9A84C55,transparent);"></div></td></tr>

              <!-- Body -->
              <tr>
                <td style="padding:32px 40px 0;">
                  <p style="font-size:15px;color:#CCCCCC;font-family:'Inter',sans-serif;line-height:1.8;margin:0 0 20px;">
                    My name is <strong style="color:#F5F5F5;">Rejoice</strong>, and I lead customer success and communications here at Cheese Pay.
                    I wanted to reach out personally to welcome you and let you know how glad we are to have you with us.
                  </p>
                  <p style="font-size:15px;color:#CCCCCC;font-family:'Inter',sans-serif;line-height:1.8;margin:0 0 28px;">
                    We are currently in a <strong style="color:#C9A84C;">private beta</strong>, deliberately keeping our doors open
                    to a small, trusted group as we refine the product. Here is what you need to know:
                  </p>

                  <!-- KYC approved -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:14px;">
                    <tr>
                      <td style="background:#C9A84C15;border:1px solid #C9A84C40;border-radius:12px;padding:20px 24px;">
                        <p style="font-size:11px;font-weight:600;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;font-family:'Inter',sans-serif;margin:0 0 10px;">If your KYC was approved</p>
                        <p style="font-size:14px;color:#CCCCCC;font-family:'Inter',sans-serif;line-height:1.75;margin:0;">
                          You were approved because we know you personally or you came through a trusted referral in our early network.
                          You have <strong style="color:#F5F5F5;">full access</strong> to Cheese Pay right now and can fund your wallet, make transfers, and withdraw to your bank account.
                          Thank you for your trust; it means everything to us.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- KYC pending -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:28px;">
                    <tr>
                      <td style="background:#22222255;border:1px solid #2E2E2E;border-radius:12px;padding:20px 24px;">
                        <p style="font-size:11px;font-weight:600;letter-spacing:2px;color:#999999;text-transform:uppercase;font-family:'Inter',sans-serif;margin:0 0 10px;">If your KYC has not been approved yet</p>
                        <p style="font-size:14px;color:#CCCCCC;font-family:'Inter',sans-serif;line-height:1.75;margin:0 0 12px;">
                          This is <strong style="color:#F5F5F5;">not a rejection</strong>. We simply haven't opened the platform fully to the public yet.
                          Once we launch beyond the beta, KYC will be available to everyone and you will be able to complete verification and carry out all transactions freely.
                        </p>
                        <p style="font-size:14px;color:#CCCCCC;font-family:'Inter',sans-serif;line-height:1.75;margin:0;">
                          If you would like to be considered for beta access sooner, you are welcome to reach out directly to our founder on Telegram:
                          <a href="https://t.me/xaxxoo23" style="color:#C9A84C;font-weight:600;">@xaxxoo23</a>
                        </p>
                      </td>
                    </tr>
                  </table>

                  <p style="font-size:15px;color:#CCCCCC;font-family:'Inter',sans-serif;line-height:1.8;margin:0 0 32px;">
                    We are building something we are truly proud of, and your presence — at whatever stage — matters deeply to us.
                    More exciting updates are on the way.
                  </p>

                  <!-- Signature -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
                    <tr>
                      <td>
                        <p style="font-size:15px;color:#F5F5F5;font-family:'Inter',sans-serif;font-weight:600;margin:0;">Rejoice</p>
                        <p style="font-size:13px;color:#999999;font-family:'Inter',sans-serif;margin:4px 0 0;">Head of Customer Success &amp; Communications, Cheese Pay</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- CTA -->
              <tr>
                <td style="padding:0 40px 40px;text-align:center;">
                  <div style="height:1px;background:linear-gradient(90deg,transparent,#C9A84C55,transparent);margin-bottom:32px;"></div>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
                    <tr>
                      <td style="border-radius:12px;background:linear-gradient(135deg,#A8822C,#C9A84C);box-shadow:0 4px 24px #C9A84C40;">
                        <a href="https://cheesepay.xyz" target="_blank"
                          style="display:inline-block;padding:16px 40px;font-size:15px;font-weight:600;
                                 color:#0A0A0A;text-decoration:none;letter-spacing:-0.2px;
                                 font-family:'Inter',sans-serif;border-radius:12px;">
                          Open Cheese Pay →
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding-top:32px;text-align:center;">
            <p style="font-size:12px;color:#999999;font-family:'Inter',sans-serif;line-height:1.8;">
              Cheese Pay &middot; The Golden Standard in Digital Finance<br/>
              <a href="https://cheesepay.xyz" style="color:#C9A84C;">cheesepay.xyz</a>
              &nbsp;&middot;&nbsp;
              <a href="https://cheesepay.xyz/privacy" style="color:#999999;">Privacy</a>
              &nbsp;&middot;&nbsp;
              <a href="https://cheesepay.xyz/terms" style="color:#999999;">Terms</a>
            </p>
            <p style="margin-top:12px;font-size:11px;color:#2E2E2E;font-family:'Inter',sans-serif;">
              &copy; ${year} Cheese Pay. All rights reserved.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Hi ${name},

My name is Rejoice, and I lead customer success and communications at Cheese Pay. I wanted to reach out personally to welcome you and let you know how glad we are to have you with us.

We are currently in a private beta, keeping our doors open to a small trusted group as we refine the product.

IF YOUR KYC WAS APPROVED
You were approved because we know you personally or you came through a trusted early referral. You have full access to Cheese Pay right now and can fund your wallet, make transfers, and withdraw to your bank.

IF YOUR KYC HAS NOT BEEN APPROVED YET
This is not a rejection. Once we launch publicly, KYC will be open to everyone. If you would like to be considered for beta access sooner, you are welcome to reach out directly to our founder on Telegram: @xaxxoo23

We are building something we are proud of, and we are grateful to have you here.

With warmth,
Rejoice
Head of Customer Success & Communications, Cheese Pay

---
Cheese Pay · cheesepay.xyz
© ${year} Cheese Pay. All rights reserved.
To unsubscribe, reply with "unsubscribe" in the subject line.`;

  return { subject, html, text };
}

@ApiTags('Admin – Broadcast')
@Controller('admin/broadcast')
@UseGuards(AdminJwtGuard)
@ApiBearerAuth('access-token')
export class AdminBroadcastController {
  private readonly logger = new Logger(AdminBroadcastController.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(WaitlistEntry) private readonly waitlistRepo: Repository<WaitlistEntry>,
    private readonly emailService: EmailService,
  ) {}

  // ── POST /admin/broadcast/beta-welcome/preview ────────────────────────────
  // Sends the email to the approval address only. Any admin can trigger this.
  @Post('beta-welcome/preview')
  @ApiOperation({ summary: 'Send beta-welcome preview to approval inbox' })
  async previewBetaWelcome() {
    const { subject, html, text } = buildBetaWelcomeEmail('there');
    await (this.emailService as any).send({
      to:      PREVIEW_ADDRESS,
      subject: `[PREVIEW] ${subject}`,
      html,
      text,
    });
    this.logger.log(`Beta-welcome preview sent to ${PREVIEW_ADDRESS}`);
    return { sent: 1, to: PREVIEW_ADDRESS };
  }

  // ── POST /admin/broadcast/beta-welcome/send-all ───────────────────────────
  // Sends to all signed-up users. Super-admin only.
  @Post('beta-welcome/send-all')
  @ApiOperation({ summary: 'Send beta-welcome email to all signed-up users (super_admin only)' })
  async sendAllBetaWelcome(@CurrentUser() admin: User) {
    if (admin.adminRole !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super_admin can send broadcast emails');
    }

    const users = await this.userRepo.find({
      where: {},
      select: ['id', 'email', 'username', 'fullName'],
    });
    const eligible = users.filter((u) => u.email && u.username);

    this.logger.log(`Beta-welcome broadcast started — ${eligible.length} recipients`);

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const user of eligible) {
      const firstName = user.fullName?.split(' ')[0] || user.username!;
      const { subject, html, text } = buildBetaWelcomeEmail(firstName);
      try {
        await (this.emailService as any).send({ to: user.email!, subject, html, text });
        sent++;
        // 5 emails/sec — well inside Resend's rate limits
        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        failed++;
        errors.push(`${user.email}: ${(err as Error).message}`);
        this.logger.error(`Broadcast failed for ${user.email}: ${(err as Error).message}`);
      }
    }

    this.logger.log(`Beta-welcome broadcast done — sent=${sent} failed=${failed}`);
    return { sent, failed, total: eligible.length, errors };
  }

  // ── POST /admin/broadcast/launch/preview ──────────────────────────────────
  // Sends the "we're live" email to the approval address only.
  @Post('launch/preview')
  @ApiOperation({ summary: 'Send waitlist-launch preview to approval inbox' })
  async previewLaunch() {
    const { subject, html } = appLaunch({ username: 'there', appUrl: 'https://cheesepay.xyz' });
    await (this.emailService as any).send({
      to:      PREVIEW_ADDRESS,
      subject: `[PREVIEW] ${subject}`,
      html,
      text:    `Cheese Pay is live! Visit https://cheesepay.xyz to claim your account.`,
    });
    this.logger.log(`Launch preview sent to ${PREVIEW_ADDRESS}`);
    return { sent: 1, to: PREVIEW_ADDRESS };
  }

  // ── POST /admin/broadcast/launch/send ────────────────────────────────────
  // Sends to PENDING waitlist entries, up to `limit` at a time.
  // Re-running picks up the remainder automatically (sent entries are NOTIFIED).
  // Super-admin only.
  @Post('launch/send')
  @ApiOperation({ summary: 'Send "we\'re live" email to waitlist (super_admin only, batched by limit)' })
  async sendLaunch(
    @CurrentUser() admin: User,
    @Body() body: { limit?: number },
  ) {
    if (admin.adminRole !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super_admin can send broadcast emails');
    }

    const batchSize = body?.limit && body.limit > 0 ? body.limit : 100;

    const entries = await this.waitlistRepo.find({
      where: { status: WaitlistStatus.PENDING },
      order: { createdAt: 'ASC' },
      take: batchSize,
    });

    const eligible = entries.filter((e) => e.email && e.username);
    this.logger.log(`Launch broadcast started — ${eligible.length} recipients (limit=${batchSize})`);

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const entry of eligible) {
      const { subject, html } = appLaunch({
        username: entry.username!,
        appUrl:   'https://cheesepay.xyz',
      });
      const text =
        `Hi @${entry.username},\n\n` +
        `Cheese Pay is officially live. You reserved your spot early — your username is locked and your wallet is ready.\n\n` +
        `Visit https://cheesepay.xyz to claim your account now.\n\n` +
        `Cheese Pay · cheesepay.xyz`;
      try {
        await (this.emailService as any).send({ to: entry.email!, subject, html, text });
        entry.status     = WaitlistStatus.NOTIFIED;
        entry.notifiedAt = new Date();
        await this.waitlistRepo.save(entry);
        sent++;
        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        failed++;
        errors.push(`${entry.email}: ${(err as Error).message}`);
        this.logger.error(`Launch broadcast failed for ${entry.email}: ${(err as Error).message}`);
      }
    }

    this.logger.log(`Launch broadcast done — sent=${sent} failed=${failed}`);
    return { sent, failed, total: eligible.length, errors };
  }
}
