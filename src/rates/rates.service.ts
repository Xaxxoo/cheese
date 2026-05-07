// src/rates/rates.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExchangeRate } from './entities/exchange-rate.entity';

@Injectable()
export class RatesService {
  private readonly logger = new Logger(RatesService.name);
  private cachedRate: ExchangeRate | null = null;

  constructor(
    @InjectRepository(ExchangeRate)
    private readonly rateRepo: Repository<ExchangeRate>,
  ) {}

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

    // No rate in DB — seed with default
    return this.setRate(1390, 1.5);
  }

  // ── Admin: set rate manually ──────────────────────────────
  async setRate(usdToNgn: number, spreadPercent = 0): Promise<ExchangeRate> {
    const effectiveRate = usdToNgn * (1 - spreadPercent / 100);
    const record = this.rateRepo.create({
      usdToNgn: String(usdToNgn),
      effectiveRate: String(effectiveRate),
      spreadPercent: String(spreadPercent),
      source: 'admin',
    });
    const saved = await this.rateRepo.save(record);
    this.cachedRate = saved;
    this.logger.log(
      `Rate set by admin: 1 USD = ₦${usdToNgn} (spread ${spreadPercent}%, effective ₦${effectiveRate})`,
    );
    return saved;
  }

  // ── Utility: convert USDC to NGN ─────────────────────────
  async usdcToNgn(amountUsdc: number): Promise<number> {
    const rate = await this.getCurrentRate();
    return amountUsdc * parseFloat(rate.effectiveRate);
  }
}
