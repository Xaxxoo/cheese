// src/yield/yield-pool.scheduler.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../auth/entities/user.entity';
import { WalletService } from '../wallet/wallet.service';
import { BlendService } from './blend.service';

@Injectable()
export class YieldPoolScheduler {
  private readonly logger = new Logger(YieldPoolScheduler.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly walletService: WalletService,
    private readonly blendService: BlendService,
    private readonly config: ConfigService,
  ) {}

  @Cron('0 */6 * * *', { name: 'yield-pool-rebalance', timeZone: 'UTC' })
  async rebalancePool(): Promise<void> {
    if (!this.config.get<boolean>('yield.enabled', false)) {
      return;
    }

    const blendPoolId = this.config.get<string>('yield.blendPoolId', '');
    if (!blendPoolId) {
      this.logger.debug('Blend pool not configured — skipping rebalance');
      return;
    }

    this.logger.log('Starting pool rebalance');

    try {
      // Get all enrolled users and sum their balances
      const enrolledUsers = await this.userRepo.find({
        where: { yieldEnrolled: true },
        select: ['id', 'cachedBalanceUsdc'],
      });

      let totalOptedInUsdc = 0;
      for (const user of enrolledUsers) {
        totalOptedInUsdc += parseFloat(user.cachedBalanceUsdc ?? '0');
      }

      const bufferPercent = this.config.get<number>(
        'yield.bufferPercent',
        0.1,
      );
      const targetSupply = totalOptedInUsdc * (1 - bufferPercent);

      // Get current pool position
      const position = await this.blendService.getPoolPosition();
      const currentSupply = parseFloat(position.suppliedUsdc);

      const diff = targetSupply - currentSupply;
      const threshold = 1; // Only rebalance if diff > $1

      if (Math.abs(diff) < threshold) {
        this.logger.debug(
          `Pool balanced [current=$${currentSupply.toFixed(2)}, target=$${targetSupply.toFixed(2)}]`,
        );
        return;
      }

      if (diff > 0) {
        this.logger.log(
          `Supplying $${diff.toFixed(6)} USDC to Blend pool`,
        );
        await this.blendService.supplyToPool(diff.toFixed(6));
      } else {
        this.logger.log(
          `Withdrawing $${Math.abs(diff).toFixed(6)} USDC from Blend pool`,
        );
        await this.blendService.withdrawFromPool(Math.abs(diff).toFixed(6));
      }

      this.logger.log(
        `Pool rebalance complete [total_opted_in=$${totalOptedInUsdc.toFixed(2)}, target=$${targetSupply.toFixed(2)}, supplied=$${(currentSupply + diff).toFixed(2)}]`,
      );
    } catch (err) {
      this.logger.error(
        `Pool rebalance failed: ${(err as Error).message}`,
      );
    }
  }
}
