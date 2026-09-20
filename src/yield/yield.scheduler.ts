// src/yield/yield.scheduler.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../auth/entities/user.entity';
import { TransactionsService } from '../transactions/transactions.service';
import { WalletService } from '../wallet/wallet.service';
import { BlockchainService } from '../blockchain/services/blockchain.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { AlertsService } from '../alerts/alerts.service';
import { YieldService } from './yield.service';
import { TxType, TxStatus } from '../transactions/entities/transaction.entity';

@Injectable()
export class YieldScheduler {
  private readonly logger = new Logger(YieldScheduler.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly txService: TransactionsService,
    private readonly walletService: WalletService,
    private readonly blockchainService: BlockchainService,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
    private readonly alertsService: AlertsService,
    private readonly yieldService: YieldService,
    private readonly config: ConfigService,
  ) {}

  @Cron('0 2 * * *', { name: 'yield-distribution', timeZone: 'UTC' })
  async distributeYield(): Promise<void> {
    if (!this.config.get<boolean>('yield.enabled', false)) {
      this.logger.debug('Yield distribution skipped — not enabled');
      return;
    }

    this.logger.log('Starting daily yield distribution');

    const users = await this.userRepo.find({
      where: { yieldEnrolled: true },
    });

    const minBalance = this.config.get<number>('yield.minBalanceUsdc', 1);
    const today = new Date().toISOString().slice(0, 10);
    let totalDistributed = 0;
    let usersProcessed = 0;
    let usersFailed = 0;

    for (const user of users) {
      try {
        const balance = await this.walletService.getBalance(user.id);
        const totalUsdc = parseFloat(balance.totalUsdc);

        if (totalUsdc < minBalance) {
          this.logger.debug(
            `Skipping user ${user.id} — balance $${totalUsdc} below minimum`,
          );
          continue;
        }

        const apy = this.yieldService.getApyForTier(user.tier);
        const dailyYield = totalUsdc * (apy / 365);
        const yieldAmount = dailyYield.toFixed(6);

        if (parseFloat(yieldAmount) <= 0) continue;

        // Credit yield to user's Stellar wallet
        const txHash = await this.blockchainService.platformDepositUsdc(
          user.stellarPublicKey!,
          yieldAmount,
          'Yield credit',
        );

        // Record the transaction
        const reference = `YLD-${user.id.slice(0, 8)}-${today}`;
        await this.txService.create({
          userId: user.id,
          type: TxType.YIELD_CREDIT,
          status: TxStatus.COMPLETED,
          amountUsdc: yieldAmount,
          feeUsdc: '0.000000',
          txHash,
          network: 'stellar',
          reference,
          description: 'Daily yield credit',
        });

        // Update user yield stats
        const newTotal = (
          parseFloat(user.totalYieldEarned) + parseFloat(yieldAmount)
        ).toFixed(6);

        await this.userRepo.update(
          { id: user.id },
          { lastYieldAt: new Date(), totalYieldEarned: newTotal },
        );

        // Send push notification
        void this.notificationsService
          .notifyYieldCredited(user.id, yieldAmount, newTotal)
          .catch((err: Error) =>
            this.logger.error(
              `Yield notification failed [userId=${user.id}]: ${err.message}`,
            ),
          );

        // Send email
        if (user.email) {
          void this.emailService
            .sendYieldCredited({
              to: user.email,
              fullName: user.fullName,
              amountUsdc: yieldAmount,
              totalEarned: newTotal,
              apyRate: (apy * 100).toFixed(1),
              balanceUsdc: balance.totalUsdc,
            })
            .catch((err: Error) =>
              this.logger.error(
                `Yield email failed [userId=${user.id}]: ${err.message}`,
              ),
            );
        }

        totalDistributed += parseFloat(yieldAmount);
        usersProcessed++;
      } catch (err) {
        usersFailed++;
        this.logger.error(
          `Yield distribution failed for user ${user.id}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Yield distribution complete: ${usersProcessed} users, $${totalDistributed.toFixed(6)} total, ${usersFailed} failures`,
    );

    // Send admin summary
    const adminEmail = this.config.get<string>('alerts.adminAlertEmail');
    if (adminEmail) {
      void this.emailService
        .sendAdminAlert({
          to: adminEmail,
          subject: `Yield Distribution Summary — ${today}`,
          html: `<p>Users processed: ${usersProcessed}</p>
                 <p>Total distributed: $${totalDistributed.toFixed(6)} USDC</p>
                 <p>Failures: ${usersFailed}</p>`,
        })
        .catch((err: Error) =>
          this.logger.error(`Admin yield summary email failed: ${err.message}`),
        );
    }
  }
}
