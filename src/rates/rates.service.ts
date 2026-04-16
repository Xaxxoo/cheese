// src/rates/rates.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { ExchangeRate } from './entities/exchange-rate.entity';

@Injectable()
export class RatesService implements OnModuleInit {
  private readonly logger = new Logger(RatesService.name);
  private cachedRate: ExchangeRate | null = null;

  constructor(
    @InjectRepository(ExchangeRate)
    private readonly rateRepo: Repository<ExchangeRate>,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.fetchAndStore();
  }

  // ── GET /rates/current ────────────────────────────────────
  async getCurrentRate(): Promise<ExchangeRate> {
    if (this.cachedRate) return this.cachedRate;

    const latest = await this.rateRepo.findOne({
      order: { fetchedAt: 'DESC' },
    });
    if (latest) {
      this.cachedRate = latest;
      return latest;
    }

    return this.fetchAndStore();
  }

  // ── Fetch from external source every 60s ─────────────────
  @Cron(CronExpression.EVERY_MINUTE)
  async fetchAndStore(): Promise<ExchangeRate> {
    try {
      const url = this.config.get<string>('rates.exchangeRateUrl');
      if (!url) throw new Error('Exchange rate URL not configured');
      const res = await fetch(url);
      const json = (await res.json()) as { rates: Record<string, number> };

      const usdToNgn = json.rates['NGN'];
      const spreadPct = this.config.get<number>('rates.ngnSpreadPercent', 1.5);
      const effectiveRate = usdToNgn * (1 - spreadPct / 100);

      const record = this.rateRepo.create({
        usdToNgn: String(usdToNgn),
        effectiveRate: String(effectiveRate),
        spreadPercent: String(spreadPct),
        source: url,
      });

      const saved = await this.rateRepo.save(record);
      this.cachedRate = saved;

      this.logger.log(
        `Rate updated: 1 USD = ₦${usdToNgn} (effective: ₦${effectiveRate.toFixed(2)})`,
      );
      return saved;
    } catch (err) {
      this.logger.error(
        `Failed to fetch exchange rate: ${(err as Error).message}`,
      );
      // Return stale rate rather than crashing
      if (this.cachedRate) return this.cachedRate;
      // Fallback hardcoded value so the app doesn't break on startup
      const fallback = this.rateRepo.create({
        usdToNgn: '1600',
        effectiveRate: '1576',
        spreadPercent: '1.5',
        source: 'fallback',
      });
      return this.rateRepo.save(fallback);
    }
  }

  // ── Utility: convert USDC to NGN ─────────────────────────
  async usdcToNgn(amountUsdc: number): Promise<number> {
    const rate = await this.getCurrentRate();
    return amountUsdc * parseFloat(rate.effectiveRate);
  }
}
