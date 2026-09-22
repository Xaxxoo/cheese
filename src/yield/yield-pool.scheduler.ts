// src/yield/yield-pool.scheduler.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import { User } from '../auth/entities/user.entity';
import { WalletService } from '../wallet/wallet.service';
import { BlendService } from './blend.service';
import { AlertsService } from '../alerts/alerts.service';

@Injectable()
export class YieldPoolScheduler {
  private readonly logger = new Logger(YieldPoolScheduler.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly walletService: WalletService,
    private readonly blendService: BlendService,
    private readonly config: ConfigService,
    private readonly alertsService: AlertsService,
  ) {}

  @Cron('0 * * * *', { name: 'yield-pool-rebalance', timeZone: 'UTC' })
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
        // Still check liquidity even when pool is balanced
        await this.checkLiquidityLevel(totalOptedInUsdc);
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

      await this.checkLiquidityLevel(totalOptedInUsdc);
    } catch (err) {
      this.logger.error(
        `Pool rebalance failed: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Ensure the platform holds at least `requiredUsdc` in liquid USDC.
   * If the balance is below the required amount, withdraw the shortfall from Blend.
   */
  async ensureLiquidity(requiredUsdc: number): Promise<void> {
    if (!this.config.get<boolean>('yield.enabled', false)) {
      return;
    }

    try {
      const liquidBalance = await this.getPlatformLiquidUsdc();

      if (liquidBalance >= requiredUsdc) {
        this.logger.debug(
          `Liquidity sufficient [liquid=$${liquidBalance.toFixed(2)}, required=$${requiredUsdc.toFixed(2)}]`,
        );
        return;
      }

      const shortfall = requiredUsdc - liquidBalance;
      this.logger.warn(
        `Liquidity shortfall detected — withdrawing $${shortfall.toFixed(6)} from Blend [liquid=$${liquidBalance.toFixed(2)}, required=$${requiredUsdc.toFixed(2)}]`,
      );

      await this.blendService.withdrawFromPool(shortfall.toFixed(6));

      this.logger.log(
        `Liquidity restored — withdrew $${shortfall.toFixed(6)} from Blend`,
      );
    } catch (err) {
      this.logger.error(
        `ensureLiquidity failed: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Listen for liquidity shortage events emitted by wallet service
   * when a withdrawal fails due to insufficient platform balance.
   */
  @OnEvent('yield.liquidity_needed')
  async handleLiquidityNeeded(payload: {
    requiredUsdc: number;
  }): Promise<void> {
    this.logger.warn(
      `Received yield.liquidity_needed event [required=$${payload.requiredUsdc}]`,
    );
    await this.ensureLiquidity(payload.requiredUsdc);
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  /**
   * Check if liquid USDC is below the 20% alert threshold and send admin alert.
   */
  private async checkLiquidityLevel(
    totalOptedInUsdc: number,
  ): Promise<void> {
    try {
      const liquidBalance = await this.getPlatformLiquidUsdc();
      const alertThreshold = totalOptedInUsdc * 0.2;

      if (liquidBalance < alertThreshold && totalOptedInUsdc > 0) {
        const pct = ((liquidBalance / totalOptedInUsdc) * 100).toFixed(1);
        const message =
          `Low liquidity warning: platform holds $${liquidBalance.toFixed(2)} ` +
          `liquid USDC (${pct}% of $${totalOptedInUsdc.toFixed(2)} enrolled). ` +
          `Threshold is 20%.`;

        this.logger.warn(message);

        // Send Telegram alert via AlertsService
        void this.alertsService
          .notifyFailedDeposit({
            username: 'SYSTEM',
            amountNgn: '0',
            amountUsdc: liquidBalance.toFixed(2),
            reference: 'YIELD-LOW-LIQUIDITY',
            failureReason: message,
          })
          .catch((err) =>
            this.logger.error(
              `Failed to send low-liquidity alert: ${(err as Error).message}`,
            ),
          );
      }
    } catch (err) {
      this.logger.error(
        `Liquidity check failed: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Get the platform's liquid (non-pooled) USDC balance via Horizon.
   */
  private async getPlatformLiquidUsdc(): Promise<number> {
    const secret = process.env.STELLAR_PLATFORM_SECRET_KEY;
    if (!secret) return 0;

    const platformPublicKey =
      StellarSdk.Keypair.fromSecret(secret).publicKey();
    const horizonUrl = this.config.get<string>(
      'stellar.horizonUrl',
      'https://horizon.stellar.org',
    );
    const usdcIssuer = this.config.get<string>('stellar.usdcIssuer', '');

    const server = new StellarSdk.Horizon.Server(horizonUrl);
    const account = await server.loadAccount(platformPublicKey);

    for (const balance of account.balances) {
      if (
        'asset_code' in balance &&
        balance.asset_code === 'USDC' &&
        balance.asset_issuer === usdcIssuer
      ) {
        return parseFloat(balance.balance);
      }
    }

    return 0;
  }
}
