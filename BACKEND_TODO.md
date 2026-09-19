# Backend TODO — Cheese Pay

Ordered by priority. Top = must be done before launch, bottom = post-launch polish.

---

## 🔴 P0 — Required before any money moves

### 1. Set mainnet environment variables
Add these to production env to unlock all financial features:
- `STELLAR_PLATFORM_SECRET_KEY` — platform Stellar keypair
- `STELLAR_HORIZON_URL` — `https://horizon.stellar.org`
- `STELLAR_NETWORK` — `mainnet`
- `SECRET_ENCRYPTION_KEY` — 64-char hex key (`openssl rand -hex 32`)
- `BLOCKCHAIN_RPC_URL` — EVM RPC endpoint
- `PLATFORM_WALLET_PRIVATE_KEY` — EVM platform signer
- `WALLET_CONTRACT_ADDRESS` — deployed contract address

### ~~2. Enable SendModule, BanksModule, CardsModule, PayLinkModule~~
~~These are commented out in `app.module.ts` waiting for the vars above.~~
**DONE** — All modules are imported and active in `app.module.ts`. They will function
once the mainnet env vars above are set.

### ~~3. Enforce KYC/tier limits in financial services~~
**DONE** — KYC gates and per-tier daily limits are enforced:
- `src/send/send.service.ts` — blocks sends if `kycStatus !== 'verified'`, enforces `DAILY_CRYPTO_LIMIT_USDC[tier]`
- `src/banks/banks.service.ts` — blocks NGN payout if `kycStatus !== 'verified'`, enforces `DAILY_NGN_LIMIT[tier]`
- `src/cards/cards.service.ts` — blocks card creation if `kycStatus !== 'verified'`

### 4. Integrate Dojah KYC
Set `DOJAH_APP_ID` and `DOJAH_SECRET_KEY` in production env.
Without this, users stay on Silver tier forever and the KYC endpoints return 503.
All the code is already built — just needs the keys.

---

## 🟠 P1 — Required shortly after launch

### ~~5. Deposit detection (Stellar + EVM)~~
**DONE** — `WalletDepositScheduler` in `src/wallet/wallet.scheduler.ts` runs two cron jobs:
- `pollStellarDeposits` (every minute) — polls Horizon for inbound USDC payments, credits user, creates transaction, sends email + push + admin alert.
- `pollEvmDeposits` (every 2 minutes) — scans EVM Transfer events per configured chain, records deposits with dedup via `ON CONFLICT DO NOTHING`.

### ~~6. Webhook handler for PulseMFB~~
**DONE** — `POST /banks/webhook/pulsemfb` in `src/banks/banks.controller.ts` verifies
HMAC signature (`X-Webhook-Signature`) and processes `vas.completed`, `transfer.completed`,
and `transfer.failed` events. NGN payouts auto-confirm/fail.

### ~~7. Run migrations on production DB~~
**DONE** — `start:prod` runs `npm run migration:run` on boot automatically.

---

## 🟡 P2 — Important but not day-one blocking

### 8. KYC — add NIN as a CBN-required field
CBN mandates NIN (not just BVN) for fintech KYC as of 2023. The NIN endpoint
exists but consider requiring **both** BVN and NIN before marking `kycStatus=verified`
depending on your compliance advice.

### 9. Tier-based transaction limits in the database
Right now limits are hardcoded as constants in `src/kyc/tier.limits.ts`. Move them to
a config table so they can be updated without a redeploy.

### 10. Fraud / rate-limit on KYC attempts
The KYC endpoints are rate-limited per-user (3/min via `@Throttle`) but there is no
global IP-level rate limit or lockout after N failed BVN/NIN attempts. A bad actor
could enumerate BVNs. Add a failed-attempt counter and lock the user out after 3 failures.

### ~~11. Admin endpoints~~
**DONE** — Admin module exists at `src/admin-auth/` with:
- User lookup by email/phone/username
- Manually set `kycStatus` / `tier`
- View transaction history for any user
- Dashboard with volume charts, health check
- Protected by separate admin auth guard

### 12. Card provider integration
`CardsService` auto-provisions virtual cards with generated numbers and encrypts them,
but there is no real card network behind it (no Visa/Mastercard issuance). This is a
stub. You need to integrate a card issuing provider (e.g. Sudo Africa, Bloc, Stripe Issuing)
before cards are real.

---

## 🟢 P3 — Post-launch polish

### 13. Push notifications
`NotificationsModule` stores in-app notifications and supports Expo push tokens for
mobile. Web push works via VAPID keys. No native FCM/APNs integration yet — mobile
push relies on Expo's push service.

### ~~14. Referral reward disbursement~~
**DONE** — `ReferralService.qualifyReferral()` in `src/referral/referral.service.ts`
credits USDC to the referrer via `BlockchainService.platformDepositUsdc()` when the
referred user completes their first qualifying transaction.

### 15. Earn / yield (APY)
Swagger tags reference an Earn module (5% APY) but no such module exists in the
codebase. Stub or remove the Swagger tag to avoid confusion.

### ~~16. PayLink expiry cleanup~~
**DONE** — `PayLinkService` has an hourly cron job (`@Cron(CronExpression.EVERY_HOUR)`)
in `src/paylink/paylink.service.ts` that marks expired payment requests as `EXPIRED`.

### 17. Health check endpoint
Basic `GET /` health check exists in `src/app.controller.ts` and admin health at
`/admin/health`. No `@nestjs/terminus` integration for detailed DB/service health checks.

---

## Env vars checklist

| Var | Status | Unlocks |
|---|---|---|
| `DOJAH_APP_ID` + `DOJAH_SECRET_KEY` | ⬜ Not set | KYC |
| `SECRET_ENCRYPTION_KEY` | ⬜ Not set | Cards CVV |
| `STELLAR_PLATFORM_SECRET_KEY` | ⬜ Not set | Wallet, Send, PayLink |
| `STELLAR_HORIZON_URL` | ⬜ Not set | Wallet, Send, PayLink |
| `BLOCKCHAIN_RPC_URL` | ⬜ Not set | EVM wallet |
| `PLATFORM_WALLET_PRIVATE_KEY` | ⬜ Not set | EVM wallet |
| `WALLET_CONTRACT_ADDRESS` | ⬜ Not set | EVM wallet |
| `PULSE_MFB_*` | ⬜ Not set | NGN payout |
