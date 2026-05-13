# CheesePay Merchant Product Architecture

## Product framing

CheesePay Merchant is a merchant operating system that abstracts blockchain complexity behind a Stripe-grade payments experience. The merchant only thinks in terms of payment collection, settlement preference, payout timing, risk posture, and team controls.

Core principle:

- Accept crypto without touching crypto.

Language rules:

- Use `digital dollar` instead of `USDC` in general-facing UI where possible.
- Use `payment network` instead of `chain`.
- Use `instant payout`, `scheduled payout`, `hold balance`, and `settlement method` instead of crypto-native terminology.

## Product architecture

### Experience layers

1. Merchant authentication and onboarding
2. Merchant console
3. Payment creation tools
4. Settlement and payout operations
5. Team and store management
6. Developer platform
7. Compliance and audit

### Frontend domain model

- `merchant user`: authenticated operator with role and permissions
- `merchant profile`: business or individual merchant account
- `store`: collection point for a brand, location, or channel
- `payment request`: invoice, link, QR, checkout session, or API-issued collection object
- `payment`: funded customer payment with network, FX, fees, and settlement trail
- `settlement`: payout or balance-credit event triggered after payment confirmation
- `payout account`: bank or digital dollar destination for merchant settlement
- `webhook endpoint`: merchant callback receiver with delivery history
- `api key`: environment-bound programmatic access credential
- `audit event`: immutable security and compliance record

## Suggested frontend folder structure

```text
src/
  app/
    merchant/
      layout.tsx
      page.tsx
      sign-in/page.tsx
      sign-up/page.tsx
      forgot-password/page.tsx
      verify/page.tsx
      2fa/page.tsx
      onboarding/page.tsx
      (console)/
        layout.tsx
        dashboard/page.tsx
        payments/page.tsx
        payments/[paymentId]/page.tsx
        settlements/page.tsx
        analytics/page.tsx
        customers/page.tsx
        api-keys/page.tsx
        webhooks/page.tsx
        team/page.tsx
        stores/page.tsx
        branding/page.tsx
        notifications/page.tsx
        security/page.tsx
        checkout-preview/page.tsx
  features/
    merchant/
      components/
      data/
      hooks/
      lib/
      store/
      types.ts
```

## UI and component hierarchy

### Shell

- `MerchantShell`
- `MerchantSidebar`
- `MerchantTopbar`
- `MerchantMobileNav`
- `MerchantRealtimeBridge`

### Shared primitives

- `MerchantButton`
- `MerchantInput`
- `MerchantSelect`
- `SectionCard`
- `MetricCard`
- `StatusBadge`
- `EmptyState`
- `SkeletonBlock`
- `KeyValueList`

### Charts

- `RevenueAreaChart`
- `BreakdownDonutChart`
- `MiniSparkline`

### Payments

- `PaymentRequestBuilder`
- `PaymentTable`
- `PaymentStatusBadge`
- `PaymentTimeline`
- `CheckoutPreviewCard`

### Settlements

- `SettlementSummaryCard`
- `SettlementScheduleCard`
- `PayoutAccountCard`
- `SettlementHistoryTable`

## State management architecture

### Zustand stores

- `merchantAuthStore`
  - merchant session
  - auth challenge state
  - onboarding completion
- `merchantUiStore`
  - theme
  - mobile nav
  - active filters persisted per module

### React Query

- dashboard aggregates
- payments list and detail
- settlements list
- payout accounts
- analytics snapshots

### WebSocket strategy

Use a merchant namespace such as `/merchant-realtime` and invalidate query segments on incoming events.

Suggested client invalidations:

- `payment.created`, `payment.awaiting_confirmation`, `payment.confirmed`, `payment.failed`
  - invalidate payments, dashboard, analytics
- `settlement.settling`, `settlement.settled`, `settlement.failed`
  - invalidate settlements, dashboard, analytics
- `risk.alert.created`
  - invalidate notifications, security

## Database schema suggestions

### merchants

