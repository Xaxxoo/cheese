import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { randomBytes, createHash } from 'crypto';
import { MerchantPayment, MerchantPaymentStatus, PaymentRequestKind } from './entities/merchant-payment.entity';
import { MerchantSettlement } from './entities/merchant-settlement.entity';
import { MerchantPayoutAccount } from './entities/merchant-payout-account.entity';
import { MerchantApiKey } from './entities/merchant-api-key.entity';
import { MerchantWebhook } from './entities/merchant-webhook.entity';
import { MerchantWebhookDelivery } from './entities/merchant-webhook-delivery.entity';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto';
import { AddPayoutAccountDto } from './dto/add-payout-account.dto';
import { UpdatePayoutAccountDto } from './dto/update-payout-account.dto';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import type { MerchantJwtContext } from './strategies/merchant-jwt.strategy';

const FX_RATES: Record<string, number> = {
  NGN: 1520.42,
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
};

function toUsd(amount: number, currency: string): number {
  const rate = FX_RATES[currency] ?? 1;
  return currency === 'USD' ? amount : amount / rate;
}

function formatCurrency(amount: number, currency: string): string {
  const symbols: Record<string, string> = { NGN: '₦', USD: '$', EUR: '€', GBP: '£' };
  const symbol = symbols[currency] ?? '';
  return `${symbol}${amount.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

@Injectable()
export class MerchantService {
  constructor(
    @InjectRepository(MerchantPayment)
    private readonly paymentRepo: Repository<MerchantPayment>,

    @InjectRepository(MerchantSettlement)
    private readonly settlementRepo: Repository<MerchantSettlement>,

    @InjectRepository(MerchantPayoutAccount)
    private readonly payoutAccountRepo: Repository<MerchantPayoutAccount>,

    @InjectRepository(MerchantApiKey)
    private readonly apiKeyRepo: Repository<MerchantApiKey>,

    @InjectRepository(MerchantWebhook)
    private readonly webhookRepo: Repository<MerchantWebhook>,

    @InjectRepository(MerchantWebhookDelivery)
    private readonly webhookDeliveryRepo: Repository<MerchantWebhookDelivery>,
  ) {}

  // ── Dashboard ─────────────────────────────────────────────────────────────

  async getDashboard(ctx: MerchantJwtContext): Promise<Record<string, unknown>> {
    const merchantId = ctx.merchant.id;
    const currency = ctx.merchant.baseCurrency;
    const now = new Date();

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayPayments, monthPayments, allSettled, pendingPayments] = await Promise.all([
      this.paymentRepo.find({
        where: { merchantId, createdAt: MoreThanOrEqual(todayStart) },
      }),
      this.paymentRepo.find({
        where: { merchantId, createdAt: MoreThanOrEqual(monthStart) },
      }),
      this.paymentRepo.find({
        where: { merchantId, status: MerchantPaymentStatus.SETTLED },
      }),
      this.paymentRepo.find({
        where: { merchantId, status: MerchantPaymentStatus.PENDING },
      }),
    ]);

    const sumFiat = (payments: MerchantPayment[]) =>
      payments.reduce((acc, p) => acc + Number(p.fiatAmount), 0);

    const grossToday = sumFiat(todayPayments);
    const grossMonth = sumFiat(monthPayments);
    const totalSettled = sumFiat(allSettled);
    const pendingVolume = sumFiat(pendingPayments);

    const summaries = [
      {
        label: 'Gross Today',
        amount: formatCurrency(grossToday, currency),
        trend: `${todayPayments.length} payment${todayPayments.length !== 1 ? 's' : ''}`,
        tone: 'neutral' as const,
      },
      {
        label: 'Gross This Month',
        amount: formatCurrency(grossMonth, currency),
        trend: `${monthPayments.length} transactions`,
        tone: 'positive' as const,
      },
      {
        label: 'Total Settled',
        amount: formatCurrency(totalSettled, currency),
        trend: `${allSettled.length} settled`,
        tone: 'positive' as const,
      },
      {
        label: 'Pending Volume',
        amount: formatCurrency(pendingVolume, currency),
        trend: `${pendingPayments.length} awaiting`,
        tone: pendingPayments.length > 0 ? ('warning' as const) : ('neutral' as const),
      },
    ];

    // Revenue series — last 7 days
    const revenueSeries = await this.buildRevenueSeries(merchantId, currency, 7);

    // Network usage
    const networkUsage = this.buildNetworkBreakdown(monthPayments);

    // Settlement mix
    const settlementMix = this.buildSettlementMix(monthPayments);

    // Recent activity
    const recentPayments = await this.paymentRepo.find({
      where: { merchantId },
      order: { createdAt: 'DESC' },
      take: 8,
    });

    const recentActivity = recentPayments.map((p) => ({
      id: p.id,
      title: `Payment ${p.status.replace(/_/g, ' ')}`,
      note: `${formatCurrency(Number(p.fiatAmount), p.fiatCurrency)} from ${p.customerName ?? 'Anonymous'}`,
      at: p.createdAt.toISOString(),
      type: 'payment' as const,
    }));

    return {
      summaries,
      revenueSeries,
      networkUsage,
      settlementMix,
      recentActivity,
      averageSettlementSpeed: '~15 seconds',
    };
  }

  // ── Payments ──────────────────────────────────────────────────────────────

  async listPayments(
    ctx: MerchantJwtContext,
    query: { page?: number; limit?: number; status?: string },
  ) {
    const { page = 1, limit = 20, status } = query;
    const merchantId = ctx.merchant.id;

    const qb = this.paymentRepo
      .createQueryBuilder('p')
      .where('p.merchant_id = :merchantId', { merchantId })
      .orderBy('p.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status && status !== 'all') {
      qb.andWhere('p.status = :status', { status });
    }

    const [payments, total] = await qb.getManyAndCount();

    return {
      payments: payments.map((p) => this.formatPayment(p)),
      total,
      page,
      limit,
    };
  }

  async getPayment(ctx: MerchantJwtContext, paymentId: string) {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId, merchantId: ctx.merchant.id },
    });
    if (!payment) return null;

    const timeline = this.buildTimeline(payment);
    const feeSummary = {
      processingFee: formatCurrency(Number(payment.processingFee), payment.fiatCurrency),
      settlementFee: formatCurrency(Number(payment.settlementFee), payment.fiatCurrency),
      fxRate: payment.fiatCurrency === 'USD'
        ? '1.000 USD = 1.000 USDC'
        : `1 USDC = ${FX_RATES[payment.fiatCurrency]?.toFixed(2) ?? '—'} ${payment.fiatCurrency}`,
      payoutEta: payment.settlementMode === 'instant_fiat' ? '~15 seconds' : 'Retained as USDC balance',
    };

    return { payment: this.formatPayment(payment), timeline, feeSummary };
  }

  async createPaymentRequest(ctx: MerchantJwtContext, dto: CreatePaymentRequestDto) {
    const merchantId = ctx.merchant.id;
    const currency = dto.fiatCurrency.toUpperCase();
    const digitalDollarAmount = toUsd(dto.fiatAmount, currency);
    const reference = `CHP_${randomBytes(5).toString('hex').toUpperCase()}`;
    const storeName = ctx.merchant.stores?.[0]?.name ?? ctx.merchant.displayName;

    const payment = this.paymentRepo.create({
      merchantId,
      reference,
      requestKind: dto.kind as PaymentRequestKind,
      fiatAmount: dto.fiatAmount,
      fiatCurrency: currency,
      digitalDollarAmount,
      customerName: dto.customerName ?? null,
      customerEmail: dto.customerEmail ?? null,
      settlementMode: dto.settlementMode,
      settlementCurrency: dto.settlementCurrency,
      callbackUrl: dto.callbackUrl ?? null,
      metadata: dto.metadata ?? {},
      expiresAt: new Date(Date.now() + dto.expirationMinutes * 60 * 1000),
      status: MerchantPaymentStatus.PENDING,
      storeName,
      speed: 'Instant',
      costEfficiency: 'Optimised',
    });

    const saved = await this.paymentRepo.save(payment);

    return {
      payment: this.formatPayment(saved),
      reference: saved.reference,
      checkoutUrl: `https://pay.cheesepay.xyz/c/${saved.reference}`,
      quotedDigitalDollarAmount: `$${digitalDollarAmount.toFixed(2)}`,
      expiresLabel: `${dto.expirationMinutes} minutes after issue`,
      settlementDescription:
        dto.settlementMode === 'instant_fiat'
          ? `Instant payout in ${dto.settlementCurrency}`
          : 'Hold as digital dollar balance',
    };
  }

  // ── Settlements ───────────────────────────────────────────────────────────

  async getSettlements(ctx: MerchantJwtContext) {
    const merchantId = ctx.merchant.id;
    const currency = ctx.merchant.baseCurrency;
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [settlements, payoutAccounts, monthPayments] = await Promise.all([
      this.settlementRepo.find({
        where: { merchantId },
        order: { createdAt: 'DESC' },
        take: 50,
      }),
      this.payoutAccountRepo.find({ where: { merchantId } }),
      this.paymentRepo.find({
        where: { merchantId, createdAt: MoreThanOrEqual(monthStart) },
      }),
    ]);

    const settled = settlements.filter((s) => s.status === 'settled');
    const pending = settlements.filter((s) => s.status === 'queued' || s.status === 'settling');
    const totalSettledAmount = settled.reduce((acc, s) => acc + Number(s.netAmount), 0);
    const pendingAmount = pending.reduce((acc, s) => acc + Number(s.netAmount), 0);

    const summaries = [
      {
        label: 'Total Settled',
        amount: formatCurrency(totalSettledAmount, currency),
        trend: `${settled.length} payouts`,
        tone: 'positive' as const,
      },
      {
        label: 'Pending Payout',
        amount: formatCurrency(pendingAmount, currency),
        trend: `${pending.length} queued`,
        tone: pending.length > 0 ? ('warning' as const) : ('neutral' as const),
      },
      {
        label: 'This Month',
        amount: formatCurrency(
          monthPayments.reduce((acc, p) => acc + Number(p.fiatAmount), 0),
          currency,
        ),
        trend: `${monthPayments.length} payments`,
        tone: 'neutral' as const,
      },
    ];

    const fxRate = FX_RATES[currency];
    const currentFxRate = currency === 'USD' ? '1.0000' : fxRate?.toFixed(2) ?? '—';

    return {
      summaries,
      payoutAccounts: payoutAccounts.map((a) => ({
        id: a.id,
        label: a.label,
        accountType: a.accountType,
        currency: a.currency,
        destination: a.destination,
        status: a.status,
        defaultForInstantPayout: a.defaultForInstantPayout,
      })),
      settlements: settlements.map((s) => ({
        id: s.id,
        paymentReference: s.paymentReference,
        currency: s.currency,
        grossAmount: formatCurrency(Number(s.grossAmount), s.currency),
        netAmount: formatCurrency(Number(s.netAmount), s.currency),
        destination: s.destination,
        schedule: s.schedule,
        eta: s.eta?.toISOString() ?? null,
        status: s.status,
        createdAt: s.createdAt.toISOString(),
        bankReference: s.bankReference ?? '—',
      })),
      currentFxRate: `1 USDC = ${currentFxRate} ${currency}`,
      estimatedArrival: 'Within 15 seconds for instant payouts',
    };
  }

  // ── Payout accounts ───────────────────────────────────────────────────────

  private serializeAccount(a: MerchantPayoutAccount) {
    return {
      id: a.id,
      label: a.label,
      accountType: a.accountType,
      currency: a.currency,
      destination: a.destination,
      status: a.status,
      defaultForInstantPayout: a.defaultForInstantPayout,
    };
  }

  async addPayoutAccount(ctx: MerchantJwtContext, dto: AddPayoutAccountDto) {
    const merchantId = ctx.merchant.id;
    const existing = await this.payoutAccountRepo.find({ where: { merchantId } });
    const isFirst = existing.length === 0;

    const account = this.payoutAccountRepo.create({
      merchantId,
      label: dto.label,
      accountType: dto.accountType,
      currency: dto.currency.toUpperCase(),
      destination: dto.destination,
      status: 'review',
      defaultForInstantPayout: isFirst,
    });

    const saved = await this.payoutAccountRepo.save(account);
    return { payoutAccount: this.serializeAccount(saved) };
  }

  async updatePayoutAccount(ctx: MerchantJwtContext, id: string, dto: UpdatePayoutAccountDto) {
    const account = await this.payoutAccountRepo.findOne({
      where: { id, merchantId: ctx.merchant.id },
    });
    if (!account) return null;

    account.label = dto.label;
    const saved = await this.payoutAccountRepo.save(account);
    return { payoutAccount: this.serializeAccount(saved) };
  }

  async removePayoutAccount(ctx: MerchantJwtContext, id: string) {
    const merchantId = ctx.merchant.id;
    const account = await this.payoutAccountRepo.findOne({ where: { id, merchantId } });
    if (!account) return null;

    await this.payoutAccountRepo.remove(account);

    // If the deleted account was the default, promote the next one
    if (account.defaultForInstantPayout) {
      const remaining = await this.payoutAccountRepo.find({ where: { merchantId } });
      if (remaining.length > 0) {
        remaining[0].defaultForInstantPayout = true;
        await this.payoutAccountRepo.save(remaining[0]);
      }
    }

    return { removed: true };
  }

  async setDefaultPayoutAccount(ctx: MerchantJwtContext, id: string) {
    const merchantId = ctx.merchant.id;
    const accounts = await this.payoutAccountRepo.find({ where: { merchantId } });
    const target = accounts.find((a) => a.id === id);
    if (!target) return null;

    for (const a of accounts) {
      a.defaultForInstantPayout = a.id === id;
    }
    await this.payoutAccountRepo.save(accounts);
    return { payoutAccount: this.serializeAccount(target) };
  }

  // ── API Keys ──────────────────────────────────────────────────────────────

  private serializeApiKey(k: MerchantApiKey, rawKey?: string) {
    return {
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      scopes: k.scopes,
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      expiresAt: k.expiresAt?.toISOString() ?? null,
      revokedAt: k.revokedAt?.toISOString() ?? null,
      createdAt: k.createdAt.toISOString(),
      ...(rawKey ? { rawKey } : {}),
    };
  }

  async listApiKeys(ctx: MerchantJwtContext) {
    const merchantId = ctx.merchant.id;
    const keys = await this.apiKeyRepo.find({
      where: { merchantId },
      order: { createdAt: 'DESC' },
    });

    const active = keys.filter((k) => !k.revokedAt);
    const revoked = keys.filter((k) => !!k.revokedAt);

    return {
      active: active.map((k) => this.serializeApiKey(k)),
      revoked: revoked.map((k) => this.serializeApiKey(k)),
    };
  }

  async createApiKey(ctx: MerchantJwtContext, dto: CreateApiKeyDto) {
    const merchantId = ctx.merchant.id;
    const rawBytes = randomBytes(24).toString('hex'); // 48 hex chars
    const rawKey = `cheese_live_${rawBytes}`;
    const prefix = rawKey.slice(0, 20);
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const key = this.apiKeyRepo.create({
      merchantId,
      name: dto.name,
      keyHash,
      prefix,
      scopes: dto.scopes,
    });

    const saved = await this.apiKeyRepo.save(key);
    return { apiKey: this.serializeApiKey(saved, rawKey) };
  }

  async revokeApiKey(ctx: MerchantJwtContext, id: string) {
    const key = await this.apiKeyRepo.findOne({
      where: { id, merchantId: ctx.merchant.id },
    });
    if (!key) return null;

    key.revokedAt = new Date();
    const saved = await this.apiKeyRepo.save(key);
    return { apiKey: this.serializeApiKey(saved) };
  }

  // ── Webhooks ──────────────────────────────────────────────────────────────

  private serializeWebhook(w: MerchantWebhook, lastDelivery?: MerchantWebhookDelivery | null, secret?: string) {
    return {
      id: w.id,
      url: w.url,
      description: w.description,
      events: w.events,
      enabled: w.enabled,
      createdAt: w.createdAt.toISOString(),
      lastDelivery: lastDelivery
        ? {
            event: lastDelivery.event,
            responseStatus: lastDelivery.responseStatus,
            success: lastDelivery.success,
            createdAt: lastDelivery.createdAt.toISOString(),
          }
        : null,
      ...(secret ? { secret } : {}),
    };
  }

  async listWebhooks(ctx: MerchantJwtContext) {
    const merchantId = ctx.merchant.id;
    const webhooks = await this.webhookRepo.find({
      where: { merchantId },
      order: { createdAt: 'DESC' },
    });

    const withDeliveries = await Promise.all(
      webhooks.map(async (w) => {
        const lastDelivery = await this.webhookDeliveryRepo.findOne({
          where: { webhookId: w.id },
          order: { createdAt: 'DESC' },
        });
        return this.serializeWebhook(w, lastDelivery);
      }),
    );

    return { webhooks: withDeliveries };
  }

  async createWebhook(ctx: MerchantJwtContext, dto: CreateWebhookDto) {
    const merchantId = ctx.merchant.id;
    const secretBytes = randomBytes(32).toString('hex'); // 64 hex chars
    const secret = `whsec_${secretBytes}`;

    const webhook = this.webhookRepo.create({
      merchantId,
      url: dto.url,
      description: dto.description ?? null,
      events: dto.events,
      secret,
      enabled: true,
    });

    const saved = await this.webhookRepo.save(webhook);
    return { webhook: this.serializeWebhook(saved, null, secret) };
  }

  async updateWebhook(ctx: MerchantJwtContext, id: string, dto: UpdateWebhookDto) {
    const webhook = await this.webhookRepo.findOne({
      where: { id, merchantId: ctx.merchant.id },
    });
    if (!webhook) return null;

    if (dto.url !== undefined) webhook.url = dto.url;
    if (dto.description !== undefined) webhook.description = dto.description;
    if (dto.events !== undefined) webhook.events = dto.events;
    if (dto.enabled !== undefined) webhook.enabled = dto.enabled;

    const saved = await this.webhookRepo.save(webhook);
    return { webhook: this.serializeWebhook(saved) };
  }

  async deleteWebhook(ctx: MerchantJwtContext, id: string) {
    const webhook = await this.webhookRepo.findOne({
      where: { id, merchantId: ctx.merchant.id },
    });
    if (!webhook) return null;

    await this.webhookRepo.remove(webhook);
    return { removed: true };
  }

  async getWebhookDeliveries(ctx: MerchantJwtContext, webhookId: string) {
    const webhook = await this.webhookRepo.findOne({
      where: { id: webhookId, merchantId: ctx.merchant.id },
    });
    if (!webhook) return null;

    const deliveries = await this.webhookDeliveryRepo.find({
      where: { webhookId },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    return {
      deliveries: deliveries.map((d) => ({
        id: d.id,
        webhookId: d.webhookId,
        event: d.event,
        responseStatus: d.responseStatus,
        responseBody: d.responseBody,
        attemptCount: d.attemptCount,
        success: d.success,
        createdAt: d.createdAt.toISOString(),
      })),
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private formatPayment(p: MerchantPayment) {
    return {
      id: p.id,
      reference: p.reference,
      requestKind: p.requestKind,
      createdAt: p.createdAt.toISOString(),
      customerName: p.customerName ?? 'Anonymous',
      customerEmail: p.customerEmail ?? '—',
      storeName: p.storeName ?? '—',
      fiatAmount: formatCurrency(Number(p.fiatAmount), p.fiatCurrency),
      fiatCurrency: p.fiatCurrency,
      digitalDollarAmount: `$${Number(p.digitalDollarAmount).toFixed(2)}`,
      settlementMode: p.settlementMode,
      settlementCurrency: p.settlementCurrency,
      network: p.network ?? 'Stellar',
      speed: p.speed ?? 'Instant',
      costEfficiency: p.costEfficiency ?? 'Optimised',
      status: p.status,
      metadata: p.metadata ?? {},
      callbackUrl: p.callbackUrl ?? '',
      expiresAt: p.expiresAt?.toISOString() ?? '',
    };
  }

  private buildTimeline(p: MerchantPayment) {
    const events: Array<{
      id: string;
      label: string;
      description: string;
      at: string;
      status: 'done' | 'failed' | 'current';
    }> = [
      {
        id: 'created',
        label: 'Request created',
        description: 'Merchant generated a new payment request.',
        at: p.createdAt.toISOString(),
        status: 'done',
      },
    ];

    if (p.paidAt) {
      events.push({
        id: 'paid',
        label: 'Payment received',
        description: 'Customer completed the payment.',
        at: p.paidAt.toISOString(),
        status: 'done',
      });
    }

    if (p.confirmedAt) {
      events.push({
        id: 'confirmed',
        label: 'On-chain confirmed',
        description: 'Transaction confirmed on the network.',
        at: p.confirmedAt.toISOString(),
        status: 'done',
      });
    }

    if (p.settledAt) {
      events.push({
        id: 'settled',
        label: 'Settlement complete',
        description: 'Funds disbursed to your payout account.',
        at: p.settledAt.toISOString(),
        status: 'done',
      });
    } else if (p.status === MerchantPaymentStatus.FAILED || p.status === MerchantPaymentStatus.EXPIRED) {
      events.push({
        id: 'terminal',
        label: p.status === MerchantPaymentStatus.FAILED ? 'Payment failed' : 'Payment expired',
        description: p.status === MerchantPaymentStatus.FAILED
          ? 'The payment could not be processed.'
          : 'The payment link expired without completion.',
        at: p.updatedAt.toISOString(),
        status: 'failed' as const,
      });
    } else {
      events.push({
        id: 'current',
        label: `Status: ${p.status.replace(/_/g, ' ')}`,
        description: 'Waiting for next step.',
        at: p.updatedAt.toISOString(),
        status: 'current' as const,
      });
    }

    return events;
  }

  private async buildRevenueSeries(merchantId: string, currency: string, days: number) {
    const series: Array<{ label: string; gross: number; settled: number }> = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayPayments = await this.paymentRepo
        .createQueryBuilder('p')
        .where('p.merchant_id = :merchantId', { merchantId })
        .andWhere('p.created_at >= :start', { start: dayStart })
        .andWhere('p.created_at <= :end', { end: dayEnd })
        .getMany();

      const gross = dayPayments.reduce((acc, p) => acc + Number(p.fiatAmount), 0);
      const settled = dayPayments
        .filter((p) => p.status === MerchantPaymentStatus.SETTLED)
        .reduce((acc, p) => acc + Number(p.fiatAmount), 0);

      series.push({
        label: dayStart.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        gross: toUsd(gross, currency),
        settled: toUsd(settled, currency),
      });
    }

    return series;
  }

  private buildNetworkBreakdown(payments: MerchantPayment[]) {
    if (payments.length === 0) {
      return [
        { label: 'Stellar', value: 100, color: '#7f5af0', note: 'Default network' },
      ];
    }

    const counts: Record<string, number> = {};
    for (const p of payments) {
      const net = p.network ?? 'Stellar';
      counts[net] = (counts[net] ?? 0) + 1;
    }

    const colors = ['#7f5af0', '#2cb67d', '#ff8c00', '#e53e3e', '#3182ce', '#d69e2e'];
    return Object.entries(counts).map(([label, value], i) => ({
      label,
      value: Math.round((value / payments.length) * 100),
      color: colors[i % colors.length],
      note: `${value} payment${value !== 1 ? 's' : ''}`,
    }));
  }

  private buildSettlementMix(payments: MerchantPayment[]) {
    if (payments.length === 0) {
      return [
        { label: 'Instant Fiat', value: 100, color: '#2cb67d', note: 'Default mode' },
      ];
    }

    const fiat = payments.filter((p) => p.settlementMode === 'instant_fiat').length;
    const usdc = payments.filter((p) => p.settlementMode === 'hold_usdc').length;

    return [
      {
        label: 'Instant Fiat',
        value: Math.round((fiat / payments.length) * 100),
        color: '#2cb67d',
        note: `${fiat} payments`,
      },
      {
        label: 'Hold USDC',
        value: Math.round((usdc / payments.length) * 100),
        color: '#7f5af0',
        note: `${usdc} payments`,
      },
    ].filter((s) => s.value > 0);
  }
}
