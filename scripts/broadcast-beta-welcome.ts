/**
 * broadcast-beta-welcome.ts
 *
 * Sends a personal welcome / beta-status email from Rejoice to all users
 * who have completed sign-up (email + username set).
 *
 * USAGE
 *   # Preview — sends ONLY to the preview address, no other emails sent:
 *   ts-node -r tsconfig-paths/register scripts/broadcast-beta-welcome.ts
 *
 *   # Send to everyone (irreversible):
 *   ts-node -r tsconfig-paths/register scripts/broadcast-beta-welcome.ts --send-all
 *
 * REQUIRED ENV
 *   RESEND_API_KEY   Your Resend API key
 *   DATABASE_URL  OR  DB_HOST + DB_PORT + DB_USER + DB_PASS + DB_NAME
 */

import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { Resend } from 'resend';

dotenv.config();

// ─── Config ───────────────────────────────────────────────────────────────────

const PREVIEW_EMAIL = 'bnahmad83@gmail.com';
const SEND_ALL      = process.argv.includes('--send-all');
const FROM_ADDRESS  = 'Cheese Pay <hi@cheesepay.xyz>';
const REPLY_TO      = 'hi@cheesepay.xyz';
const DELAY_MS      = 200; // 5 emails/sec — well inside Resend's limits

// ─── DB connection ────────────────────────────────────────────────────────────

async function buildDataSource(): Promise<DataSource> {
  const url = process.env.DATABASE_URL;
  const ds = url
    ? new DataSource({ type: 'postgres', url, ssl: { rejectUnauthorized: false } })
    : new DataSource({
        type:     'postgres',
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASS     || '',
        database: process.env.DB_NAME     || 'cheese',
        ssl:      false,
      });
  await ds.initialize();
  return ds;
}

// ─── Email template ───────────────────────────────────────────────────────────

