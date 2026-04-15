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

### 2. Enable SendModule, BanksModule, CardsModule, PayLinkModule
These are commented out in `app.module.ts` waiting for the vars above.
Uncomment them one at a time and verify each works on mainnet before enabling the next.

### 3. Enforce KYC/tier limits in financial services
`kycStatus` and `tier` exist on the User but **nothing checks them** before
a send, withdrawal, or card spend. Before money moves you need:
- Block sends if `kycStatus !== 'verified'`
- Enforce per-tier daily limits (e.g. Silver: $200/day, Gold: $2,000/day, Black: unlimited)
- Block NGN payout if `kycStatus !== 'verified'`
Files to update: `src/send/send.service.ts`, `src/banks/banks.service.ts`, `src/cards/cards.service.ts`

### 4. Integrate Dojah KYC
Set `DOJAH_APP_ID` and `DOJAH_SECRET_KEY` in production env.
Without this, users stay on Silver tier forever and the KYC endpoints return 503.
All the code is already built — just needs the keys.

---

## 🟠 P1 — Required shortly after launch

### 5. Deposit detection (Stellar)
There is a `stellarDepositCursor` field on User and the wallet service scaffolds
a deposit polling flow, but no scheduler actually polls Horizon for inbound USDC
payments. Users who send USDC to their Stellar address will see nothing credited.
Need: a cron job that polls `horizon.stellar.org/accounts/{pubkey}/payments` using
the cursor, credits the user balance, creates a Transaction record, and sends a
push/email notification.

### 6. Webhook handler for PulseMFB
`BanksModule` has a `BankWebhookDto` and the client is wired up but there is no
endpoint that verifies and processes inbound PulseMFB transfer status webhooks.
Without this, NGN payouts will never auto-confirm — they'll stay in `pending`
forever.
File: `src/banks/banks.controller.ts`

### 7. Run migrations on production DB
`start:prod` already runs `npm run migration:run` on boot, so this is automatic.
But confirm all 5 migrations ran cleanly after the next deploy:
```
npm run migration:show
```

---

## 🟡 P2 — Important but not day-one blocking

### 8. KYC — add NIN as a CBN-required field
CBN mandates NIN (not just BVN) for fintech KYC as of 2023. The NIN endpoint
exists but consider requiring **both** BVN and NIN before marking `kycStatus=verified`
depending on your compliance advice.

### 9. Tier-based transaction limits in the database
Right now limits are hardcoded as constants scattered across services. Move them to
a config table so they can be updated without a redeploy.

### 10. Fraud / rate-limit on KYC attempts
The KYC endpoints are rate-limited per-user (3/min) but there is no global IP-level
rate limit or lockout after N failed BVN/NIN attempts. A bad actor could enumerate
BVNs. Add a failed-attempt counter and lock the user out after 3 failures.

### 11. Admin endpoints
No internal admin API exists. At minimum you need:
- Get user by email / phone / BVN suffix
- Manually set `kycStatus` / `tier`
- Suspend / reinstate a wallet
- View transaction history for any user
Consider a separate admin module protected by a different guard (API key or internal IP).

### 12. Card provider integration
`CardsService` auto-provisions virtual cards with generated numbers and encrypts them,
but there is no real card network behind it (no Visa/Mastercard issuance). This is a
stub. You need to integrate a card issuing provider (e.g. Sudo Africa, Bloc, Stripe Issuing)
before cards are real.

---

## 🟢 P3 — Post-launch polish

### 13. Push notifications
`NotificationsModule` stores in-app notifications but there is no FCM / APNs
integration for mobile push. Users only see notifications when they open the app.

### 14. Referral reward disbursement
`ReferralModule` tracks referral events and points but never actually credits USDC
to the referrer. The `REFERRAL_REWARD_USDC` env var is set but the credit call is
not wired up. Wire it to `BlockchainService.platformDepositUsdc()` once mainnet vars
are live.

### 15. Earn / yield (APY)
Swagger tags reference an Earn module (5–6% APY) but no such module exists in the
codebase. Stub or remove the Swagger tag to avoid confusion.

### 16. PayLink expiry cleanup
`PayLinkModule` has a cron job that marks expired payment requests as `EXPIRED` but
it is commented out in `app.module.ts`. Enable it when PayLink is turned on.

### 17. Health check endpoint
`@nestjs/terminus` is already installed but no `/health` endpoint is wired up.
Useful for Railway / render uptime monitoring and zero-downtime deploys.

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