- `id`
- `merchant_type` (`individual`, `business`)
- `display_name`
- `legal_name`
- `country`
- `base_currency`
- `default_settlement_mode` (`instant_fiat`, `hold_usdc`)
- `default_payout_schedule` (`instant`, `daily`, `weekly`)
- `kyc_status`
- `kyb_status`
- `compliance_tier`
- `status`
- `created_at`
- `updated_at`

### merchant_users

- `id`
- `merchant_id`
- `email`
- `full_name`
- `role`
- `permissions_json`
- `two_factor_enabled`
- `last_login_at`
- `status`

### merchant_stores

- `id`
- `merchant_id`
- `name`
- `slug`
- `country`
- `currency`
- `logo_url`
- `brand_primary`
- `brand_accent`
- `hosted_checkout_domain`
- `status`

### merchant_payout_accounts

- `id`
- `merchant_id`
- `store_id`
- `account_type` (`bank`, `digital_dollar`)
- `currency`
- `bank_name`
- `account_name`
- `account_mask`
- `provider_reference`
- `is_default`
- `status`

### merchant_payment_requests

- `id`
- `merchant_id`
- `store_id`
- `request_type` (`payment_link`, `invoice`, `checkout_session`, `qr_static`, `qr_dynamic`, `api_request`)
- `reference`
- `fiat_currency`
- `fiat_amount`
- `quoted_digital_dollar_amount`
- `expires_at`
- `settlement_mode`
- `customer_email`
- `customer_name`
- `callback_url`
- `metadata_json`
- `status`

### merchant_payments

- `id`
- `merchant_id`
- `store_id`
- `payment_request_id`
- `customer_id`
- `reference`
- `network`
- `payment_currency`
- `payment_amount`
- `fiat_amount`
- `fx_rate`
- `processing_fee`
- `settlement_fee`
- `settlement_mode`
- `payment_status`
- `confirmed_at`
- `settling_at`
- `settled_at`

### merchant_settlements

- `id`
- `merchant_id`
- `store_id`
- `payment_id`
- `payout_account_id`
- `settlement_currency`
- `gross_amount`
- `net_amount`
- `fx_rate`
- `provider_reference`
- `arrival_eta`
- `status`

### merchant_api_keys

- `id`
- `merchant_id`
- `environment` (`sandbox`, `live`)
- `label`
- `public_key`
- `secret_hash`
- `last_used_at`
- `revoked_at`

### merchant_webhooks

- `id`
- `merchant_id`
- `environment`
- `url`
- `secret_hash`
- `subscribed_events_json`
- `status`

### merchant_webhook_deliveries

- `id`
- `merchant_webhook_id`
- `event_name`
- `request_id`
- `attempt`
- `status_code`
- `latency_ms`
- `delivered_at`
- `response_excerpt`

### merchant_audit_logs

- `id`
- `merchant_id`
- `actor_user_id`
- `event_type`
- `resource_type`
- `resource_id`
- `ip_address`
- `user_agent`
- `metadata_json`
- `created_at`

## Suggested backend endpoints

### Auth and onboarding

- `POST /merchant/auth/signup`
- `POST /merchant/auth/login`
- `POST /merchant/auth/2fa/verify`
- `POST /merchant/auth/password/forgot`
- `POST /merchant/auth/password/reset`
- `GET /merchant/auth/me`
- `POST /merchant/onboarding`
- `GET /merchant/onboarding/status`

### Dashboard

- `GET /merchant/dashboard/summary`
- `GET /merchant/dashboard/revenue-series`
- `GET /merchant/dashboard/network-breakdown`

### Payments

- `GET /merchant/payments`
- `POST /merchant/payments/requests`
- `GET /merchant/payments/:id`
- `POST /merchant/payments/:id/expire`
- `GET /merchant/payments/:id/checkout-preview`
- `GET /merchant/payments/:id/qr.svg`
- `GET /merchant/payments/:id/qr.png`

### Settlements

- `GET /merchant/settlements`
- `GET /merchant/settlements/:id`
- `PATCH /merchant/settlement-preferences`
- `POST /merchant/payout-accounts`
- `PATCH /merchant/payout-accounts/:id/default`