function buildEmail(name: string): { subject: string; html: string; text: string } {
  const subject = 'A personal note from Cheese Pay';
  const displayName = name || 'there';

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
    body { background-color: #0A0A0A; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased; }
    a { color: #C9A84C; text-decoration: none; }
  </style>
</head>
<body style="background-color:#0A0A0A;margin:0;padding:0;width:100%;">
  <!-- preheader -->
  <div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0;font-size:1px;line-height:1px;">
    A personal note from Rejoice, co-founder of Cheese Pay — your beta access explained.&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background-color:#0A0A0A;min-height:100vh;">
    <tr><td align="center" style="padding:32px 16px 48px;">

      <!-- Container -->
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
        style="max-width:600px;width:100%;">

        <!-- Header logo -->
        <tr>
          <td style="padding-bottom:36px;text-align:center;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
              <tr>
                <td style="vertical-align:middle;padding-right:16px;">
                  <span style="font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-size:34px;font-weight:300;color:#C9A84C;letter-spacing:2px;line-height:1;">C</span>
                </td>
                <td style="vertical-align:middle;padding-right:16px;">
                  <div style="width:1px;height:34px;background:linear-gradient(180deg,transparent,#C9A84C88,transparent);"></div>
                </td>
                <td style="vertical-align:middle;">
                  <p style="font-size:11px;font-weight:500;letter-spacing:6px;color:#C9A84C;font-family:'Inter',-apple-system,sans-serif;text-transform:uppercase;line-height:1;margin:0;">CHEESE PAY</p>
                  <p style="font-size:7.5px;font-weight:300;letter-spacing:3px;color:#555555;font-family:'Inter',-apple-system,sans-serif;text-transform:uppercase;margin:5px 0 0 0;line-height:1;">THE GOLDEN STANDARD</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Card body -->
        <tr>
          <td style="background-color:#1A1A1A;border-radius:20px;border:1px solid #2E2E2E;overflow:hidden;">

            <!-- Hero section -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:40px 40px 32px;">
                  <p style="font-size:13px;font-weight:500;letter-spacing:3px;color:#C9A84C;text-transform:uppercase;font-family:'Inter',sans-serif;margin:0 0 16px;">A personal note</p>
                  <h1 style="font-size:28px;font-weight:700;color:#F5F5F5;font-family:'Inter',sans-serif;line-height:1.3;margin:0 0 8px;letter-spacing:-0.5px;">
                    Hi ${displayName}, welcome to the family.
                  </h1>
                </td>
              </tr>

              <!-- Gold divider -->
              <tr><td style="padding:0 40px;">
                <div style="height:1px;background:linear-gradient(90deg,transparent,#C9A84C55,transparent);"></div>
              </td></tr>

              <!-- Letter body -->
              <tr>
                <td style="padding:32px 40px;">
                  <p style="font-size:15px;color:#CCCCCC;font-family:'Inter',sans-serif;line-height:1.8;margin:0 0 20px;">
                    My name is <strong style="color:#F5F5F5;">Rejoice</strong>, and I'm one of the founders of Cheese Pay.
                    I wanted to reach out personally — not as a notification, but as a genuine thank-you for being part of what we're building.
                  </p>
                  <p style="font-size:15px;color:#CCCCCC;font-family:'Inter',sans-serif;line-height:1.8;margin:0 0 28px;">
                    We are currently in a <strong style="color:#C9A84C;">private beta</strong>, deliberately keeping our doors open to a small, trusted group as we refine the product. Here is what you need to know:
                  </p>

                  <!-- KYC Approved box -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:16px;">
                    <tr>
                      <td style="background:#C9A84C15;border:1px solid #C9A84C40;border-radius:12px;padding:20px 24px;">
                        <p style="font-size:11px;font-weight:600;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;font-family:'Inter',sans-serif;margin:0 0 10px;">If your KYC was approved</p>
                        <p style="font-size:14px;color:#CCCCCC;font-family:'Inter',sans-serif;line-height:1.7;margin:0;">
                          You were approved because we know you personally or you came through a trusted referral in our early network.
                          This means you have <strong style="color:#F5F5F5;">full access</strong> to Cheese Pay right now — you can fund your wallet, make transfers, and withdraw to your bank account.
                          Thank you for your trust; it means everything to us.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- KYC Pending box -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:28px;">
                    <tr>
                      <td style="background:#22222255;border:1px solid #2E2E2E;border-radius:12px;padding:20px 24px;">
                        <p style="font-size:11px;font-weight:600;letter-spacing:2px;color:#999999;text-transform:uppercase;font-family:'Inter',sans-serif;margin:0 0 10px;">If your KYC has not been approved yet</p>
                        <p style="font-size:14px;color:#CCCCCC;font-family:'Inter',sans-serif;line-height:1.7;margin:0 0 12px;">
                          This is <strong style="color:#F5F5F5;">not a rejection</strong>. We simply haven't opened fully to the public yet.
                          Once we launch beyond the beta, KYC will be available to everyone and you'll be able to complete verification and carry out all transactions freely.
                        </p>
                        <p style="font-size:14px;color:#CCCCCC;font-family:'Inter',sans-serif;line-height:1.7;margin:0;">
                          If you would like to be considered for beta access sooner, you are welcome to reach out directly to me on Telegram:
                          <a href="https://t.me/xaxxoo23" style="color:#C9A84C;font-weight:600;">@xaxxoo23</a>
                        </p>
                      </td>
                    </tr>
                  </table>

                  <p style="font-size:15px;color:#CCCCCC;font-family:'Inter',sans-serif;line-height:1.8;margin:0 0 32px;">
                    We are building something we're truly proud of, and your presence — at whatever stage — matters to us.
                    More exciting updates are on the way.
                  </p>

                  <!-- Signature -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td>
                        <p style="font-size:15px;color:#F5F5F5;font-family:'Inter',sans-serif;font-weight:600;margin:0;">Rejoice</p>
                        <p style="font-size:13px;color:#999999;font-family:'Inter',sans-serif;margin:4px 0 0;">Co-founder, Cheese Pay</p>
                        <p style="font-size:12px;color:#555555;font-family:'Inter',sans-serif;margin:6px 0 0;">
                          <a href="https://t.me/xaxxoo23" style="color:#C9A84C;text-decoration:none;">t.me/xaxxoo23</a>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- CTA -->
              <tr><td style="padding:0 40px 40px;text-align:center;">
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
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding-top:32px;text-align:center;">
            <p style="font-size:12px;color:#999999;font-family:'Inter',sans-serif;line-height:1.8;">
              Cheese Pay &middot; The Golden Standard in Digital Finance<br/>
              <a href="https://cheesepay.xyz" style="color:#C9A84C;text-decoration:none;">cheesepay.xyz</a>
              &nbsp;&middot;&nbsp;
              <a href="https://cheesepay.xyz/privacy" style="color:#999999;text-decoration:none;">Privacy</a>
              &nbsp;&middot;&nbsp;
              <a href="https://cheesepay.xyz/terms" style="color:#999999;text-decoration:none;">Terms</a>
            </p>
            <p style="margin-top:12px;font-size:11px;color:#2E2E2E;font-family:'Inter',sans-serif;">
              &copy; ${new Date().getFullYear()} Cheese Pay. All rights reserved.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Hi ${displayName},

My name is Rejoice, and I'm one of the founders of Cheese Pay. I wanted to reach out personally to welcome you and share a quick update.

We are currently in a private beta, keeping our doors open to a small, trusted group as we refine the product.

IF YOUR KYC WAS APPROVED
You were approved because we know you personally or you came through a trusted early referral. You have full access to Cheese Pay right now — fund your wallet, make transfers, and withdraw to your bank.

IF YOUR KYC HAS NOT BEEN APPROVED YET
This is not a rejection. Once we launch publicly, KYC will be open to everyone. If you'd like to be considered for beta access sooner, feel free to message me directly on Telegram: @xaxxoo23

We're building something we're proud of, and we're grateful to have you here.

With warmth,
Rejoice
Co-founder, Cheese Pay
t.me/xaxxoo23

---
Cheese Pay · cheesepay.xyz
© ${new Date().getFullYear()} Cheese Pay. All rights reserved.`;

  return { subject, html, text };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY is not set');
    process.exit(1);
  }
  const resend = new Resend(apiKey);

  // ── 1. Send preview to approval address ──────────────────────────────────
  console.log(`\nSending preview to ${PREVIEW_EMAIL}...`);
  const preview = buildEmail('there');
  const { error: previewError } = await resend.emails.send({
    from:    FROM_ADDRESS,
    to:      PREVIEW_EMAIL,
    subject: `[PREVIEW] ${preview.subject}`,
    html:    preview.html,
    text:    preview.text,
    replyTo: REPLY_TO,
  });

  if (previewError) {
    console.error('Preview send failed:', previewError);
    process.exit(1);
  }
  console.log(`Preview sent to ${PREVIEW_EMAIL}`);

  if (!SEND_ALL) {
    console.log('\nDry run complete. Review the preview email, then re-run with --send-all to send to all users.');
    process.exit(0);
  }

  // ── 2. Load all signed-up users from DB ──────────────────────────────────
  const ds = await buildDataSource();

  interface UserRow { id: string; email: string; username: string; full_name: string | null }
  const users: UserRow[] = await ds.query(`
    SELECT id, email, username, full_name
    FROM "user"
    WHERE email    IS NOT NULL
      AND username IS NOT NULL
    ORDER BY created_at ASC
  `);

  console.log(`\nFound ${users.length} signed-up users. Starting broadcast...\n`);

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    const displayName = user.full_name?.split(' ')[0] || user.username;
    const { subject, html, text } = buildEmail(displayName);

    try {
      const { error } = await resend.emails.send({
        from:    FROM_ADDRESS,
        to:      user.email,
        subject,
        html,
        text,
        replyTo: REPLY_TO,
        headers: {
          'X-Entity-Ref-ID':        `broadcast-beta-${user.id}`,
          'List-Unsubscribe':       `<mailto:${REPLY_TO}?subject=unsubscribe>`,
          'List-Unsubscribe-Post':  'List-Unsubscribe=One-Click',
        },
      });

      if (error) {
        console.error(`  FAIL [${user.email}]:`, error);
        failed++;
      } else {
        console.log(`  OK   [${user.email}] (@${user.username})`);
        sent++;
      }
    } catch (err) {
      console.error(`  ERR  [${user.email}]:`, (err as Error).message);
      failed++;
    }

    // Throttle to avoid rate limits
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  await ds.destroy();

  console.log(`\nDone. Sent: ${sent}  Failed: ${failed}  Total: ${users.length}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