### Analytics

- `GET /merchant/analytics/revenue`
- `GET /merchant/analytics/customers`
- `GET /merchant/analytics/networks`
- `GET /merchant/analytics/export.csv`
- `GET /merchant/analytics/export.pdf`

### Stores and branding

- `GET /merchant/stores`
- `POST /merchant/stores`
- `PATCH /merchant/stores/:id`
- `PATCH /merchant/stores/:id/branding`

### Developer tools

- `GET /merchant/api-keys`
- `POST /merchant/api-keys`
- `DELETE /merchant/api-keys/:id`
- `GET /merchant/webhooks`
- `POST /merchant/webhooks`
- `PATCH /merchant/webhooks/:id`
- `GET /merchant/webhooks/:id/deliveries`
- `POST /merchant/webhooks/:id/retry/:deliveryId`

### Team and security

- `GET /merchant/team`
- `POST /merchant/team/invite`
- `PATCH /merchant/team/:userId`
- `GET /merchant/security/devices`
- `GET /merchant/security/login-history`
- `GET /merchant/security/audit-logs`

## Suggested API response contracts

### Dashboard summary

```json
{
  "statusCode": 200,
  "data": {
    "totalRevenue": { "amount": 2845021.48, "currency": "USD", "deltaPct": 12.4 },
    "pendingSettlements": { "amount": 182420.22, "currency": "USD", "count": 14 },
    "successfulPayments": { "count": 1842, "successRate": 98.7 },
    "failedPayments": { "count": 24, "failureRate": 1.3 },
    "averageSettlementSpeedMinutes": 6.2
  }
}
```

### Payment request creation

```json
{
  "statusCode": 201,
  "data": {
    "id": "payreq_123",
    "reference": "CHP_8FJ2A1Q",
    "status": "pending",
    "checkoutUrl": "https://pay.cheesepay.xyz/c/CHP_8FJ2A1Q",
    "qrSvgUrl": "https://api.cheesepay.xyz/v1/merchant/payments/payreq_123/qr.svg",
    "quotedAmount": {
      "fiatCurrency": "NGN",
      "fiatAmount": 250000,
      "digitalDollarAmount": 167.84
    }
  }
}
```

## Suggested WebSocket events

- `dashboard.snapshot.updated`
- `payment.created`
- `payment.awaiting_confirmation`
- `payment.confirmed`
- `payment.settling`
- `payment.settled`
- `payment.failed`
- `payment.expired`
- `settlement.created`
- `settlement.failed`
- `settlement.settled`
- `risk.alert.created`
- `webhook.delivery.failed`

## Merchant onboarding flow

1. Merchant signs up with email and password
2. Email verification
3. Two-factor activation or verification
4. Select merchant type: individual or business
5. Configure settlement preference
6. Configure store name and operating country
7. Connect payout destination
8. Submit KYC or KYB
9. Land on dashboard with sandbox enabled if compliance is pending

## Payout flow

1. Merchant chooses `hold digital dollar` or `instant payout`
2. On confirmed payment, settlement engine computes FX and fees
3. Settlement enters `settling`
4. Merchant sees ETA, reference, and destination
5. Completion triggers settlement receipt and webhook

## Checkout flow

1. Merchant creates payment request
2. Customer opens hosted checkout or scans QR
3. System quotes best payment network
4. Customer pays
5. Merchant sees `awaiting confirmation` then `confirmed`
6. Settlement runs per store preference

## Mobile experience considerations

- Sticky quick actions at bottom of key pages
- Compact KPI stack before tables
- Side nav replaced with bottom drawer
- Payment detail timeline collapses into cards
- Export and filter tools grouped into a single overflow control

## Enterprise scaling considerations

- Multi-store tenancy and store-scoped permissions
- Dual environment support across all developer tooling
- Regional payout routing by currency and corridor
- Audit log immutability and searchable event indexing
- Read-model projections for dashboard analytics
- Queue-backed webhook delivery and retry controls
- WebSocket fan-out via Redis adapter
- Object storage for receipts, invoices, and QR assets
